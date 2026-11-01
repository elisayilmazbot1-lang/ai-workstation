/**
 * OpenAI uyumlu sağlayıcı adaptörü.
 *
 * OpenAI, xAI (Grok), DeepSeek, Mistral, OpenRouter, Groq, Ollama, LM Studio
 * ve kullanıcı tanımlı OpenAI uyumlu uç noktalar aynı protokolü paylaşır.
 */
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ProviderAdapter,
  ProviderCredentials,
  ProviderKind,
  ProviderModelInfo,
  TokenUsage,
  ToolCallRequest,
} from '../../../shared/types/models.js';
import { ProviderError } from '../errors.js';
import { httpJson, httpStream, sseLines } from '../http.js';

export interface OpenAiCompatibleConfig {
  kind: ProviderKind;
  defaultBaseUrl: string;
  /** Model listesi uç noktası var mı? */
  supportsModelList: boolean;
  /** Anahtar zorunlu mu? (yerel servislerde değil) */
  requiresApiKey: boolean;
  extraHeaders?: Record<string, string>;
}

type OAIMessage = { role: string; content: string | null; tool_call_id?: string; name?: string; tool_calls?: unknown[] };

interface OAIChatResponse {
  id?: string;
  choices?: Array<{
    message?: { role?: string; content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
    finish_reason?: string;
    delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
  model?: string;
  error?: { message?: string; type?: string; code?: string };
}

interface OAIModelsResponse {
  data?: Array<{ id: string; owned_by?: string; created?: number; context_length?: number; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[] } }>;
}

function estimateCost(usage: TokenUsage, pricing: { input: number; output: number }): number {
  return (usage.inputTokens / 1_000_000) * pricing.input + (usage.outputTokens / 1_000_000) * pricing.output;
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  // Kullanıcı kök adres girdiyse /v1 ekle (OpenAI uyumlu uç noktalar için).
  if (/\/v\d+$/.test(trimmed) || trimmed.endsWith('/openai')) return trimmed;
  return `${trimmed}/v1`;
}

export function createOpenAiCompatibleAdapter(config: OpenAiCompatibleConfig): ProviderAdapter {
  const baseUrlFor = (credentials: ProviderCredentials) =>
    normalizeBaseUrl(credentials.baseUrl?.trim() || config.defaultBaseUrl);
  const headersFor = (credentials: ProviderCredentials): Record<string, string> => {
    const headers: Record<string, string> = { ...(config.extraHeaders ?? {}) };
    if (credentials.apiKey) headers.authorization = `Bearer ${credentials.apiKey}`;
    else if (config.requiresApiKey) throw new ProviderError('auth', 'Bu sağlayıcı için API anahtarı gerekli.');
    if (config.kind === 'openrouter') {
      headers['http-referer'] = 'https://ai-workstation.local';
      headers['x-title'] = 'AI Workstation';
    }
    return headers;
  };

  const adapter: ProviderAdapter = {
    kind: config.kind,

    async listModels(credentials) {
      if (!config.supportsModelList) return [];
      const { data } = await httpJson<OAIModelsResponse>(`${baseUrlFor(credentials)}/models`, {
        headers: headersFor(credentials),
        timeoutMs: 20_000,
        retries: 1,
      });
      const list = data.data ?? [];
      return list
        .filter((m) => typeof m?.id === 'string')
        .map<ProviderModelInfo>((m) => ({
          modelKey: m.id,
          displayName: m.id,
          contextLength: m.context_length,
          supportsVision: m.architecture?.input_modalities?.includes('image') ?? /vision|gpt-4o|claude|gemini|llava|qwen2?-vl/i.test(m.id),
          supportsTools: !/embed|whisper|tts|dall-e|moderation/i.test(m.id),
          pricing: {
            inputPerMillionUsd: m.pricing?.prompt ? Number(m.pricing.prompt) * 1_000_000 : undefined,
            outputPerMillionUsd: m.pricing?.completion ? Number(m.pricing.completion) * 1_000_000 : undefined,
          },
        }));
    },

    async testConnection(credentials) {
      const started = Date.now();
      try {
        if (config.supportsModelList) {
          await httpJson<OAIModelsResponse>(`${baseUrlFor(credentials)}/models`, {
            headers: headersFor(credentials),
            timeoutMs: 15_000,
            retries: 0,
          });
        } else {
          await httpJson(`${baseUrlFor(credentials)}/chat/completions`, {
            method: 'POST',
            headers: headersFor(credentials),
            body: { model: 'test', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
            timeoutMs: 15_000,
            retries: 0,
          });
        }
        return { ok: true, latencyMs: Date.now() - started, message: 'Bağlantı başarılı.' };
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError('unknown', String(err));
        return { ok: false, latencyMs: Date.now() - started, message: pe.toUserMessage() };
      }
    },

    async chat(request, credentials) {
      const body = buildBody(request, false);
      const { data, latencyMs } = await httpJson<OAIChatResponse>(`${baseUrlFor(credentials)}/chat/completions`, {
        method: 'POST',
        headers: headersFor(credentials),
        body,
        timeoutMs: request.timeoutMs ?? 120_000,
        signal: request.signal,
      });
      return parseResponse(data, latencyMs);
    },

    async chatStream(request, credentials, onEvent: (e: ChatStreamEvent) => void) {
      const body = buildBody(request, true);
      const { response, latencyMs } = await httpStream(`${baseUrlFor(credentials)}/chat/completions`, {
        method: 'POST',
        headers: headersFor(credentials),
        body,
        timeoutMs: request.timeoutMs ?? 180_000,
        signal: request.signal,
      });

      let content = '';
      let finishReason: ChatResponse['finishReason'] = 'stop';
      const toolCalls = new Map<number, { id: string; name: string; args: string }>();
      let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

      for await (const line of sseLines(response, request.signal)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let parsed: OAIChatResponse;
        try {
          parsed = JSON.parse(payload) as OAIChatResponse;
        } catch {
          continue;
        }
        if (parsed.error?.message) throw new ProviderError('server-error', parsed.error.message, undefined, true);
        const choice = parsed.choices?.[0];
        if (choice?.delta?.content) {
          content += choice.delta.content;
          onEvent({ type: 'delta', text: choice.delta.content });
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const current = toolCalls.get(tc.index) ?? { id: tc.id ?? `call_${tc.index}`, name: '', args: '' };
          if (tc.id) current.id = tc.id;
          if (tc.function?.name) current.name += tc.function.name;
          if (tc.function?.arguments) current.args += tc.function.arguments;
          toolCalls.set(tc.index, current);
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason === 'length' ? 'length' : choice.finish_reason === 'tool_calls' ? 'tool-calls' : 'stop';
        }
        if (parsed.usage) {
          usage = {
            inputTokens: parsed.usage.prompt_tokens ?? 0,
            outputTokens: parsed.usage.completion_tokens ?? 0,
            costUsd: parsed.usage.cost ?? 0,
          };
          onEvent({ type: 'usage', usage });
        }
      }

      if (!usage.inputTokens && !usage.outputTokens) {
        // Sağlayıcı kullanım bilgisi göndermediyse kaba tahmin yapılır ve
        // raporda "tahmini" olarak işaretlenir.
        usage = { inputTokens: estimateTokens(request.messages.map((m) => m.content).join(' ')), outputTokens: estimateTokens(content), costUsd: 0 };
      }

      const calls: ToolCallRequest[] = [...toolCalls.values()]
        .filter((t) => t.name)
        .map((t) => ({ id: t.id, name: t.name, arguments: safeJson(t.args) }));

      const result: Omit<ChatResponse, 'modelId'> = {
        providerId: '',
        modelKey: request.modelKey,
        content,
        toolCalls: calls,
        finishReason: calls.length ? 'tool-calls' : finishReason,
        usage,
        latencyMs,
      };
      for (const call of calls) onEvent({ type: 'tool-call', call });
      onEvent({ type: 'done', response: { ...result, modelId: request.modelId } });
      return result;
    },
  };
  return adapter;
}

function buildBody(request: ChatRequest & { modelKey: string }, stream: boolean): Record<string, unknown> {
  return {
    model: request.modelKey,
    messages: request.messages.map<OAIMessage>((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxOutputTokens,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(request.tools?.length
      ? {
          tools: request.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
          tool_choice: 'auto',
        }
      : {}),
  };
}

function parseResponse(data: OAIChatResponse, latencyMs: number): Omit<ChatResponse, 'modelId'> {
  if (data.error?.message) throw new ProviderError('server-error', data.error.message, undefined, true);
  const choice = data.choices?.[0];
  const calls: ToolCallRequest[] = (choice?.message?.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeJson(tc.function.arguments),
  }));
  const usage: TokenUsage = {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    costUsd: data.usage?.cost ?? (data.usage ? estimateCost({ inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0, costUsd: 0 }, { input: 0, output: 0 }) : 0),
  };
  return {
    providerId: '',
    modelKey: data.model ?? '',
    content: choice?.message?.content ?? '',
    toolCalls: calls,
    finishReason: calls.length ? 'tool-calls' : choice?.finish_reason === 'length' ? 'length' : 'stop',
    usage,
    latencyMs,
  };
}

function safeJson(text: string): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
  } catch {
    return { raw: text };
  }
}

/** Kaba token tahmini (sağlayıcı kullanım bilgisi vermediğinde). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

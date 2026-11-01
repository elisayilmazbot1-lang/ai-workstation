/**
 * Google Gemini adaptörü — generativelanguage API.
 *
 * Ücretsiz katman: Google AI Studio anahtarıyla kota dahilinde ücretsiz
 * kullanım sunulur. Bu bilgi katalogda `free-tier` olarak işaretlenir ve
 * kota bitince 429 ile karşılaşılır.
 */
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ProviderAdapter,
  ProviderCredentials,
  ProviderModelInfo,
  ToolCallRequest,
} from '../../../shared/types/models.js';
import { ProviderError } from '../errors.js';
import { httpJson, httpStream, sseLines } from '../http.js';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { message?: string; status?: string; code?: number };
  modelVersion?: string;
}

interface GeminiModelList {
  models?: Array<{
    name?: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }>;
}

function toGeminiContents(request: ChatRequest): { systemInstruction?: { parts: GeminiPart[] }; contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> } {
  const systemParts: GeminiPart[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];
  for (const m of request.messages) {
    if (m.role === 'system') {
      systemParts.push({ text: m.content });
      continue;
    }
    if (m.role === 'tool') {
      contents.push({ role: 'user', parts: [{ functionResponse: { name: m.name ?? 'tool', response: { result: m.content } } }] });
      continue;
    }
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    const part: GeminiPart = { text: m.content };
    if (last && last.role === role) last.parts.push(part);
    else contents.push({ role, parts: [part] });
  }
  return { systemInstruction: systemParts.length ? { parts: systemParts } : undefined, contents };
}

export function createGoogleAdapter(): ProviderAdapter {
  const baseFor = (c: ProviderCredentials) => (c.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const url = (c: ProviderCredentials, path: string, key: string) => `${baseFor(c)}/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
  const keyFor = (c: ProviderCredentials): string => {
    if (!c.apiKey) throw new ProviderError('auth', 'Google Gemini için API anahtarı gerekli.');
    return c.apiKey;
  };

  return {
    kind: 'google',

    async listModels(credentials) {
      const key = keyFor(credentials);
      const { data } = await httpJson<GeminiModelList>(url(credentials, 'models?pageSize=200', key), { timeoutMs: 20_000, retries: 1 });
      return (data.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map<ProviderModelInfo>((m) => ({
          modelKey: (m.name ?? '').replace(/^models\//, ''),
          displayName: m.displayName ?? m.name ?? '',
          contextLength: m.inputTokenLimit,
          maxOutputTokensHint: undefined,
          supportsVision: /gemini|vision/i.test(m.name ?? ''),
          supportsTools: true,
        }) as ProviderModelInfo);
    },

    async testConnection(credentials) {
      const started = Date.now();
      try {
        await httpJson(url(credentials, 'models?pageSize=1', keyFor(credentials)), { timeoutMs: 15_000, retries: 0 });
        return { ok: true, latencyMs: Date.now() - started, message: 'Bağlantı başarılı.' };
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError('unknown', String(err));
        return { ok: false, latencyMs: Date.now() - started, message: pe.toUserMessage() };
      }
    },

    async chat(request, credentials) {
      const key = keyFor(credentials);
      const { systemInstruction, contents } = toGeminiContents(request);
      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxOutputTokens,
        },
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(request.tools?.length
          ? {
              tools: [
                {
                  functionDeclarations: request.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                  })),
                },
              ],
            }
          : {}),
      };
      const { data, latencyMs } = await httpJson<GeminiResponse>(
        url(credentials, `models/${encodeURIComponent(request.modelKey)}:generateContent`, key),
        { method: 'POST', body, timeoutMs: request.timeoutMs ?? 120_000, signal: request.signal },
      );
      if (data.error?.message) throw new ProviderError('server-error', data.error.message, undefined, true);
      return toChatResponse(data, latencyMs, request.modelKey);
    },

    async chatStream(request, credentials, onEvent: (e: ChatStreamEvent) => void) {
      const key = keyFor(credentials);
      const { systemInstruction, contents } = toGeminiContents(request);
      const body: Record<string, unknown> = {
        contents,
        generationConfig: { temperature: request.temperature ?? 0.2, maxOutputTokens: request.maxOutputTokens },
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(request.tools?.length
          ? { tools: [{ functionDeclarations: request.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }] }
          : {}),
      };
      const { response, latencyMs } = await httpStream(
        url(credentials, `models/${encodeURIComponent(request.modelKey)}:streamGenerateContent?alt=sse`, key),
        { method: 'POST', body, timeoutMs: request.timeoutMs ?? 180_000, signal: request.signal },
      );

      let content = '';
      const calls: ToolCallRequest[] = [];
      let usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      let finish: ChatResponse['finishReason'] = 'stop';

      for await (const line of sseLines(response, request.signal)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let parsed: GeminiResponse;
        try {
          parsed = JSON.parse(payload) as GeminiResponse;
        } catch {
          continue;
        }
        const parts = parsed.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (p.text) {
            content += p.text;
            onEvent({ type: 'delta', text: p.text });
          }
          if (p.functionCall) {
            const call = { id: `gem_${calls.length}_${Date.now()}`, name: p.functionCall.name, arguments: p.functionCall.args ?? {} };
            calls.push(call);
            onEvent({ type: 'tool-call', call });
          }
        }
        if (parsed.usageMetadata) {
          usage = {
            inputTokens: parsed.usageMetadata.promptTokenCount ?? 0,
            outputTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
            costUsd: 0,
          };
        }
        const reason = parsed.candidates?.[0]?.finishReason;
        if (reason === 'MAX_TOKENS') finish = 'length';
      }

      const result: Omit<ChatResponse, 'modelId'> = {
        providerId: '',
        modelKey: request.modelKey,
        content,
        toolCalls: calls,
        finishReason: calls.length ? 'tool-calls' : finish,
        usage,
        latencyMs,
      };
      onEvent({ type: 'usage', usage });
      onEvent({ type: 'done', response: { ...result, modelId: request.modelId } });
      return result;
    },
  };
}

function toChatResponse(data: GeminiResponse, latencyMs: number, modelKey: string): Omit<ChatResponse, 'modelId'> {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const content = parts.map((p) => p.text ?? '').join('');
  const calls: ToolCallRequest[] = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({ id: `gem_${i}_${Date.now()}`, name: p.functionCall!.name, arguments: p.functionCall!.args ?? {} }));
  return {
    providerId: '',
    modelKey: data.modelVersion ?? modelKey,
    content,
    toolCalls: calls,
    finishReason: calls.length ? 'tool-calls' : data.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      costUsd: 0,
    },
    latencyMs,
  };
}

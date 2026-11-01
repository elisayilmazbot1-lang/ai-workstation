/**
 * Anthropic (Claude) adaptörü — Messages API.
 *
 * Not: Anthropic, OpenAI protokolü kullanmaz. Sistem iletisi ayrı alanda
 * gönderilir; araç çağrıları `tool_use` / `tool_result` bloklarıdır.
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

const DEFAULT_BASE = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  id?: string;
  type?: string;
  role?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
  error?: { type?: string; message?: string };
  model?: string;
}

function toAnthropicMessages(messages: ChatRequest['messages']): { system?: string; messages: AnthropicMessage[] } {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
      continue;
    }
    if (m.role === 'tool') {
      const last = out[out.length - 1];
      const block: AnthropicContentBlock = { type: 'tool_result', tool_use_id: m.toolCallId ?? '', content: m.content };
      if (last && last.role === 'user' && Array.isArray(last.content)) last.content.push(block);
      else out.push({ role: 'user', content: [block] });
      continue;
    }
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  return { system: systemParts.length ? systemParts.join('\n\n') : undefined, messages: out };
}

export function createAnthropicAdapter(): ProviderAdapter {
  const baseFor = (c: ProviderCredentials) => (c.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const headersFor = (c: ProviderCredentials) => {
    if (!c.apiKey) throw new ProviderError('auth', 'Anthropic için API anahtarı gerekli.');
    return {
      'x-api-key': c.apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'false',
    };
  };

  return {
    kind: 'anthropic',

    async listModels(credentials) {
      // Anthropic resmî model listesi uç noktası sunar.
      const { data } = await httpJson<{ data?: Array<{ id: string; display_name?: string; created_at?: string }>; error?: { message?: string } }>(
        `${baseFor(credentials)}/models`,
        { headers: headersFor(credentials), timeoutMs: 20_000, retries: 1 },
      );
      return (data.data ?? []).map<ProviderModelInfo>((m) => ({
        modelKey: m.id,
        displayName: m.display_name ?? m.id,
        contextLength: undefined,
        supportsVision: true,
        supportsTools: true,
      }));
    },

    async testConnection(credentials) {
      const started = Date.now();
      try {
        await httpJson(`${baseFor(credentials)}/models`, { headers: headersFor(credentials), timeoutMs: 15_000, retries: 0 });
        return { ok: true, latencyMs: Date.now() - started, message: 'Bağlantı başarılı.' };
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError('unknown', String(err));
        return { ok: false, latencyMs: Date.now() - started, message: pe.toUserMessage() };
      }
    },

    async chat(request, credentials) {
      const { system, messages } = toAnthropicMessages(request.messages);
      const body: Record<string, unknown> = {
        model: request.modelKey,
        max_tokens: request.maxOutputTokens ?? 4096,
        temperature: request.temperature ?? 0.2,
        messages,
        ...(system ? { system } : {}),
        ...(request.tools?.length
          ? {
              tools: request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
            }
          : {}),
      };
      const { data, latencyMs } = await httpJson<AnthropicResponse>(`${baseFor(credentials)}/messages`, {
        method: 'POST',
        headers: headersFor(credentials),
        body,
        timeoutMs: request.timeoutMs ?? 120_000,
        signal: request.signal,
      });
      if (data.error?.message) throw new ProviderError('server-error', data.error.message, undefined, true);
      return toChatResponse(data, latencyMs, request.modelKey);
    },

    async chatStream(request, credentials, onEvent: (e: ChatStreamEvent) => void) {
      const { system, messages } = toAnthropicMessages(request.messages);
      const body = {
        model: request.modelKey,
        max_tokens: request.maxOutputTokens ?? 4096,
        temperature: request.temperature ?? 0.2,
        messages,
        stream: true,
        ...(system ? { system } : {}),
        ...(request.tools?.length
          ? { tools: request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
          : {}),
      };
      const { response, latencyMs } = await httpStream(`${baseFor(credentials)}/messages`, {
        method: 'POST',
        headers: headersFor(credentials),
        body,
        timeoutMs: request.timeoutMs ?? 180_000,
        signal: request.signal,
      });

      let content = '';
      let finish: ChatResponse['finishReason'] = 'stop';
      const calls: ToolCallRequest[] = [];
      const pending = new Map<number, { id: string; name: string; json: string }>();
      let usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

      for await (const line of sseLines(response, request.signal)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }
        const type = String(evt.type ?? '');
        if (type === 'content_block_start') {
          const block = evt.content_block as AnthropicContentBlock | undefined;
          if (block?.type === 'tool_use' && typeof evt.index === 'number') {
            pending.set(evt.index, { id: block.id ?? '', name: block.name ?? '', json: '' });
          }
        } else if (type === 'content_block_delta') {
          const delta = evt.delta as { type?: string; text?: string; partial_json?: string } | undefined;
          if (delta?.type === 'text_delta' && delta.text) {
            content += delta.text;
            onEvent({ type: 'delta', text: delta.text });
          }
          if (delta?.type === 'input_json_delta' && typeof evt.index === 'number') {
            const p = pending.get(evt.index);
            if (p) p.json += delta.partial_json ?? '';
          }
        } else if (type === 'content_block_stop' && typeof evt.index === 'number') {
          const p = pending.get(evt.index);
          if (p && p.name) {
            let args: Record<string, unknown> = {};
            try {
              args = p.json ? (JSON.parse(p.json) as Record<string, unknown>) : {};
            } catch {
              args = { raw: p.json };
            }
            const call = { id: p.id, name: p.name, arguments: args };
            calls.push(call);
            onEvent({ type: 'tool-call', call });
            pending.delete(evt.index);
          }
        } else if (type === 'message_delta') {
          const d = evt.delta as { stop_reason?: string } | undefined;
          if (d?.stop_reason === 'tool_use') finish = 'tool-calls';
          else if (d?.stop_reason === 'max_tokens') finish = 'length';
          const u = evt.usage as { output_tokens?: number } | undefined;
          if (u?.output_tokens) usage.outputTokens = u.output_tokens;
        } else if (type === 'message_start') {
          const msg = evt.message as AnthropicResponse | undefined;
          usage.inputTokens = msg?.usage?.input_tokens ?? 0;
        } else if (type === 'error') {
          const e = evt.error as { message?: string } | undefined;
          throw new ProviderError('server-error', e?.message ?? 'Akış hatası', undefined, true);
        }
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

function toChatResponse(data: AnthropicResponse, latencyMs: number, modelKey: string): Omit<ChatResponse, 'modelId'> {
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  const calls: ToolCallRequest[] = (data.content ?? [])
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id ?? '', name: b.name ?? '', arguments: b.input ?? {} }));
  return {
    providerId: '',
    modelKey: data.model ?? modelKey,
    content: text,
    toolCalls: calls,
    finishReason: calls.length ? 'tool-calls' : data.stop_reason === 'max_tokens' ? 'length' : 'stop',
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      costUsd: 0,
    },
    latencyMs,
  };
}

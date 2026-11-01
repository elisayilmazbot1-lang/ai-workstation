/**
 * Arayüz ↔ yerel servis köprüsü.
 *
 * Tarayıcıda göreli `/api` yolu (Vite proxy kullanır), Electron'da aynı
 * yollar IPC üzerinden ana süreçteki Fastify'a iletilir. Üst katman hangi
 * ortamda çalıştığını bilmek zorunda değildir.
 */
import type { HttpMethod, RouteBody, RouteKey, RouteQuery, RouteResult } from '@shared/types/api';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: string[];
  approvalId?: string;
}

export interface ElectronBridge {
  invoke(request: { method: string; path: string; body?: unknown; query?: Record<string, string> }): Promise<{
    status: number;
    body: unknown;
  }>;
  onEvent(callback: (event: unknown) => void): () => void;
  /** Akışlı istek (SSE). `file://` altında göreli fetch çalışmadığı için kullanılır. */
  stream?(
    request: { path: string; body?: unknown },
    onChunk: (raw: string) => void,
    onEnd: () => void,
  ): Promise<{ status: number; ok: boolean }>;
  platform: string;
  versions: Record<string, string>;
  appDataDir?: string;
  safeStorageAvailable: boolean;
}

declare global {
  interface Window {
    aiWorkstation?: ElectronBridge;
  }
}

export const isDesktop = Boolean(window.aiWorkstation);

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

/** Yol şablonundaki :param alanlarını doldurur. */
export function fillPath(template: string, params: Record<string, string | number>): string {
  return template.replace(/:([a-zA-Z0-9_]+)/g, (_m, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Eksik yol parametresi: ${key}`);
    return encodeURIComponent(String(value));
  });
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
  const cleanQuery = query
    ? Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    : undefined;

  if (window.aiWorkstation) {
    const result = await window.aiWorkstation.invoke({ method, path, body, query: cleanQuery });
    if (result.status >= 400) {
      const payload = (result.body ?? {}) as { error?: string; message?: string; details?: string[]; approvalId?: string };
      throw makeError(result.status, payload.message ?? 'İşlem başarısız.', payload.error, payload.details, payload.approvalId);
    }
    return result.body as T;
  }

  const response = await fetch(buildUrl(path, cleanQuery), {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;
  if (!response.ok) {
    const payload = (parsed ?? {}) as { error?: string; message?: string; details?: string[]; approvalId?: string };
    throw makeError(response.status, payload.message ?? `İstek başarısız (${response.status}).`, payload.error, payload.details, payload.approvalId);
  }
  return parsed as T;
}

function makeError(status: number, message: string, code?: string, details?: string[], approvalId?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  error.details = details;
  error.approvalId = approvalId;
  return error;
}

/** Tipli çağrı: anahtar, gövde ve sorgu sözleşmeden türetilir. */
export async function api<K extends RouteKey>(
  key: K,
  options: {
    params?: Record<string, string | number>;
    body?: RouteBody<K>;
    query?: RouteQuery<K>;
  } = {},
): Promise<RouteResult<K>> {
  const [method, template] = key.split(' ') as [HttpMethod, string];
  const path = options.params ? fillPath(template, options.params) : template;
  return request<RouteResult<K>>(method, path, options.body, options.query as Record<string, string | number | undefined> | undefined);
}

/** SSE benzeri canlı olay akışı — hem tarayıcıda hem Electron'da çalışır. */
export function subscribeEvents(onEvent: (event: unknown) => void): () => void {
  if (window.aiWorkstation) return window.aiWorkstation.onEvent(onEvent);

  const source = new EventSource('/api/events');
  const handler = (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      /* yoksay */
    }
  };
  source.addEventListener('message', handler);
  return () => {
    source.removeEventListener('message', handler);
    source.close();
  };
}

/** Sohbet akışı: parça parça metin. */
export async function streamChat(
  payload: { modelId: string; messages: Array<{ role: string; content: string }>; threadId?: string; temperature?: number; maxOutputTokens?: number },
  onEvent: (event: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (window.aiWorkstation?.stream) {
    // DÜZELTME (üçüncü denetim): burada daha önce göreli `fetch('/api/...')`
    // vardı. Üretimde sayfa `file://` şemasından yüklendiği için bu istek
    // `file:///api/chat/stream` oluyor ve hiçbir yere ulaşmıyordu; sohbet
    // yanıtı arayüze gelmiyordu. Akış artık IPC üzerinden alınır.
    await new Promise<void>((resolve, reject) => {
      if (!window.aiWorkstation?.stream) {
        reject(new Error('Akış köprüsü kullanılamıyor.'));
        return;
      }
      void window.aiWorkstation
        .stream({ path: '/api/chat/stream', body: payload }, (raw) => {
          try {
            onEvent(JSON.parse(raw) as Record<string, unknown>);
          } catch {
            /* bozuk satır yoksayılır */
          }
        }, resolve)
        .then((result) => {
          if (!result.ok) reject(new Error(`Akış başlatılamadı (${result.status}).`));
        })
        .catch(reject);
      signal?.addEventListener('abort', () => resolve());
    });
    return;
  }
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  await consumeSse(response, onEvent);
}

async function consumeSse(response: Response, onEvent: (event: Record<string, unknown>) => void): Promise<void> {
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    let message = `Akış başlatılamadı (${response.status}).`;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message;
    } catch {
      /* yoksay */
    }
    throw makeError(response.status, message, 'STREAM_FAILED');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf('\n\n');
    while (idx >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
        } catch {
          /* yoksay */
        }
      }
      idx = buffer.indexOf('\n\n');
    }
  }
}

export const apiClient = { api, request, subscribeEvents, streamChat, isDesktop };

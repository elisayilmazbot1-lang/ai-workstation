/**
 * Sağlayıcı HTTP istemcisi.
 *
 * - Zaman aşımı ve iptal (AbortSignal) desteği
 * - 429/5xx için sınırlı yeniden deneme (üstel geri çekilme + jitter)
 * - Retry-After başlığına saygı
 * - Tüm hatalar ProviderError'a normalize edilir
 */
import { ProviderError, classifyFetchError, classifyHttpStatus } from './errors.js';

export interface HttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  retries?: number;
  /** 429/5xx dışında da denenecekse true. */
  retryOnBadRequest?: boolean;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new ProviderError('timeout', 'İstek iptal edildi.', undefined, false));
      },
      { once: true },
    );
  });

export async function httpJson<T>(url: string, options: HttpOptions = {}): Promise<{ data: T; status: number; latencyMs: number }> {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 60_000;
  let attempt = 0;
  let lastError: ProviderError | undefined;

  while (attempt <= retries) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;
      const text = await response.text();

      if (!response.ok) {
        const errorClass = classifyHttpStatus(response.status);
        const retryable = errorClass === 'rate-limited' || errorClass === 'server-error';
        const detail = text.slice(0, 800);
        if (retryable && attempt < retries) {
          const retryAfter = Number(response.headers.get('retry-after'));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt + Math.random() * 250;
          lastError = new ProviderError(errorClass, `Sağlayıcı ${response.status} döndü.`, response.status, true, detail);
          await sleep(Math.min(wait, 8000), options.signal);
          attempt += 1;
          continue;
        }
        throw new ProviderError(errorClass, `Sağlayıcı ${response.status} döndü.`, response.status, retryable, detail);
      }

      let data: T;
      try {
        data = text.length ? (JSON.parse(text) as T) : (undefined as T);
      } catch {
        throw new ProviderError('bad-request', 'Sağlayıcı geçerli JSON döndürmedi.', response.status, false, text.slice(0, 400));
      }
      return { data, status: response.status, latencyMs };
    } catch (err) {
      const pe = err instanceof ProviderError ? err : new ProviderError(classifyFetchError(err), (err as Error).message ?? 'Ağ hatası', undefined, true);
      lastError = pe;
      if (!pe.retryable || attempt >= retries) throw pe;
      await sleep(300 * 2 ** attempt + Math.random() * 200, options.signal);
      attempt += 1;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError ?? new ProviderError('unknown', 'Sağlayıcıya ulaşılamadı.');
}

/** Server-Sent Events akışını satır satır çözer. */
export async function* sseLines(response: Response, signal?: AbortSignal): AsyncGenerator<string> {
  if (!response.body) throw new ProviderError('server-error', 'Akış gövdesi boş.', response.status, true);
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', onAbort, { once: true });

  /**
   * İptal, "akış bitti" DEĞİLDİR.
   *
   * `reader.cancel()` yalnızca okuyucuyu kapatır; döngü `done: true` ile sessizce
   * biter. Bu durumda çağıran taraf akışın tamamlandığını sanır ve yarım yanıtı
   * tam yanıt olarak kaydeder (E-48 hatası). Bu yüzden abort edildiyse açıkça
   * `AbortError` fırlatılır.
   */
  const throwIfAborted = () => {
    if (!signal?.aborted) return;
    const err = new Error('Akış iptal edildi.');
    err.name = 'AbortError';
    throw err;
  };

  try {
    for (;;) {
      throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        // Okuyucu kapanmadan hemen önce iptal gelmiş olabilir.
        throwIfAborted();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line.length > 0) yield line;
        throwIfAborted();
        idx = buffer.indexOf('\n');
      }
    }
    throwIfAborted();
    if (buffer.trim().length) yield buffer.trim();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    try {
      reader.releaseLock();
    } catch {
      /* yoksay */
    }
  }
}

export async function httpStream(
  url: string,
  options: HttpOptions,
): Promise<{ response: Response; latencyMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: options.method ?? 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ProviderError(classifyHttpStatus(response.status), `Sağlayıcı ${response.status} döndü.`, response.status, false, text.slice(0, 600));
    }
    // Akış sürerken zaman aşımını kaldır, iptali dinlemeye devam et.
    clearTimeout(timer);
    return { response, latencyMs: Date.now() - started };
  } catch (err) {
    clearTimeout(timer);
    throw err instanceof ProviderError ? err : new ProviderError(classifyFetchError(err), (err as Error).message, undefined, true);
  } finally {
    // onAbort dinleyicisi akış bitene kadar gerekli; stream tüketimi çağıranda.
    setTimeout(() => options.signal?.removeEventListener('abort', onAbort), 0);
  }
}

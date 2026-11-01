/** Sağlayıcı hatalarının sınıflandırılması (şartname §17). */
import type { NetworkErrorClass } from '../../shared/types/models.js';

export class ProviderError extends Error {
  constructor(
    public readonly errorClass: NetworkErrorClass,
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = errorClass === 'rate-limited' || errorClass === 'server-error' || errorClass === 'timeout',
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  toUserMessage(): string {
    switch (this.errorClass) {
      case 'offline':
        return 'İnternet bağlantısı yok görünüyor. Bağlantınızı kontrol edin.';
      case 'dns':
        return 'Sağlayıcı adresi çözümlenemedi (DNS). Ağ veya DNS ayarlarını kontrol edin.';
      case 'timeout':
        return 'Sağlayıcı zamanında yanıt vermedi. Daha hızlı bir model deneyin veya süreyi artırın.';
      case 'connection-reset':
        return 'Bağlantı sağlayıcı tarafından kesildi. Tekrar denenecek.';
      case 'rate-limited':
        return 'Sağlayıcı hız sınırına takıldınız. Kısa bir süre sonra tekrar deneyin veya yedek model kullanın.';
      case 'auth':
        return 'API anahtarı geçersiz veya yetkisiz. Sağlayıcı ayarlarından anahtarı kontrol edin.';
      case 'quota':
        return 'Kota veya kredi tükendi. Ücretsiz kotanız dolmuş olabilir; başka bir sağlayıcı seçin.';
      case 'server-error':
        return 'Sağlayıcı tarafında geçici bir hata oluştu. Yedek model devreye alınacak.';
      case 'bad-request':
        return 'İstek sağlayıcı tarafından reddedildi. Model ve parametreleri kontrol edin.';
      default:
        return 'Sağlayıcı ile iletişimde bilinmeyen bir hata oluştu.';
    }
  }
}

export function classifyHttpStatus(status: number): NetworkErrorClass {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server-error';
  if (status >= 400) return 'bad-request';
  return 'unknown';
}

/** Node fetch/TLS hatalarını sınıfa çevirir. */
export function classifyFetchError(err: unknown): NetworkErrorClass {
  const e = err as NodeJS.ErrnoException & { name?: string };
  const code = e?.code ?? '';
  const msg = `${e?.name ?? ''} ${e?.message ?? ''}`;
  if (/ENOTFOUND|EAI_AGAIN/.test(code) || /EAI_AGAIN|getaddrinfo/i.test(msg)) return 'dns';
  if (/ECONNRESET|EPIPE|ECONNABORTED/.test(code)) return 'connection-reset';
  if (/ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT/.test(code) || /timeout/i.test(msg))
    return 'timeout';
  if (/ENETUNREACH|ECONNREFUSED|EHOSTUNREACH/.test(code)) return 'offline';
  if (/abort/i.test(msg)) return 'timeout';
  return 'unknown';
}

export function toProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  return new ProviderError(classifyFetchError(err), (err as Error)?.message ?? 'Bilinmeyen hata', undefined, true);
}

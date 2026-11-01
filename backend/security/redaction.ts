/**
 * Gizli bilgi maskeleme.
 *
 * Günlükler, hata mesajları ve arayüze dönen teknik ayrıntılar buradan
 * geçirilir. Amaç: anahtar sızıntısını imkânsız hale getirmek (şartname §14.3).
 */

const PATTERNS: Array<{ name: string; re: RegExp; replace: (m: string) => string }> = [
  // OpenAI / OpenRouter / DeepSeek / Groq benzeri anahtarlar
  { name: 'sk-key', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replace: () => 'sk-***REDACTED***' },
  { name: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g, replace: () => 'sk-ant-***REDACTED***' },
  { name: 'google', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g, replace: () => 'AIza***REDACTED***' },
  { name: 'xai', re: /\bxai-[A-Za-z0-9]{20,}\b/g, replace: () => 'xai-***REDACTED***' },
  { name: 'huggingface', re: /\bhf_[A-Za-z0-9]{20,}\b/g, replace: () => 'hf_***REDACTED***' },
  { name: 'bearer', re: /(Bearer\s+)[A-Za-z0-9._-]{12,}/gi, replace: (m) => m.replace(/[A-Za-z0-9._-]{12,}$/, '***REDACTED***') },
  { name: 'generic-secret', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*["']?([A-Za-z0-9._-]{12,})["']?/gi, replace: (m) => {
      const idx = m.search(/[:=]/);
      if (idx < 0) return m;
      return `${m.slice(0, idx + 1)} ***REDACTED***`;
    } },
];

export function redact(input: string): string {
  if (!input) return input;
  let out = input;
  for (const p of PATTERNS) out = out.replace(p.re, p.replace);
  return out;
}

/** Nesne ağacındaki tüm metinleri maskeleyerek derin kopya üretir. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretField(k)) {
        out[k] = '***REDACTED***';
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

const SECRET_FIELD_PATTERN = /^(api[_-]?key|apikey|secret|secret[_-]?key|password|passwd|access[_-]?token|auth[_-]?token|refresh[_-]?token|bearer|credential|credentials|private[_-]?key)$/i;

/** Bir nesne alanının gizli bilgi taşıyıp taşımadığını belirler. */
export function isSecretField(key: string): boolean {
  return SECRET_FIELD_PATTERN.test(key.trim());
}

/** Gizli değeri bulmak için: verilen anahtar metinde geçiyor mu? */
export function containsSecret(text: string, secret: string): boolean {
  if (!secret || secret.length < 8) return false;
  return text.includes(secret);
}

/**
 * Serbest metinden (komut çıktısı, günlük satırı) kimlik bilgisi kalıplarını
 * temizler. Ölçüm alanları (token sayıları) etkilenmez.
 */
export function redactText(text: string): string {
  if (!text) return text;
  return text
    // key=value / key: value biçimindeki anahtarlar
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|secret|password|passwd|client[_-]?secret)\b\s*[:=]\s*["']?([^\s"']{6,})/gi, (match, key: string) => `${key}=***REDACTED***`)
    // Bilinen sağlayıcı anahtar kalıpları
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/g, 'sk-***REDACTED***')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{16,}/g, 'sk-ant-***REDACTED***')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, 'AIza***REDACTED***')
    .replace(/\bxai-[A-Za-z0-9]{16,}/g, 'xai-***REDACTED***')
    .replace(/\bhf_[A-Za-z0-9]{20,}/g, 'hf_***REDACTED***')
    .replace(/\bghp_[A-Za-z0-9]{20,}/g, 'ghp_***REDACTED***')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, 'Bearer ***REDACTED***');
}

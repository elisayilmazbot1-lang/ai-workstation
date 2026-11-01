/** Uygulama genelinde sabitler. Değerler tek yerden yönetilir. */

export const APP_NAME = 'AI Workstation';
export const APP_NAME_TR = 'AI WORKSTATION';

/**
 * UYGULAMA sürümü — `package.json` ile birebir aynı olmak zorundadır
 * (`npm run verify` bunu denetler). Şartname sürümünden BAĞIMSIZDIR.
 */
export const APP_VERSION = '1.0.0';

/**
 * ŞARTNAME sürümü — uygulama sürümünden BAĞIMSIZDIR.
 * Şartname (spec/AI_WORKSTATION_SPEC_v2.md) güncellendiğinde yalnız bu artar;
 * uygulama sürümü yalnız kod/dağıtım değiştiğinde artar.
 */
export const SPEC_VERSION = '2.0';
export const SPEC_ID = 'AWS-SPEC-2.0';
/** Bu uygulama sürümünün hedeflediği şartname sürümü (izlenebilirlik). */
export const IMPLEMENTS_SPEC = '2.0';

/** Yerel backend servisinin varsayılan portu (yalnızca 127.0.0.1'e bağlanır). */
export const DEFAULT_BACKEND_PORT = 47110;

/** Varsayılan görev/komut sınırları. */
export const LIMITS = {
  maxFileReadBytes: 2 * 1024 * 1024,
  maxSearchResults: 200,
  maxTreeDepth: 12,
  maxCommandOutputBytes: 512 * 1024,
  maxParallelTasks: 3,
  defaultCommandTimeoutMs: 120_000,
  defaultRequestTimeoutMs: 120_000,
  approvalTtlMinutes: 30,
} as const;

/** Onay gerektiren işlem risk eşikleri. */
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const FREE_STATUS_LABEL_TR: Record<string, string> = {
  free: 'Ücretsiz',
  'free-tier': 'Ücretsiz kota',
  paid: 'Ücretli',
  unknown: 'Doğrulanmadı',
};

export const LINK_TYPE_LABEL_TR: Record<string, string> = {
  'free-api': 'Ücretsiz resmî API',
  'metered-api': 'Kullanım başına ücretli API',
  'key-required': 'API anahtarı gerekli',
  local: 'Yerel servis',
  unsupported: 'Doğrudan entegrasyon mevcut değil',
};

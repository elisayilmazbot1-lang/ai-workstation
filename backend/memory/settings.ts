/**
 * Ayarlar servisi.
 *
 * Ayarlar JSON olarak tek anahtar altında saklanır; şema doğrulaması
 * varsayılanlarla birleştirme (deep merge) ile yapılır. API anahtarları
 * burada tutulmaz (bkz. SecretStore).
 */
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { AppSettings } from '../../shared/types/app.js';
import { LIMITS } from '../../shared/constants.js';

export const DEFAULT_SETTINGS: AppSettings = {
  general: { language: 'tr', theme: 'dark', startMinimized: false, notifications: true },
  ai: {
    preferFreeModels: true,
    requestTimeoutMs: LIMITS.defaultRequestTimeoutMs,
    maxOutputTokens: 4096,
  },
  agents: { maxParallelTasks: 3, maxParallelRunsPerAgent: 1, autoApproveRisk: 'none' },
  files: { backupBeforeWrite: true, maxFileSizeKb: 2048, respectGitignore: true },
  browser: { requireApprovalForSubmit: true, blockThirdPartyCookies: true },
  terminal: { defaultShell: process.platform === 'win32' ? 'powershell' : 'bash', commandTimeoutMs: LIMITS.defaultCommandTimeoutMs, maxOutputKb: 512 },
  docker: {},
  voice: {
    enabled: false,
    sttProvider: 'webspeech',
    ttsProvider: 'webspeech',
    language: 'tr-TR',
    rate: 1,
    pitch: 1,
  },
  security: { autoApproveLowRisk: false, logSensitiveData: false, emergencyStopShortcut: 'CommandOrControl+Shift+Escape' },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    const current = out[k];
    out[k] = isPlainObject(v) && isPlainObject(current) ? deepMerge(current, v as never) : v;
  }
  return out as T;
}

export class SettingsService {
  private cache?: AppSettings;

  constructor(private readonly db: Db) {}

  get(): AppSettings {
    if (this.cache) return this.cache;
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'app'").get() as { value: string } | undefined;
    let stored: DeepPartial<AppSettings> = {};
    if (row?.value) {
      try {
        stored = JSON.parse(row.value) as DeepPartial<AppSettings>;
      } catch {
        stored = {};
      }
    }
    this.cache = deepMerge(DEFAULT_SETTINGS, stored);
    return this.cache;
  }

  update(patch: DeepPartial<AppSettings>): AppSettings {
    const merged = deepMerge(this.get(), patch);
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('app', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify(merged), nowIso());
    this.cache = merged;
    return merged;
  }

  /** Belirli bir anahtarda geçici değer (ör. testlerde) atamak için. */
  reset(): AppSettings {
    this.db.prepare("DELETE FROM settings WHERE key = 'app'").run();
    this.cache = undefined;
    return this.get();
  }
}

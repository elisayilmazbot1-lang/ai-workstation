/**
 * AI WORKSTATION — Ortak kimlikler ve yardımcı tipler.
 *
 * Bu dosya backend, Electron ve arayüz katmanlarının ortak kullandığı
 * temel tipleri tanımlar. Hiçbir katman bu tipleri kendi lehine
 * değiştirmemelidir; değişiklik yalnızca burada yapılır.
 */

export type ISODate = string;

/**
 * Kimlik tipleri düz `string` takma adlarıdır. Marka (brand) tipi yerine
 * açık adlar kullanılıyor: hata ayıklama kolaylığı ve SQLite katmanıyla
 * doğrudan uyum için bilinçli tercih.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type TaskId = string;
export type ProjectId = string;
export type AgentRunId = string;
export type ChangeId = string;
export type ProviderId = string;
export type ModelId = string;

export function asTaskId(value: string): TaskId {
  return value;
}
export function asProjectId(value: string): ProjectId {
  return value;
}

/** Uygulamanın standart hata zarfı — arayüz ve günlükler bunu kullanır. */
export interface AppErrorShape {
  /** Örn. PROVIDER_TIMEOUT, PATH_OUTSIDE_PROJECT, APPROVAL_REQUIRED */
  code: string;
  /** Kullanıcıya gösterilecek Türkçe mesaj. */
  message: string;
  /** Teknik ayrıntı (gizli bilgi içermez). */
  detail?: string;
  retryable: boolean;
  /** Varsa ilgili modül. */
  module?: string;
  taskId?: string;
  at: ISODate;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppErrorShape };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  code: string,
  message: string,
  detail?: string,
  options: { retryable?: boolean; module?: string; taskId?: string } = {},
): Result<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      detail,
      retryable: options.retryable ?? false,
      module: options.module,
      taskId: options.taskId,
      at: new Date().toISOString(),
    },
  };
}

/** Sayfalama zarfı. */
export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Sağlayıcı fiyatlandırması biliniyorsa hesaplanan maliyet (USD). */
  costUsd: number;
}

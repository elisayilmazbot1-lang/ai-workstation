/**
 * Sağlayıcı ve model kataloğu tipleri.
 *
 * Kritik kural (şartname 5.4): "Ücretsiz olduğu doğrulanmamış bir model
 * ücretsiz olarak etiketlenmeyecektir." Bu yüzden `free` alanı üç durumludur
 * ve `verified` bilgisi sağlayıcı politikasından / canlı testten gelir.
 */
import type { ISODate, ModelId, ProviderId, TokenUsage } from './common.js';

export type { TokenUsage };

export type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'groq'
  | 'huggingface'
  | 'ollama'
  | 'lmstudio'
  | 'custom-openai';

export type AuthKind = 'api-key' | 'none-local' | 'endpoint+optional-key';

/** Bağlantı türü — ücretsiz erişim politikası için ayırt edici alan. */
export type LinkType =
  | 'free-api' // sağlayıcının resmî ücretsiz kotası
  | 'metered-api' // kullanım başına ücretlendirme
  | 'key-required' // anahtar zorunlu, ücretsiz kota garanti değil
  | 'local' // kullanıcının kendi makinesinde çalışan OpenAI uyumlu servis
  | 'unsupported'; // doğrudan entegrasyon mevcut değil

export type Availability = 'unknown' | 'available' | 'degraded' | 'unavailable';

export type ModelCapability =
  | 'coding'
  | 'reasoning'
  | 'research'
  | 'vision'
  | 'files'
  | 'tools'
  | 'long-context'
  | 'fast'
  | 'general';

export type Pricing = {
  /** 1M girdi tokenı başına USD; 0 = ücretsiz katman. */
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
  note?: string;
};

export type ModelFreeStatus =
  | 'free' // sağlayıcı politikası gereği ücretsiz kullanılabilir
  | 'free-tier' // ücretsiz kota var (kota sonrası ücretli)
  | 'paid' // ücretli
  | 'unknown'; // doğrulanmadı — arayüzde "ücretsiz" gösterilmez

export interface ModelRecord {
  id: ModelId;
  providerId: ProviderId;
  /** Sağlayıcının API'sinde kullanılan model anahtarı. */
  modelKey: string;
  displayName: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  capabilities: ModelCapability[];
  supportsVision: boolean;
  supportsTools: boolean;
  supportsFiles: boolean;
  streaming: boolean;
  pricing: Pricing;
  freeStatus: ModelFreeStatus;
  /** Ücretsizlik bilgisinin kaynağı: 'provider-policy' | 'live-check' | 'catalog' */
  freeStatusSource?: string;
  linkType: LinkType;
  availability: Availability;
  lastCheckedAt?: ISODate;
  /** Gerçek testlerle ölçülen puanlar (varsa). Uydurma puan yazılmaz. */
  measured?: Partial<Record<ModelCapability, number>>;
  /** Ölçümün kaç görevden geldiği. 0 ise puan gösterilmez. */
  measurementSamples?: number;
  deprecated?: boolean;
  source: 'bundled' | 'provider-catalog' | 'manual';
}

export interface ProviderRecord {
  id: ProviderId;
  kind: ProviderKind;
  name: string;
  /** Anahtar yalnızca kasada; bu alanda asla ham anahtar tutulmaz. */
  hasCredential: boolean;
  baseUrl?: string;
  enabled: boolean;
  /** Bu sağlayıcı ücretsiz kullanım sunabiliyor mu (politika). */
  offersFreeTier: boolean;
  authKind: AuthKind;
  lastTestAt?: ISODate;
  lastTestOk?: boolean;
  lastTestMessage?: string;
  lastTestLatencyMs?: number;
  createdAt: ISODate;
  /** Kullanıcı tanımlı ise not. */
  notes?: string;
}

export type ProviderHealth = {
  providerId: ProviderId;
  availability: Availability;
  latencyMs?: number;
  checkedAt: ISODate;
  message: string;
  errorClass?: NetworkErrorClass;
};

export type NetworkErrorClass =
  | 'offline'
  | 'dns'
  | 'timeout'
  | 'connection-reset'
  | 'rate-limited'
  | 'auth'
  | 'quota'
  | 'server-error'
  | 'bad-request'
  | 'unknown';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Araç çağrısı kimliği (varsa). */
  toolCallId?: string;
  name?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema. */
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatRequest {
  modelId: ModelId;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  tools?: ToolSchema[];
  /** Sağlayıcı yedekleme zincirini devre dışı bırakır. */
  noFallback?: boolean;
  signal?: AbortSignal;
  /** İstek başına üst sınır (ms). */
  timeoutMs?: number;
  metadata?: { taskId?: string; agentRole?: string; purpose?: string };
}

export interface ChatResponse {
  providerId: ProviderId;
  modelId: ModelId;
  modelKey: string;
  content: string;
  toolCalls: ToolCallRequest[];
  finishReason: 'stop' | 'length' | 'tool-calls' | 'error' | 'aborted';
  usage: TokenUsage;
  latencyMs: number;
  /** Yedekleme kullanıldıysa ilk denenen model. */
  fallbackFrom?: ModelId;
}

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool-call'; call: ToolCallRequest }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; response: ChatResponse }
  | { type: 'error'; error: { code: string; message: string } };

/** Sağlayıcı adaptörü sözleşmesi (bkz. backend/ai/types.ts). */
export interface ProviderAdapter {
  kind: ProviderKind;
  listModels(credentials: ProviderCredentials): Promise<ProviderModelInfo[]>;
  chat(request: ChatRequest & { modelKey: string }, credentials: ProviderCredentials): Promise<Omit<ChatResponse, 'modelId'>>;
  chatStream?(
    request: ChatRequest & { modelKey: string },
    credentials: ProviderCredentials,
    onEvent: (event: ChatStreamEvent) => void,
  ): Promise<Omit<ChatResponse, 'modelId'>>;
  testConnection(credentials: ProviderCredentials): Promise<{ ok: boolean; latencyMs: number; message: string }>;
}

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderModelInfo {
  modelKey: string;
  displayName: string;
  contextLength?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  pricing?: Partial<Pricing>;
  /** Sağlayıcı kataloğu ücretsiz olduğunu bildiriyorsa. */
  freeStatus?: ModelFreeStatus;
  deprecated?: boolean;
}

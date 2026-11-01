/**
 * Hazır model kataloğu (başlangıç verisi).
 *
 * Şartname §5.1: liste sabit yazılmaz, sağlayıcının resmî kataloğundan
 * dinamik alınır. Ancak anahtar girilmeden önce de kullanıcı neyin var
 * olduğunu görebilmelidir. Bu yüzden buradaki kayıtlar yalnızca başlangıç
 * tohumudur (`source: 'bundled'`); sağlayıcı senkronizasyonu bunları
 * günceller.
 *
 * Ücretsizlik bilgisi `freeStatus` alanına, yalnızca sağlayıcı politikası
 * doğrulanabildiğinde yazılır. Emin olunmayan her model `unknown` kalır ve
 * arayüzde "Doğrulanmadı" olarak gösterilir (şartname §5.4).
 */
import type { ModelCapability, ModelFreeStatus, LinkType, Pricing } from '../../shared/types/models.js';
import type { ProviderKind } from '../../shared/types/models.js';

export interface SeedModel {
  providerKind: ProviderKind;
  modelKey: string;
  displayName: string;
  description: string;
  contextLength: number;
  maxOutputTokens?: number;
  capabilities: ModelCapability[];
  pricing: Pricing;
  freeStatus: ModelFreeStatus;
  linkType: LinkType;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

const paid = (input: number, output: number, note?: string): Pricing => ({ inputPerMillionUsd: input, outputPerMillionUsd: output, note });
const free = (): Pricing => ({ inputPerMillionUsd: 0, outputPerMillionUsd: 0, note: 'Sağlayıcı politikası gereği ücretsiz katman' });

export const SEED_MODELS: SeedModel[] = [
  // ---------------- OpenAI ----------------
  {
    providerKind: 'openai',
    modelKey: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'Çok yönlü amiral gemisi model; görsel ve araç desteği.',
    contextLength: 128000,
    capabilities: ['coding', 'reasoning', 'vision', 'tools', 'general', 'files'],
    pricing: paid(2.5, 10),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsVision: true,
    supportsTools: true,
  },
  {
    providerKind: 'openai',
    modelKey: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    description: 'Hızlı ve düşük maliyetli genel amaçlı model.',
    contextLength: 128000,
    capabilities: ['coding', 'fast', 'general', 'tools', 'vision'],
    pricing: paid(0.15, 0.6),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsVision: true,
    supportsTools: true,
  },
  {
    providerKind: 'openai',
    modelKey: 'o3-mini',
    displayName: 'o3-mini',
    description: 'Akıl yürütme odaklı, maliyet etkin model.',
    contextLength: 200000,
    capabilities: ['reasoning', 'coding', 'tools'],
    pricing: paid(1.1, 4.4),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsTools: true,
  },
  // ---------------- Anthropic ----------------
  {
    providerKind: 'anthropic',
    modelKey: 'claude-3-5-sonnet-latest',
    displayName: 'Claude 3.5 Sonnet',
    description: 'Kod inceleme ve uzun bağlamda güçlü; araç kullanımı destekli.',
    contextLength: 200000,
    capabilities: ['coding', 'reasoning', 'research', 'tools', 'files', 'long-context'],
    pricing: paid(3, 15),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsVision: true,
    supportsTools: true,
  },
  {
    providerKind: 'anthropic',
    modelKey: 'claude-3-5-haiku-latest',
    displayName: 'Claude 3.5 Haiku',
    description: 'Hızlı yanıt odaklı Anthropic modeli.',
    contextLength: 200000,
    capabilities: ['fast', 'general', 'tools', 'long-context'],
    pricing: paid(0.8, 4),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsTools: true,
  },
  // ---------------- Google ----------------
  {
    providerKind: 'google',
    modelKey: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Çok uzun bağlam ve araştırma görevleri için.',
    contextLength: 2000000,
    capabilities: ['research', 'long-context', 'coding', 'vision', 'tools', 'files'],
    pricing: paid(1.25, 5, 'Ücretsiz katmanda dakika/gün kotası uygulanır'),
    freeStatus: 'free-tier',
    linkType: 'free-api',
    supportsVision: true,
    supportsTools: true,
  },
  {
    providerKind: 'google',
    modelKey: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Hızlı, ücretsiz kotada kullanılabilen model.',
    contextLength: 1000000,
    capabilities: ['fast', 'general', 'vision', 'tools', 'long-context'],
    pricing: paid(0.075, 0.3, 'Ücretsiz katman mevcut'),
    freeStatus: 'free-tier',
    linkType: 'free-api',
    supportsVision: true,
    supportsTools: true,
  },
  // ---------------- xAI ----------------
  {
    providerKind: 'xai',
    modelKey: 'grok-2-latest',
    displayName: 'Grok 2',
    description: 'xAI genel amaçlı modeli.',
    contextLength: 131072,
    capabilities: ['general', 'coding', 'tools'],
    pricing: paid(2, 10),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsTools: true,
  },
  // ---------------- DeepSeek ----------------
  {
    providerKind: 'deepseek',
    modelKey: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    description: 'Düşük maliyetli sohbet ve kodlama modeli.',
    contextLength: 65536,
    capabilities: ['coding', 'general', 'tools'],
    pricing: paid(0.27, 1.1),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsTools: true,
  },
  {
    providerKind: 'deepseek',
    modelKey: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    description: 'Teknik analiz ve akıl yürütme odaklı.',
    contextLength: 65536,
    capabilities: ['reasoning', 'coding'],
    pricing: paid(0.55, 2.19),
    freeStatus: 'paid',
    linkType: 'metered-api',
  },
  // ---------------- Mistral ----------------
  {
    providerKind: 'mistral',
    modelKey: 'mistral-large-latest',
    displayName: 'Mistral Large',
    description: 'Genel görevler ve çok dilli destek.',
    contextLength: 131072,
    capabilities: ['general', 'coding', 'tools'],
    pricing: paid(2, 6),
    freeStatus: 'paid',
    linkType: 'metered-api',
    supportsTools: true,
  },
  {
    providerKind: 'mistral',
    modelKey: 'open-mistral-nemo',
    displayName: 'Mistral Nemo',
    description: 'Ücretsiz deneme katmanında kullanılabilen açık model.',
    contextLength: 131072,
    capabilities: ['fast', 'general'],
    pricing: free(),
    freeStatus: 'free-tier',
    linkType: 'free-api',
  },
  // ---------------- OpenRouter ----------------
  {
    providerKind: 'openrouter',
    modelKey: 'meta-llama/llama-3.3-70b-instruct:free',
    displayName: 'Llama 3.3 70B Instruct (ücretsiz)',
    description: 'OpenRouter üzerinden ücretsiz sunulan açık model.',
    contextLength: 131072,
    capabilities: ['general', 'coding'],
    pricing: free(),
    freeStatus: 'free',
    linkType: 'free-api',
  },
  {
    providerKind: 'openrouter',
    modelKey: 'deepseek/deepseek-r1:free',
    displayName: 'DeepSeek R1 (ücretsiz)',
    description: 'Akıl yürütme odaklı ücretsiz model.',
    contextLength: 65536,
    capabilities: ['reasoning', 'coding'],
    pricing: free(),
    freeStatus: 'free',
    linkType: 'free-api',
  },
  // ---------------- Groq ----------------
  {
    providerKind: 'groq',
    modelKey: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
    description: 'Groq hızlandırıcıları ile çok hızlı yanıt.',
    contextLength: 131072,
    capabilities: ['fast', 'general', 'coding', 'tools'],
    pricing: free(),
    freeStatus: 'free-tier',
    linkType: 'free-api',
    supportsTools: true,
  },
  // ---------------- Yerel ----------------
  {
    providerKind: 'ollama',
    modelKey: 'llama3.1',
    displayName: 'Llama 3.1 (yerel)',
    description: 'Ollama üzerinden yerel çalışır; donanım kullanır.',
    contextLength: 131072,
    capabilities: ['general', 'coding'],
    pricing: free(),
    freeStatus: 'free',
    linkType: 'local',
  },
];

/** Şartname §5.4: entegrasyonu mümkün olmayan platformlar için açıklama. */
export const UNSUPPORTED_INTEGRATIONS = [
  {
    name: 'LM Arena (sohbet karşılaştırma platformu)',
    reason:
      'Platform, yalnızca kendi web arayüzü üzerinden hizmet verir; resmî API veya izin verilen bir erişim yöntemi yoktur. Modeller "Doğrudan entegrasyon mevcut değil" olarak işaretlenir.',
  },
  {
    name: 'Tüketici web arayüzleri (ChatGPT, Gemini web, Claude web)',
    reason:
      'Oturum çerezlerinin kopyalanması ve koruma mekanizmalarının aşılması yasaktır. Bu platformların kendi resmî API’leri üzerinden bağlantı kurulmalıdır.',
  },
];

/**
 * Adaptör kayıt defteri.
 *
 * Yeni bir sağlayıcı eklemek için: burada bir kayıt oluşturun ve
 * `PROVIDER_CATALOG` içine varsayılan bilgileri ekleyin. Başka hiçbir
 * modülün değişmesi gerekmez (şartname §22 — modüler mimari).
 */
import type { ProviderAdapter, ProviderKind } from '../../../shared/types/models.js';
import { createOpenAiCompatibleAdapter } from './openai-compatible.js';
import { createAnthropicAdapter } from './anthropic.js';
import { createGoogleAdapter } from './google.js';

export interface ProviderBlueprint {
  kind: ProviderKind;
  label: string;
  defaultBaseUrl?: string;
  requiresApiKey: boolean;
  /** Sağlayıcının resmî olarak ücretsiz katman sunduğu doğrulandı mı? */
  offersFreeTier: boolean;
  freeTierNote?: string;
  /** Anahtar edinme sayfası. */
  keyUrl?: string;
  authKind: 'api-key' | 'none-local' | 'endpoint+optional-key';
  /** Katalogdan model çekilebiliyor mu? */
  supportsModelList: boolean;
  category: 'major' | 'router' | 'local' | 'custom';
}

export const PROVIDER_BLUEPRINTS: Record<ProviderKind, ProviderBlueprint> = {
  openai: {
    kind: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    offersFreeTier: false,
    keyUrl: 'https://platform.openai.com/api-keys',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'major',
  },
  anthropic: {
    kind: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    offersFreeTier: false,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'major',
  },
  google: {
    kind: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    offersFreeTier: true,
    freeTierNote: 'Google AI Studio anahtarıyla günlük istek kotası dahilinde ücretsiz katman sunulur; kota bitince 429 alınır.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'major',
  },
  xai: {
    kind: 'xai',
    label: 'xAI (Grok)',
    defaultBaseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
    offersFreeTier: false,
    keyUrl: 'https://console.x.ai',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'major',
  },
  deepseek: {
    kind: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    offersFreeTier: false,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'major',
  },
  mistral: {
    kind: 'mistral',
    label: 'Mistral',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    offersFreeTier: true,
    freeTierNote: 'Mistral, bazı modeller için ücretsiz deneme katmanı sunar; kapsam sağlayıcı politikasına bağlıdır.',
    keyUrl: 'https://console.mistral.ai/api-keys',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'major',
  },
  openrouter: {
    kind: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    offersFreeTier: true,
    freeTierNote: '`models` uç noktasında ":free" sonekli modeller ücretsizdir; hız sınırı uygulanır.',
    keyUrl: 'https://openrouter.ai/keys',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'router',
  },
  groq: {
    kind: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    offersFreeTier: true,
    freeTierNote: 'Groq ücretsiz katman sunar; hız sınırları model bazlıdır.',
    keyUrl: 'https://console.groq.com/keys',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'router',
  },
  huggingface: {
    kind: 'huggingface',
    label: 'Hugging Face',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    requiresApiKey: true,
    offersFreeTier: true,
    freeTierNote: 'Inference Providers üzerinden ücretsiz kotalı deneme sunulur; kapsam hesap planına bağlıdır.',
    keyUrl: 'https://huggingface.co/settings/tokens',
    authKind: 'api-key',
    supportsModelList: true,
    category: 'router',
  },
  ollama: {
    kind: 'ollama',
    label: 'Ollama (yerel)',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    requiresApiKey: false,
    offersFreeTier: true,
    freeTierNote: 'Yerel makinede çalışır; bulut maliyeti yoktur ancak donanım kullanır. Varsayılan olarak kapalıdır.',
    authKind: 'none-local',
    supportsModelList: true,
    category: 'local',
  },
  lmstudio: {
    kind: 'lmstudio',
    label: 'LM Studio (yerel)',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    requiresApiKey: false,
    offersFreeTier: true,
    freeTierNote: 'Yerel makinede çalışır; donanım kullanır. Varsayılan olarak kapalıdır.',
    authKind: 'none-local',
    supportsModelList: true,
    category: 'local',
  },
  'custom-openai': {
    kind: 'custom-openai',
    label: 'Özel OpenAI uyumlu servis',
    requiresApiKey: false,
    offersFreeTier: false,
    authKind: 'endpoint+optional-key',
    supportsModelList: true,
    category: 'custom',
  },
};

const adapterCache = new Map<ProviderKind, ProviderAdapter>();

export function getAdapter(kind: ProviderKind): ProviderAdapter {
  const cached = adapterCache.get(kind);
  if (cached) return cached;

  let adapter: ProviderAdapter;
  switch (kind) {
    case 'anthropic':
      adapter = createAnthropicAdapter();
      break;
    case 'google':
      adapter = createGoogleAdapter();
      break;
    case 'openai':
    case 'xai':
    case 'deepseek':
    case 'mistral':
    case 'openrouter':
    case 'groq':
    case 'huggingface':
    case 'ollama':
    case 'lmstudio':
    case 'custom-openai': {
      const blueprint = PROVIDER_BLUEPRINTS[kind];
      adapter = createOpenAiCompatibleAdapter({
        kind,
        defaultBaseUrl: blueprint.defaultBaseUrl ?? '',
        supportsModelList: blueprint.supportsModelList,
        requiresApiKey: blueprint.requiresApiKey,
      });
      break;
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`Bilinmeyen sağlayıcı türü: ${String(exhaustive)}`);
    }
  }
  adapterCache.set(kind, adapter);
  return adapter;
}

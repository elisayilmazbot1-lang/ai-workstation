/**
 * LLM Gateway — tüm model çağrılarının tek geçiş noktası.
 *
 * Şartname §2-A: Modeller tek merkezden yönetilir. Hiçbir ajan doğrudan
 * sağlayıcıya bağlanmaz; her çağrı buradan geçer.
 *
 * Özellikler:
 *  - Yedekleme zinciri (birincil model → yedek → son çare)
 *  - Otomatik ücretsiz model önceliği (ayar)
 *  - Hata sınıflandırması ve kullanıcı dostu mesaj
 *  - Akış (stream) desteği
 *  - Token/maliyet kaydı
 *  - Hız sınırına saygılı eşzamanlılık kuyruğu
 */
import type { ChatRequest, ChatResponse, ChatStreamEvent, ModelRecord, TokenUsage } from '../../shared/types/models.js';
import { ProviderError } from './errors.js';
import { getAdapter } from './adapters/registry.js';
import type { ProviderService } from './provider-service.js';
import type { SettingsService } from '../memory/settings.js';
import type { AuditService } from '../security/audit.js';

export interface GatewayDeps {
  providers: ProviderService;
  settings: SettingsService;
  audit: AuditService;
}

export interface GatewayUsageHook {
  (usage: TokenUsage, meta: { modelId: string; providerId: string; purpose?: string; taskId?: string; agentRole?: string }): void;
}

export class LlmGateway {
  private usageHook?: GatewayUsageHook;
  private activeRequests = 0;
  private readonly maxConcurrent = 6;
  /** Acil durdurma sırasında tüm akışları iptal etmek için (E-48, §15.4). */
  private readonly abortControllers = new Set<AbortController>();
  private emergency = false;

  constructor(private readonly deps: GatewayDeps) {}

  /** Acil durdurma: bekleyen/yayın yapan TÜM model isteklerini iptal eder. */
  abortAll(reason: 'emergency-stop' | 'user' = 'emergency-stop'): number {
    if (reason === 'emergency-stop') this.emergency = true;
    let count = 0;
    for (const controller of this.abortControllers) {
      try {
        controller.abort();
      } catch {
        /* yoksay */
      }
      count += 1;
    }
    this.abortControllers.clear();
    return count;
  }

  /** Acil durdurma sonrası trafiği yeniden açar. */
  resume(): void {
    this.emergency = false;
  }

  isAborting(): boolean {
    return this.emergency;
  }

  onUsage(hook: GatewayUsageHook): void {
    this.usageHook = hook;
  }

  /** Model bulunamazsa anlaşılır hata üretir. */
  private resolveModel(modelIdOrKey: string): ModelRecord {
    const direct = this.deps.providers.getModel(modelIdOrKey);
    if (direct) return direct;
    // Kullanıcı yalnızca model anahtarı vermiş olabilir (ör. "gpt-4o").
    const all = this.deps.providers.listModels({ q: modelIdOrKey });
    const exact = all.find((m) => m.modelKey === modelIdOrKey);
    if (exact) return exact;
    throw new ProviderError('bad-request', `Model bulunamadı: ${modelIdOrKey}. Model Merkezi'nden sağlayıcı ekleyip katalogu güncelleyin.`);
  }

  /**
   * Yedekleme zincirini hesaplar:
   *  1. İstenen model
   *  2. Ajana tanımlı yedek model (varsa)
   *  3. Ayarlardaki yedek model
   *  4. Ücretsiz ve kullanılabilir ilk model (tercih açıksa)
   */
  private buildFallbackChain(request: ChatRequest, fallbackModelId?: string): string[] {
    const chain: string[] = [request.modelId];
    if (fallbackModelId) chain.push(fallbackModelId);
    const settings = this.deps.settings.get();
    if (settings.ai.fallbackModelId) chain.push(settings.ai.fallbackModelId);
    if (request.noFallback) return [...new Set(chain)];

    const freeModels = this.deps.providers
      .listModels({ free: 'true', sort: 'name' })
      .filter((m) => m.availability !== 'unavailable' && m.supportsTools === false || true)
      .slice(0, 3)
      .map((m) => m.id);
    const paidModels = this.deps.providers
      .listModels({ free: 'false' })
      .slice(0, 2)
      .map((m) => m.id);
    const order = settings.ai.preferFreeModels ? [...freeModels, ...paidModels] : [...paidModels, ...freeModels];
    return [...new Set([...chain, ...order])];
  }

  async chat(
    request: ChatRequest,
    options: { fallbackModelId?: string; purpose?: string; agentRole?: string; taskId?: string } = {},
  ): Promise<ChatResponse> {
    if (this.emergency) {
      const err = new Error('Acil durdurma etkin. Yeni model isteği başlatılamaz.');
      err.name = 'AbortError';
      throw err;
    }
    const chain = this.buildFallbackChain(request, options.fallbackModelId);
    const errors: string[] = [];
    let firstAttempted: string | undefined;
    let resolvedAny = false;

    for (const candidateId of chain) {
      let model: ModelRecord;
      try {
        model = this.resolveModel(candidateId);
      } catch {
        continue;
      }
      resolvedAny = true;
      const provider = this.deps.providers.getProvider(model.providerId);
      if (!provider || !provider.enabled) continue;

      firstAttempted ??= model.id;
      await this.acquire();
      try {
        const adapter = getAdapter(provider.kind);
        const credentials = this.deps.providers.credentialsFor(provider);
        const result = await adapter.chat({ ...request, modelKey: model.modelKey, timeoutMs: request.timeoutMs ?? this.deps.settings.get().ai.requestTimeoutMs }, credentials);
        const response: ChatResponse = {
          ...result,
          modelId: model.id,
          providerId: provider.id,
          usage: withCost(result.usage, model),
          fallbackFrom: model.id !== firstAttempted ? firstAttempted : undefined,
        };
        this.recordUsage(response.usage, model, options);
        if (response.fallbackFrom) {
          this.deps.audit.log({
            module: 'ai.gateway',
            action: 'chat.fallback',
            detail: `${response.fallbackFrom} başarısız, ${model.id} kullanıldı`,
            risk: 'low',
          });
        }
        return response;
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError('unknown', String(err));
        errors.push(`${model.displayName}: ${pe.toUserMessage()}`);
        // Kimlik doğrulama hatasında aynı sağlayıcının diğer modelleri de
        // başarısız olacaktır; zincirde o sağlayıcıyı atla.
        if (pe.errorClass === 'auth') {
          for (const c of chain) {
            const m = this.deps.providers.getModel(c);
            if (m?.providerId === model.providerId) chain.splice(chain.indexOf(c), 1);
          }
        }
      } finally {
        this.release();
      }
    }

    if (!resolvedAny) {
      throw new ProviderError(
        'bad-request',
        `Model bulunamadı: ${request.modelId}. Model Merkezi'nden bir sağlayıcı ekleyip model kataloğunu güncelleyin.`,
        undefined,
        false,
        'Katalogda bu kimliğe veya ada sahip model yok.',
      );
    }
    throw new ProviderError(
      'unknown',
      'Hiçbir model yanıt veremedi. Model Merkezi\'nden sağlayıcı ve anahtar durumunu kontrol edin.',
      undefined,
      false,
      errors.join(' | '),
    );
  }

  async chatStream(
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
    options: { fallbackModelId?: string; purpose?: string; agentRole?: string; taskId?: string } = {},
  ): Promise<ChatResponse> {
    if (this.emergency) {
      const err = new Error('Acil durdurma etkin. Yeni model isteği başlatılamaz.');
      err.name = 'AbortError';
      throw err;
    }
    const chain = this.buildFallbackChain(request, options.fallbackModelId);
    let firstAttempted: string | undefined;
    const errors: string[] = [];
    const controller = new AbortController();
    this.abortControllers.add(controller);
    const signal = { aborted: controller.signal.aborted, controller };
    try {

    for (const candidateId of chain) {
      let model: ModelRecord;
      try {
        model = this.resolveModel(candidateId);
      } catch {
        continue;
      }
      const provider = this.deps.providers.getProvider(model.providerId);
      if (!provider || !provider.enabled) continue;
      firstAttempted ??= model.id;

      const adapter = getAdapter(provider.kind);
      const credentials = this.deps.providers.credentialsFor(provider);
      let emitted = false;

      try {
        await this.acquire();
        let response: Omit<ChatResponse, 'modelId'>;
        if (adapter.chatStream) {
          response = await adapter.chatStream(
            { ...request, modelKey: model.modelKey, signal: controller.signal },
            credentials,
            (event) => {
              if (event.type === 'delta') emitted = true;
              onEvent(event);
            },
          );
        } else {
          response = await adapter.chat({ ...request, modelKey: model.modelKey }, credentials);
          onEvent({ type: 'delta', text: response.content });
        }
        const full: ChatResponse = {
          ...response,
          modelId: model.id,
          providerId: provider.id,
          usage: withCost(response.usage, model),
          fallbackFrom: model.id !== firstAttempted ? firstAttempted : undefined,
        };
        this.recordUsage(full.usage, model, options);
        return full;
      } catch (err) {
        // İptal (acil durdurma / kullanıcı): yedek modele GEÇİLMEZ.
        if (controller.signal.aborted || isAbortError(err)) {
          const abortErr = new Error(this.emergency ? 'Acil durdurma: istek iptal edildi.' : 'İstek iptal edildi.');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        const pe = err instanceof ProviderError ? err : new ProviderError('unknown', String(err));
        errors.push(`${model.displayName}: ${pe.toUserMessage()}`);
        // Akış başladıktan sonra yedek modele geçmek yarım yanıt üretir;
        // bu durumda hatayı iletmek daha dürüsttür.
        if (emitted) {
          onEvent({ type: 'error', error: { code: pe.errorClass, message: pe.toUserMessage() } });
          throw pe;
        }
      } finally {
        this.release();
      }
    }
    throw new ProviderError('unknown', 'Hiçbir model akış başlatamadı.', undefined, false, errors.join(' | '));
    } finally {
      this.abortControllers.delete(controller);
    }
  }

  private recordUsage(
    usage: TokenUsage,
    model: ModelRecord,
    options: { purpose?: string; agentRole?: string; taskId?: string },
  ): void {
    this.deps.providers.recordUsage(usage, {
      taskId: options.taskId,
      agentRole: options.agentRole,
      providerId: model.providerId,
      modelId: model.id,
      purpose: options.purpose,
    });
    this.usageHook?.(usage, { modelId: model.id, providerId: model.providerId, purpose: options.purpose, taskId: options.taskId, agentRole: options.agentRole });
  }

  private async acquire(): Promise<void> {
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise((r) => setTimeout(r, 40));
    }
    this.activeRequests += 1;
  }

  private release(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /** Bağlantı testi olmadan hızlı model sağlık kontrolü. */
  async ping(modelId: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const model = this.resolveModel(modelId);
    const provider = this.deps.providers.getProvider(model.providerId);
    if (!provider) return { ok: false, latencyMs: 0, message: 'Sağlayıcı bulunamadı.' };
    const started = Date.now();
    try {
      const response = await this.chat(
        { modelId: model.id, messages: [{ role: 'user', content: 'ping' }], maxOutputTokens: 8, noFallback: true },
        { purpose: 'ping' },
      );
      return { ok: true, latencyMs: response.latencyMs, message: `Yanıt alındı (${model.displayName}).` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, message: (err as Error).message };
    }
  }
}

function withCost(usage: TokenUsage, model: ModelRecord): TokenUsage {
  if (usage.costUsd > 0) return usage;
  const cost =
    (usage.inputTokens / 1_000_000) * model.pricing.inputPerMillionUsd +
    (usage.outputTokens / 1_000_000) * model.pricing.outputPerMillionUsd;
  return { ...usage, costUsd: Number(cost.toFixed(6)) };
}

/** İptal hatalarını (AbortError / DOMException) tanır. */
export function isAbortError(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string } | null;
  if (!e) return false;
  return e.name === 'AbortError' || e.code === 'ABORT_ERR' || e.name === 'TimeoutError';
}

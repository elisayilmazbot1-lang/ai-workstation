/**
 * Sağlayıcı ve model kataloğu servisi.
 *
 * Sorumluluklar:
 *  - Sağlayıcı CRUD (anahtarlar yalnızca kasada)
 *  - Bağlantı testi
 *  - Resmî katalogdan model senkronizasyonu + tohum katalog
 *  - Model filtreleme/sıralama
 *  - Kullanım (token/maliyet) kaydı
 */
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso, parseJson, toBool } from '../database/db.js';
import type {
  ModelCapability,
  ModelFreeStatus,
  ModelRecord,
  ProviderHealth,
  ProviderKind,
  ProviderRecord,
  LinkType,
  TokenUsage,
} from '../../shared/types/models.js';
import { PROVIDER_BLUEPRINTS, getAdapter } from './adapters/registry.js';
import { SEED_MODELS } from './catalog.js';
import { ProviderError, toProviderError } from './errors.js';
import type { SecretStore } from '../security/secrets.js';
import type { AuditService } from '../security/audit.js';

const CRED_PREFIX = 'provider.';

export interface ProviderServiceDeps {
  db: Db;
  secrets: SecretStore;
  audit: AuditService;
}

export class ProviderService {
  constructor(private readonly deps: ProviderServiceDeps) {}

  /* ------------------------------- Sağlayıcılar ------------------------------ */

  listProviders(): ProviderRecord[] {
    const rows = this.deps.db.prepare('SELECT * FROM providers ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToProvider(r));
  }

  getProvider(id: string): ProviderRecord | undefined {
    const row = this.deps.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToProvider(row) : undefined;
  }

  private rowToProvider(r: Record<string, unknown>): ProviderRecord {
    const id = String(r.id);
    return {
      id,
      kind: r.kind as ProviderKind,
      name: String(r.name),
      hasCredential: this.deps.secrets.has(CRED_PREFIX + id),
      baseUrl: (r.base_url as string) ?? undefined,
      enabled: toBool(r.enabled),
      offersFreeTier: toBool(r.offers_free_tier),
      authKind: (r.auth_kind as ProviderRecord['authKind']) ?? 'api-key',
      lastTestAt: (r.last_test_at as string) ?? undefined,
      lastTestOk: r.last_test_ok === null ? undefined : toBool(r.last_test_ok),
      lastTestMessage: (r.last_test_message as string) ?? undefined,
      lastTestLatencyMs: (r.last_test_latency_ms as number) ?? undefined,
      createdAt: String(r.created_at),
      notes: (r.notes as string) ?? undefined,
    };
  }

  createProvider(input: { kind: ProviderKind; name: string; apiKey?: string; baseUrl?: string; offersFreeTier?: boolean }): ProviderRecord {
    const blueprint = PROVIDER_BLUEPRINTS[input.kind];
    if (!blueprint) throw new ProviderError('bad-request', `Bilinmeyen sağlayıcı türü: ${input.kind}`);
    if (blueprint.requiresApiKey && !input.apiKey && !this.deps.secrets.has(`${CRED_PREFIX}${input.kind}`)) {
      // Anahtar sonradan eklenebilir; burada yalnızca uyarı niteliğinde bilgi tutulur.
    }
    const existing = this.deps.db.prepare('SELECT id FROM providers WHERE kind = ? AND name = ?').get(input.kind, input.name);
    if (existing) throw new ProviderError('bad-request', 'Bu adda bir sağlayıcı zaten ekli.');

    const id = `${input.kind}-${nanoid(6)}`;
    this.deps.db
      .prepare(
        `INSERT INTO providers (id, kind, name, base_url, enabled, offers_free_tier, auth_kind, created_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        id,
        input.kind,
        input.name,
        input.baseUrl ?? blueprint.defaultBaseUrl ?? null,
        input.offersFreeTier ?? blueprint.offersFreeTier ? 1 : 0,
        blueprint.authKind,
        nowIso(),
      );
    if (input.apiKey) this.deps.secrets.set(CRED_PREFIX + id, input.apiKey.trim());

    // Tohum modelleri bu sağlayıcı için kopyala.
    this.seedModelsFor(id, input.kind);
    this.deps.audit.log({ module: 'ai.providers', action: 'provider.create', detail: `${blueprint.label} eklendi`, risk: 'low' });
    return this.getProvider(id)!;
  }

  updateProvider(id: string, patch: { name?: string; apiKey?: string; baseUrl?: string; enabled?: boolean; offersFreeTier?: boolean }): ProviderRecord {
    const current = this.getProvider(id);
    if (!current) throw new ProviderError('bad-request', 'Sağlayıcı bulunamadı.');
    this.deps.db
      .prepare(
        `UPDATE providers SET name = ?, base_url = ?, enabled = ?, offers_free_tier = ? WHERE id = ?`,
      )
      .run(
        patch.name ?? current.name,
        patch.baseUrl ?? current.baseUrl ?? null,
        (patch.enabled ?? current.enabled) ? 1 : 0,
        (patch.offersFreeTier ?? current.offersFreeTier) ? 1 : 0,
        id,
      );
    if (patch.apiKey !== undefined) {
      if (patch.apiKey.trim().length === 0) this.deps.secrets.delete(CRED_PREFIX + id);
      else this.deps.secrets.set(CRED_PREFIX + id, patch.apiKey.trim());
    }
    this.deps.audit.log({ module: 'ai.providers', action: 'provider.update', detail: id, risk: 'low' });
    return this.getProvider(id)!;
  }

  deleteProvider(id: string): void {
    this.deps.secrets.delete(CRED_PREFIX + id);
    this.deps.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
    this.deps.audit.log({ module: 'ai.providers', action: 'provider.delete', detail: id, risk: 'medium' });
  }

  credentialsFor(provider: ProviderRecord): { apiKey?: string; baseUrl?: string } {
    return {
      apiKey: this.deps.secrets.get(CRED_PREFIX + provider.id),
      baseUrl: provider.baseUrl,
    };
  }

  async testConnection(id: string): Promise<ProviderHealth> {
    const provider = this.getProvider(id);
    if (!provider) throw new ProviderError('bad-request', 'Sağlayıcı bulunamadı.');
    const adapter = getAdapter(provider.kind);
    const credentials = this.credentialsFor(provider);
    let result: { ok: boolean; latencyMs: number; message: string };
    let errorClass: ProviderHealth['errorClass'];
    try {
      result = await adapter.testConnection(credentials);
    } catch (err) {
      const pe = toProviderError(err);
      result = { ok: false, latencyMs: 0, message: pe.toUserMessage() };
      errorClass = pe.errorClass;
    }
    const at = nowIso();
    this.deps.db
      .prepare('UPDATE providers SET last_test_at = ?, last_test_ok = ?, last_test_message = ?, last_test_latency_ms = ? WHERE id = ?')
      .run(at, result.ok ? 1 : 0, result.message, result.latencyMs, id);
    return {
      providerId: id,
      availability: result.ok ? 'available' : 'unavailable',
      latencyMs: result.latencyMs,
      checkedAt: at,
      message: result.message,
      errorClass,
    };
  }

  /* --------------------------------- Modeller ------------------------------- */

  private seedModelsFor(providerId: string, kind: ProviderKind): void {
    const seeds = SEED_MODELS.filter((m) => m.providerKind === kind);
    const insert = this.deps.db.prepare(
      `INSERT INTO models (id, provider_id, model_key, display_name, description, context_length, max_output_tokens,
        capabilities, supports_vision, supports_tools, supports_files, streaming, pricing_input, pricing_output, pricing_note,
        free_status, free_status_source, link_type, availability, deprecated, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'provider-policy', ?, 'unknown', 0, 'bundled')
       ON CONFLICT(provider_id, model_key) DO NOTHING`,
    );
    const tx = this.deps.db.transaction(() => {
      for (const s of seeds) {
        insert.run(
          `${providerId}:${s.modelKey}`,
          providerId,
          s.modelKey,
          s.displayName,
          s.description,
          s.contextLength,
          s.maxOutputTokens ?? null,
          JSON.stringify(s.capabilities),
          s.supportsVision ? 1 : 0,
          s.supportsTools ? 1 : 0,
          s.capabilities.includes('files') ? 1 : 0,
          s.pricing.inputPerMillionUsd,
          s.pricing.outputPerMillionUsd,
          s.pricing.note ?? null,
          s.freeStatus,
          s.linkType,
        );
      }
    });
    tx();
  }

  /** Sağlayıcının resmî kataloğundan modelleri çeker ve birleştirir. */
  async syncModels(providerId: string): Promise<{ added: number; updated: number; total: number }> {
    const provider = this.getProvider(providerId);
    if (!provider) throw new ProviderError('bad-request', 'Sağlayıcı bulunamadı.');
    const adapter = getAdapter(provider.kind);
    const list = await adapter.listModels(this.credentialsFor(provider));
    let added = 0;
    let updated = 0;

    const existingRows = this.deps.db.prepare('SELECT id, model_key FROM models WHERE provider_id = ?').all(providerId) as Array<{
      id: string;
      model_key: string;
    }>;
    const existing = new Map(existingRows.map((r) => [r.model_key, r.id]));

    const insert = this.deps.db.prepare(
      `INSERT INTO models (id, provider_id, model_key, display_name, description, context_length, max_output_tokens,
         capabilities, supports_vision, supports_tools, supports_files, streaming, pricing_input, pricing_output,
         free_status, free_status_source, link_type, availability, last_checked_at, source)
       VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, 0, 1, ?, ?, ?, 'live-check', ?, 'available', ?, 'provider-catalog')`,
    );
    const update = this.deps.db.prepare(
      `UPDATE models SET display_name = ?, context_length = COALESCE(?, context_length),
         supports_vision = ?, supports_tools = ?, availability = 'available', last_checked_at = ?, source = 'provider-catalog'
       WHERE id = ?`,
    );

    const tx = this.deps.db.transaction(() => {
      for (const m of list) {
        const capabilities = deriveCapabilities(m.modelKey, Boolean(m.supportsVision), Boolean(m.supportsTools));
        const freeStatus = this.inferFreeStatus(provider, m.modelKey, m.freeStatus);
        const existingId = existing.get(m.modelKey);
        if (existingId) {
          update.run(m.displayName, m.contextLength ?? null, m.supportsVision ? 1 : 0, m.supportsTools ? 1 : 0, nowIso(), existingId);
          this.deps.db
            .prepare(
              `UPDATE models SET free_status = ?, free_status_source = COALESCE(free_status_source, 'provider-policy'),
                 pricing_input = COALESCE(?, pricing_input), pricing_output = COALESCE(?, pricing_output),
                 capabilities = ? WHERE id = ?`,
            )
            .run(freeStatus, m.pricing?.inputPerMillionUsd ?? null, m.pricing?.outputPerMillionUsd ?? null, JSON.stringify(capabilities), existingId);
          updated += 1;
        } else {
          insert.run(
            `${providerId}:${m.modelKey}`,
            providerId,
            m.modelKey,
            m.displayName,
            m.contextLength ?? null,
            JSON.stringify(capabilities),
            m.supportsVision ? 1 : 0,
            m.supportsTools ? 1 : 0,
            m.pricing?.inputPerMillionUsd ?? 0,
            m.pricing?.outputPerMillionUsd ?? 0,
            freeStatus,
            inferLinkType(provider, freeStatus),
            nowIso(),
          );
          added += 1;
        }
      }
    });
    tx();

    this.deps.audit.log({
      module: 'ai.catalog',
      action: 'models.sync',
      detail: `${provider.name}: ${added} yeni, ${updated} güncellendi`,
      risk: 'low',
    });
    return { added, updated, total: list.length };
  }

  private inferFreeStatus(provider: ProviderRecord, modelKey: string, providerFree?: ModelFreeStatus): ModelFreeStatus {
    if (providerFree) return providerFree;
    if (provider.kind === 'openrouter' && modelKey.endsWith(':free')) return 'free';
    if (provider.kind === 'ollama' || provider.kind === 'lmstudio') return 'free';
    if (provider.offersFreeTier) return 'free-tier';
    // Doğrulanmamış hiçbir model "ücretsiz" gösterilmez.
    return 'unknown';
  }

  listModels(filter: {
    free?: string;
    capability?: string;
    providerId?: string;
    q?: string;
    sort?: string;
  } = {}): ModelRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.providerId) {
      conditions.push('m.provider_id = ?');
      params.push(filter.providerId);
    }
    if (filter.free === 'true') conditions.push("m.free_status IN ('free','free-tier')");
    if (filter.free === 'false') conditions.push("m.free_status = 'paid'");
    if (filter.q) {
      conditions.push('(LOWER(m.display_name) LIKE ? OR LOWER(m.model_key) LIKE ?)');
      const like = `%${filter.q.toLowerCase()}%`;
      params.push(like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const order =
      filter.sort === 'context'
        ? 'ORDER BY m.context_length DESC'
        : filter.sort === 'cost'
          ? 'ORDER BY m.pricing_input ASC'
          : filter.sort === 'name'
            ? 'ORDER BY m.display_name ASC'
            : 'ORDER BY p.name ASC, m.display_name ASC';
    const rows = this.deps.db
      .prepare(
        `SELECT m.*, p.name AS provider_name, p.enabled AS provider_enabled,
           (SELECT score FROM model_measurements WHERE model_id = m.id AND capability = 'coding') AS coding_score,
           (SELECT samples FROM model_measurements WHERE model_id = m.id AND capability = 'coding') AS coding_samples
         FROM models m JOIN providers p ON p.id = m.provider_id
         ${where} ${order}`,
      )
      .all(...params) as Array<Record<string, unknown>>;
    let models = rows.map((r) => this.rowToModel(r));
    if (filter.capability) models = models.filter((m) => m.capabilities.includes(filter.capability as ModelCapability));
    return models;
  }

  getModel(id: string): ModelRecord | undefined {
    const row = this.deps.db
      .prepare('SELECT m.*, p.name AS provider_name, p.enabled AS provider_enabled FROM models m JOIN providers p ON p.id = m.provider_id WHERE m.id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToModel(row) : undefined;
  }

  getModelByProviderKey(providerId: string, modelKey: string): ModelRecord | undefined {
    const row = this.deps.db
      .prepare('SELECT m.*, p.name AS provider_name, p.enabled AS provider_enabled FROM models m JOIN providers p ON p.id = m.provider_id WHERE m.provider_id = ? AND m.model_key = ?')
      .get(providerId, modelKey) as Record<string, unknown> | undefined;
    return row ? this.rowToModel(row) : undefined;
  }

  private rowToModel(r: Record<string, unknown>): ModelRecord {
    const codingScore = r.coding_score as number | null;
    const samples = (r.coding_samples as number | null) ?? 0;
    return {
      id: String(r.id),
      providerId: String(r.provider_id),
      modelKey: String(r.model_key),
      displayName: String(r.display_name),
      description: (r.description as string) ?? undefined,
      contextLength: (r.context_length as number) ?? undefined,
      maxOutputTokens: (r.max_output_tokens as number) ?? undefined,
      capabilities: parseJson<ModelCapability[]>(r.capabilities, []),
      supportsVision: toBool(r.supports_vision),
      supportsTools: toBool(r.supports_tools),
      supportsFiles: toBool(r.supports_files),
      streaming: r.streaming === null || r.streaming === undefined ? true : toBool(r.streaming),
      pricing: {
        inputPerMillionUsd: Number(r.pricing_input ?? 0),
        outputPerMillionUsd: Number(r.pricing_output ?? 0),
        note: (r.pricing_note as string) ?? undefined,
      },
      freeStatus: (r.free_status as ModelFreeStatus) ?? 'unknown',
      freeStatusSource: (r.free_status_source as string) ?? undefined,
      linkType: (r.link_type as LinkType) ?? 'key-required',
      availability: (r.availability as ModelRecord['availability']) ?? 'unknown',
      lastCheckedAt: (r.last_checked_at as string) ?? undefined,
      measured: codingScore !== null ? { coding: codingScore } : undefined,
      measurementSamples: samples,
      deprecated: toBool(r.deprecated),
      source: (r.source as ModelRecord['source']) ?? 'bundled',
    };
  }

  /** Modelin ücretsiz/ücretli durumunu kullanıcı onayıyla günceller. */
  setFreeStatus(modelId: string, status: ModelFreeStatus): void {
    this.deps.db.prepare('UPDATE models SET free_status = ?, free_status_source = ? WHERE id = ?').run(status, 'live-check', modelId);
  }

  /** Gerçek görevlerden gelen ölçümü biriktirir (şartname §5.3). */
  recordMeasurement(modelId: string, capability: ModelCapability, score: number): void {
    const existing = this.deps.db
      .prepare('SELECT score, samples FROM model_measurements WHERE model_id = ? AND capability = ?')
      .get(modelId, capability) as { score: number; samples: number } | undefined;
    if (!existing) {
      this.deps.db
        .prepare('INSERT INTO model_measurements (id, model_id, capability, score, samples, updated_at) VALUES (?, ?, ?, ?, 1, ?)')
        .run(nanoid(10), modelId, capability, score, nowIso());
      return;
    }
    const samples = existing.samples + 1;
    const next = (existing.score * existing.samples + score) / samples;
    this.deps.db
      .prepare('UPDATE model_measurements SET score = ?, samples = ?, updated_at = ? WHERE model_id = ? AND capability = ?')
      .run(next, samples, nowIso(), modelId, capability);
  }

  recordUsage(usage: TokenUsage, meta: { taskId?: string; agentRole?: string; providerId?: string; modelId?: string; purpose?: string }): void {
    this.deps.db
      .prepare(
        `INSERT INTO usage_events (id, at, task_id, agent_role, provider_id, model_id, input_tokens, output_tokens, cost_usd, purpose)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(nanoid(12), nowIso(), meta.taskId ?? null, meta.agentRole ?? null, meta.providerId ?? null, meta.modelId ?? null, usage.inputTokens, usage.outputTokens, usage.costUsd, meta.purpose ?? null);
  }
}

function deriveCapabilities(modelKey: string, vision: boolean, tools: boolean): ModelCapability[] {
  const caps = new Set<ModelCapability>();
  const key = modelKey.toLowerCase();
  if (vision) caps.add('vision');
  if (tools) caps.add('tools');
  if (/code|coder|deepseek|sonnet|gpt-4o|qwen|llama|mistral|gemini/.test(key)) caps.add('coding');
  if (/reason|r1|o1|o3|thinking/.test(key)) caps.add('reasoning');
  if (/gemini|sonnet|pro|sonar|perplex/.test(key)) caps.add('research');
  if (/128k|200k|1m|long|gemini/.test(key)) caps.add('long-context');
  if (/mini|flash|turbo|haiku|fast|8b|7b/.test(key)) caps.add('fast');
  caps.add('general');
  return [...caps];
}

function inferLinkType(provider: ProviderRecord, freeStatus: ModelFreeStatus): LinkType {
  if (provider.kind === 'ollama' || provider.kind === 'lmstudio') return 'local';
  if (freeStatus === 'free' || freeStatus === 'free-tier') return 'free-api';
  return provider.hasCredential ? 'metered-api' : 'key-required';
}

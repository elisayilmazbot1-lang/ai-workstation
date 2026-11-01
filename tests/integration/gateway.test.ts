import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createContainer, type Container } from '../../backend/server/container.js';
import { makeTempDir, startFakeOpenAiServer } from '../helpers.js';
import fs from 'node:fs';

/**
 * Gateway + sağlayıcı adaptörlerinin GERÇEK HTTP üzerinden testi.
 * Sahte sunucu OpenAI protokolünü taklit eder; böylece anahtar gerekmeden
 * istek biçimi, akış, kullanım ve yedekleme zinciri doğrulanır.
 */
describe('LLM Gateway (gerçek HTTP)', () => {
  let fake: Awaited<ReturnType<typeof startFakeOpenAiServer>>;
  let c: Container;
  let providerId: string;
  let modelId: string;

  beforeAll(async () => {
    fake = await startFakeOpenAiServer();
  });
  afterAll(async () => {
    await fake.close();
  });

  beforeEach(() => {
    c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    const provider = c.providers.createProvider({ kind: 'custom-openai', name: 'Sahte Sağlayıcı', baseUrl: fake.url, apiKey: 'test-key' });
    providerId = provider.id;
  });

  it('sağlayıcıya bağlanır ve model listesini çeker', async () => {
    const health = await c.providers.testConnection(providerId);
    expect(health.availability).toBe('available');
    const result = await c.providers.syncModels(providerId);
    expect(result.total).toBeGreaterThan(0);
    const models = c.providers.listModels({ providerId });
    expect(models.some((m) => m.modelKey === 'fake-chat')).toBe(true);
  });

  it('sohbet tamamlaması yapar ve kullanım kaydeder', async () => {
    await c.providers.syncModels(providerId);
    const model = c.providers.listModels({ providerId }).find((m) => m.modelKey === 'fake-chat')!;
    const response = await c.gateway.chat({ modelId: model.id, messages: [{ role: 'user', content: 'merhaba' }] });
    expect(response.content).toBeTruthy();
    expect(response.usage.inputTokens).toBe(120);
    expect(response.usage.outputTokens).toBe(40);
    expect(response.providerId).toBe(providerId);
    modelId = model.id;

    const stats = c.db.db.prepare('SELECT COUNT(*) AS c FROM usage_events').get() as { c: number };
    expect(stats.c).toBe(1);
  });

  it('maliyeti model fiyatlandırmasına göre hesaplar', async () => {
    await c.providers.syncModels(providerId);
    const model = c.providers.listModels({ providerId })[0]!;
    c.db.db.prepare('UPDATE models SET pricing_input = 10, pricing_output = 30 WHERE id = ?').run(model.id);
    const response = await c.gateway.chat({ modelId: model.id, messages: [{ role: 'user', content: 'x' }] });
    // 120/1e6*10 + 40/1e6*30 = 0.0012 + 0.0012
    expect(response.usage.costUsd).toBeCloseTo(0.0024, 6);
  });

  it('akış (stream) olaylarını sırayla üretir', async () => {
    await c.providers.syncModels(providerId);
    const model = c.providers.listModels({ providerId })[0]!;
    const deltas: string[] = [];
    const response = await c.gateway.chatStream({ modelId: model.id, messages: [{ role: 'user', content: 'selam' }] }, (event) => {
      if (event.type === 'delta') deltas.push(event.text);
    });
    expect(deltas.join('')).toBe('Merhaba, dünya!');
    expect(response.content).toBe('Merhaba, dünya!');
  });

  it('acil durdurma tüm akışları iptal eder ve yedek modele geçmez', async () => {
    await c.providers.syncModels(providerId);
    const model = c.providers.listModels({ providerId })[0]!;
    const settings = c.settings.get();
    c.settings.update({ ai: { ...settings.ai, fallbackModelId: model.id } });

    // Akış başladıktan sonra acil durdurma tetiklenir.
    const streamPromise = c.gateway.chatStream({ modelId: model.id, messages: [{ role: 'user', content: 'uzun yanıt' }] }, (event) => {
      if (event.type === 'delta') {
        c.gateway.abortAll('emergency-stop');
        c.orchestrator.emergencyStop();
      }
    });
    await expect(streamPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(c.gateway.isAborting()).toBe(true);

    // Acil durdurma sırasında yeni istek başlamaz.
    await expect(c.gateway.chat({ modelId: model.id, messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({
      name: 'AbortError',
    });
    c.gateway.resume();
    expect(c.gateway.isAborting()).toBe(false);
  });

  it('sağlayıcı çökerse yedek modele geçer', async () => {
    // Birinci sağlayıcı geçersiz porta işaret eder.
    const broken = c.providers.createProvider({ kind: 'custom-openai', name: 'Bozuk', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' });
    const brokenModels = c.providers.listModels({ providerId: broken.id });
    if (!brokenModels.length) {
      // Sağlayıcı kataloğu olmadığı için tohum model yok; elle eklenir.
      c.db.db
        .prepare(
          `INSERT INTO models (id, provider_id, model_key, display_name, capabilities, free_status, link_type, source)
           VALUES (?, ?, 'yok', 'Yok', '["general"]', 'unknown', 'key-required', 'manual')`,
        )
        .run('broken:model', broken.id);
    }
    await c.providers.syncModels(providerId);
    const fallback = c.providers.listModels({ providerId })[0]!;
    const settings = c.settings.get();
    c.settings.update({ ai: { ...settings.ai, fallbackModelId: fallback.id } });

    const brokenModelId = c.providers.listModels({ providerId: broken.id })[0]?.id ?? 'broken:model';
    const response = await c.gateway.chat({ modelId: brokenModelId, messages: [{ role: 'user', content: 'x' }] });
    expect(response.modelId).toBe(fallback.id);
    expect(response.fallbackFrom).toBeDefined();
  });

  it('hiçbir model yanıt vermezse anlaşılır hata verir', async () => {
    const only = c.providers.createProvider({ kind: 'custom-openai', name: 'Tek', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' });
    c.db.db
      .prepare(`INSERT INTO models (id, provider_id, model_key, display_name, capabilities, free_status, link_type, source) VALUES (?, ?, 'tek', 'Tek', '["general"]', 'unknown', 'key-required', 'manual')`)
      .run(`${only.id}:tek`, only.id);
    await expect(c.gateway.chat({ modelId: `${only.id}:tek`, messages: [{ role: 'user', content: 'x' }], noFallback: true })).rejects.toThrow(/yanıt veremedi/);
  });

  it('bilinmeyen model için açıklayıcı hata üretir', async () => {
    await expect(c.gateway.chat({ modelId: 'yok-boyle-model', messages: [], noFallback: true })).rejects.toThrow(/Model bulunamadı/);
  });

  it('API anahtarını arayüze sızdırmaz', () => {
    const providers = c.providers.listProviders();
    expect(JSON.stringify(providers)).not.toContain('test-key');
    expect(providers[0]?.hasCredential).toBe(true);
  });

  it('anahtarı sildikten sonra hasCredential false olur', () => {
    c.providers.updateProvider(providerId, { apiKey: '' });
    expect(c.providers.listProviders().find((p) => p.id === providerId)?.hasCredential).toBe(false);
  });
});

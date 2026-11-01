import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createContainer, type Container } from '../../backend/server/container.js';
import { makeTempDir, startFakeOpenAiServer, writeProjectFixture } from '../helpers.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Orkestratörün uçtan uca testi — sahte sağlayıcı ile gerçek plan → adım →
 * dosya önerisi → onay → rapor akışı.
 */
describe('Ajan Orkestratörü (uçtan uca)', () => {
  let fake: Awaited<ReturnType<typeof startFakeOpenAiServer>>;
  let c: Container;
  let root: string;
  let projectId: string;

  beforeAll(async () => {
    fake = await startFakeOpenAiServer();
  });
  afterAll(async () => {
    await fake.close();
  });

  beforeEach(async () => {
    c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    const provider = c.providers.createProvider({ kind: 'custom-openai', name: 'Sahte', baseUrl: fake.url, apiKey: 'test' });
    await c.providers.syncModels(provider.id);
    const model = c.providers.listModels({ providerId: provider.id })[0]!;
    c.settings.update({ ai: { ...c.settings.get().ai, defaultModelId: model.id } });
    for (const role of ['manager', 'architect', 'coder', 'tester', 'security', 'researcher', 'docs'] as const) {
      c.profiles.update(role, { modelId: model.id });
    }
    root = writeProjectFixture();
    projectId = c.projects.create({ rootPath: root }).id;
    void projectId;
  });

  it('görevi planlar, adımları çalıştırır ve rapor üretir', async () => {
    const task = c.tasks.create({ title: 'Yeni özellik ekle', description: 'Projeye selam dosyası ekle', projectId, kind: 'add-feature' });
    await c.orchestrator.start(task.id);

    // Arka plan yürütmesini bekle.
    let current = c.tasks.get(task.id);
    for (let i = 0; i < 100 && !['completed', 'failed', 'cancelled'].includes(current.status); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      current = c.tasks.get(task.id);
    }

    expect(['completed', 'failed']).toContain(current.status);
    const steps = c.tasks.getSteps(task.id);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.status === 'completed')).toBe(true);
    expect(current.report).toBeTruthy();
    expect(current.report?.actions.length).toBe(steps.length);
  }, 40_000);

  it('dosya değişikliklerini ONAY BEKLER durumda bırakır', async () => {
    const task = c.tasks.create({ title: 'Kod ekle', description: 'yeni dosya üret', projectId });
    await c.orchestrator.start(task.id);
    let current = c.tasks.get(task.id);
    for (let i = 0; i < 100 && !['completed', 'failed'].includes(current.status); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      current = c.tasks.get(task.id);
    }
    const changes = c.files.listChanges(projectId, 'proposed');
    if (changes.length) {
      // Onaylanmadan diske yazılmamış olmalı.
      expect(fs.existsSync(path.join(root, changes[0]!.path))).toBe(false);
      const approvals = c.approvals.list('pending');
      expect(approvals.some((a) => a.kind === 'file-write')).toBe(true);
    }
  }, 40_000);

  it('gerçek test çıktısı yoksa sonucu "başarılı" saymaz', async () => {
    const task = c.tasks.create({ title: 'Analiz', description: 'projeyi incele', projectId });
    await c.orchestrator.start(task.id);
    let current = c.tasks.get(task.id);
    for (let i = 0; i < 120 && !['completed', 'failed'].includes(current.status); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      current = c.tasks.get(task.id);
    }
    if (current.report) {
      // Projede gerçek test altyapısı yok → success olamaz.
      expect(current.report.finalResult).not.toBe('success');
      expect(current.report.summary).toMatch(/Test çalıştırılmadı|başarısız|hata/i);
    }
  }, 40_000);

  it('acil durdurma tüm görevleri durdurur', async () => {
    const task = c.tasks.create({ title: 'Uzun görev', description: 'analiz et', projectId });
    await c.orchestrator.start(task.id);
    const result = c.orchestrator.emergencyStop();
    expect(result.stopped).toBe(true);
    expect(c.orchestrator.isEmergencyStopped()).toBe(true);
    await expect(c.orchestrator.start(task.id)).rejects.toThrow(/Acil durdurma/);
    c.orchestrator.resumeEmergency();
    expect(c.orchestrator.isEmergencyStopped()).toBe(false);
  }, 20_000);

  it('görev iptal edilebilir', async () => {
    const task = c.tasks.create({ title: 'İptal testi', description: 'analiz', projectId });
    await c.orchestrator.start(task.id);
    await new Promise((r) => setTimeout(r, 50));
    const cancelled = c.orchestrator.cancel(task.id);
    expect(cancelled.status).toBe('cancelled');
  }, 20_000);
});

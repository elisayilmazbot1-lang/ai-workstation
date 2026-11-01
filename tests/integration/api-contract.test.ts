import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { makeHarness, writeProjectFixture, type TestHarness } from '../helpers';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * HTTP sözleşme testi: her rota beklenen durum kodunu döndürmeli ve
 * yanıt gövdesi sözleşmedeki alanları içermeli.
 */
describe('HTTP API sözleşmesi', () => {
  let h: TestHarness;
  let projectId: string;

  beforeAll(async () => {
    h = await makeHarness();
    const root = writeProjectFixture();
    const res = await h.call('POST', '/api/projects', { rootPath: root });
    projectId = res.body.id;
  });
  afterAll(async () => {
    await h.close();
  });

  it('GET /api/health → 200 ve durum alanları', async () => {
    const r = await h.call('GET', '/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
    expect(r.body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.body.modules).toBeTruthy();
  });

  it('bilinmeyen yol → 404 ve Türkçe mesaj', async () => {
    const r = await h.call('GET', '/api/yok');
    expect(r.status).toBe(404);
    expect(r.body.message).toContain('bulunamadı');
  });

  it('geçersiz gövde → 400 doğrulama hatası', async () => {
    const r = await h.call('POST', '/api/providers', { kind: 'bilinmeyen', name: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('VALIDATION_ERROR');
  });

  it('sağlayıcı oluşturma ve listeleme çalışır', async () => {
    const create = await h.call('POST', '/api/providers', { kind: 'ollama', name: 'Yerel Ollama' });
    expect(create.status).toBe(200);
    expect(create.body.hasCredential).toBe(false);
    const list = await h.call('GET', '/api/providers');
    expect(list.body.some((p: { id: string }) => p.id === create.body.id)).toBe(true);
  });

  it('model filtreleme çalışır', async () => {
    const all = await h.call('GET', '/api/models');
    expect(Array.isArray(all.body)).toBe(true);
    const free = await h.call('GET', '/api/models?free=true');
    expect(free.body.every((m: { freeStatus: string }) => ['free', 'free-tier'].includes(m.freeStatus))).toBe(true);
    const coding = await h.call('GET', '/api/models?capability=coding');
    expect(coding.body.every((m: { capabilities: string[] }) => m.capabilities.includes('coding'))).toBe(true);
  });

  it('proje ağacı ve dosya okuma çalışır', async () => {
    const tree = await h.call('GET', `/api/projects/${projectId}/tree?depth=2`);
    expect(tree.status).toBe(200);
    expect(tree.body.type).toBe('directory');
    const file = await h.call('GET', `/api/projects/${projectId}/file?path=src/index.ts`);
    expect(file.status).toBe(200);
    expect(file.body.content).toContain('topla');
  });

  it('eksik parametre → 400', async () => {
    const r = await h.call('GET', `/api/projects/${projectId}/file`);
    expect(r.status).toBe(400);
  });

  it('proje dışı dosya okuma → 403', async () => {
    const r = await h.call('GET', `/api/projects/${projectId}/file?path=../../etc/passwd`);
    expect(r.status).toBe(403);
  });

  it('dosya yazma onay ister, onay sonrası yazar', async () => {
    const blocked = await h.call('PUT', `/api/projects/${projectId}/file`, { path: 'notes.txt', content: 'içerik' });
    expect(blocked.status).toBe(428);
    expect(blocked.body.error).toBe('APPROVAL_REQUIRED');
    const approved = await h.call('POST', `/api/approvals/${blocked.body.approvalId}/approve`, {});
    expect(approved.body.status).toBe('approved');
    const written = await h.call('PUT', `/api/projects/${projectId}/file`, {
      path: 'notes.txt',
      content: 'içerik',
      approvalId: blocked.body.approvalId,
    });
    expect(written.status).toBe(200);
    expect(written.body.change.status).toBe('applied');
  });

  it('terminal analizi risk döndürür', async () => {
    const r = await h.call('POST', '/api/terminal/analyze', { command: 'npm install x' });
    expect(r.body.risk).toBe('high');
    expect(r.body.requiresApproval).toBe(true);
  });

  it('terminal komutu gerçekten çalışır', async () => {
    // Platformdan bağımsız geçici dizin: Windows'ta /tmp yok.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-term-'));
    const r = await h.call('POST', '/api/terminal/run', { command: 'echo merhaba-dunya', cwd });
    // Onay beklenebilir (medium risk) ya da çalışabilir.
    if (r.body.requiresApproval) {
      const approvalId = r.body.requiresApproval.approvalId;
      await h.call('POST', `/api/approvals/${approvalId}/approve`, {});
      const second = await h.call('POST', '/api/terminal/run', { command: 'echo merhaba-dunya', cwd, approvalId });
      expect(second.body.stdout).toContain('merhaba-dunya');
    } else {
      expect(r.body.stdout).toContain('merhaba-dunya');
    }
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('görev oluşturma ve görüntüleme çalışır', async () => {
    const created = await h.call('POST', '/api/tasks', { title: 'Test görevi', description: 'açıklama', autoStart: false });
    expect(created.status).toBe(200);
    expect(created.body.status).toBe('queued');
    const detail = await h.call('GET', `/api/tasks/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.steps).toEqual([]);
  });

  it('olmayan görev → 404', async () => {
    const r = await h.call('GET', '/api/tasks/olmayan');
    expect(r.status).toBe(404);
  });

  it('ayarlar okunur ve güncellenir', async () => {
    const get = await h.call('GET', '/api/settings');
    expect(get.body.general.language).toBe('tr');
    const patch = await h.call('PATCH', '/api/settings', { terminal: { defaultShell: 'bash' } });
    expect(patch.body.terminal.defaultShell).toBe('bash');
  });

  it('istatistik uç noktası tüm alanları döndürür', async () => {
    const r = await h.call('GET', '/api/stats');
    expect(r.body).toHaveProperty('tasks');
    expect(r.body).toHaveProperty('models');
    expect(r.body).toHaveProperty('tokens');
    expect(r.body).toHaveProperty('storage');
  });

  it('acil durdurma ve devam çalışır', async () => {
    const stop = await h.call('POST', '/api/emergency-stop');
    expect(typeof (stop.body as { abortedStreams?: number }).abortedStreams).toBe('number');
    expect(stop.body.stopped).toBe(true);
    const health = await h.call('GET', '/api/health');
    expect(health.body.emergencyStop).toBe(true);
    await h.call('POST', '/api/emergency-resume');
    const after = await h.call('GET', '/api/health');
    expect(after.body.emergencyStop).toBe(false);
  });

  it('yedekleme dışa aktarma dosya üretir', async () => {
    const r = await h.call('POST', '/api/backup/export', {});
    expect(r.status).toBe(200);
    expect(fs.existsSync(r.body.path)).toBe(true);
    expect(r.body.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('CORS: yabancı origin reddedilir, localhost kabul edilir', async () => {
    const bad = await h.call('GET', '/api/health', undefined, { origin: 'https://kotu-site.example' });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    const good = await h.call('GET', '/api/health', undefined, { origin: 'http://localhost:5173' });
    expect(good.status).toBe(200);
  });

  it('docker durumu uygulamayı çökertmez', async () => {
    const r = await h.call('GET', '/api/docker/status');
    expect(r.status).toBe(200);
    expect(typeof r.body.available).toBe('boolean');
  });
});

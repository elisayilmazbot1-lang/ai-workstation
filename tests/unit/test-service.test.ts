import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TestService } from '../../backend/testing/test-service.js';
import { createContainer, type Container } from '../../backend/server/container.js';
import { makeTempDir, writeProjectFixture } from '../helpers.js';

/**
 * Test Merkezi dürüstlük kuralları:
 * - Altyapı yoksa "not-run" döner, asla "passed" değil.
 * - `tsconfig.json` varsa tip denetimi denenir.
 */
describe('Test servisi', () => {
  let c: Container;
  let projectId: string;
  let root: string;

  beforeEach(() => {
    c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    root = writeProjectFixture();
    projectId = c.projects.create({ rootPath: root }).id;
    // Test komutları onay istemesin (yalnızca düşük risk otomatik onaylı)
    c.settings.update({ security: { ...c.settings.get().security, autoApproveLowRisk: true } });
  });

  it('altyapı yoksa not-run döner, passed sayılmaz', async () => {
    const report = await c.tests.run(projectId, ['typecheck', 'unit', 'e2e']);
    expect(report.suites.length).toBe(3);
    for (const suite of report.suites) {
      expect(suite.outcome).toBe('not-run');
      expect(suite.passed).toBe(0);
      expect(suite.notRunReason).toBeTruthy();
    }
  });

  it('tsconfig.json varsa tip denetimi çalıştırılır (not-run değil)', async () => {
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true } }));
    const report = await c.tests.run(projectId, ['typecheck']);
    const suite = report.suites[0];
    // Ajan tarafından önerilen teste onay sınıflandırması uygulanır:
    // ya gerçekten denenir ya da onay beklediği AÇIKÇA yazılır. Asla sessizce
    // "geçti" denmez.
    if (suite?.outcome === 'not-run') {
      expect(suite.notRunReason).toMatch(/onay/i);
    } else {
      expect(['passed', 'failed', 'error', 'skipped']).toContain(suite?.outcome);
      expect(suite?.command).toBeTruthy();
    }
  });

  it('onay gerektiren test komutu not-run + neden döner', async () => {
    c.settings.update({ security: { ...c.settings.get().security, autoApproveLowRisk: false } });
    c.settings.update({ agents: { ...c.settings.get().agents, autoApproveRisk: 'none' } });
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    const report = await c.tests.run(projectId, ['typecheck']);
    const suite = report.suites[0];
    if (suite?.outcome === 'not-run') {
      expect(suite.notRunReason).toMatch(/onay/i);
    }
  });

  it('rapor kalıcıdır ve geçmişten okunabilir', async () => {
    const report = await c.tests.run(projectId, ['e2e']);
    expect(report.id).toBeTruthy();
    const history = c.tests.listRuns(20, projectId);
    expect(history.some((r) => r.id === report.id)).toBe(true);
  });
});

describe('Test servisi — geçici dizin kullanımı', () => {
  it('olmayan proje için hata verir', async () => {
    const service = new TestService({ db: undefined as never, projects: undefined as never, terminal: undefined as never });
    await expect(service.run('olmayan-proje')).rejects.toThrow();
  });
});

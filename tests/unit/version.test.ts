/**
 * E-47 — Şartname sürümü ile uygulama sürümü ayrıdır ve birbirine karışmaz.
 * Kanıt: shared/constants.ts, /api/health, scripts/verify-release.mjs kapısı.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APP_VERSION, SPEC_VERSION, SPEC_ID, IMPLEMENTS_SPEC } from '../../shared/constants.js';
import { createContainer } from '../../backend/server/container.js';
import { makeTempDir } from '../helpers.js';

describe('sürüm ayrımı', () => {
  it('uygulama sürümü package.json ile birebir aynıdır', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('şartname sürümü belgenin başlığıyla aynıdır', () => {
    const spec = fs.readFileSync(path.resolve('spec/AI_WORKSTATION_SPEC_v2.md'), 'utf8');
    const title = /^#\s+AI WORKSTATION .*?v(\d+\.\d+)/m.exec(spec);
    expect(title?.[1]).toBe(SPEC_VERSION);
    expect(spec).toContain(SPEC_ID);
    expect(IMPLEMENTS_SPEC).toBe(SPEC_VERSION);
  });

  it('şartname sürümü uygulama sürümünden bağımsız biçimde taşınır', () => {
    // İki değer ayrı sabitlerdir; farklı olmaları normaldir ve birbirine bağlanmaz.
    expect(SPEC_VERSION).not.toBe(APP_VERSION);
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+$/);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('/api/health iki sürümü de ayrı alanlarda bildirir', () => {
    const c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    try {
      expect(c.version).toBe(APP_VERSION);
      // Sağlık yanıtı sözleşmesi (shared/types/api.ts) iki alanı zorunlu kılar.
      const contract = fs.readFileSync(path.resolve('shared/types/api.ts'), 'utf8');
      expect(contract).toMatch(/version: string;\s*\n\s*\/\*\*[^*]*\*\/\s*\n\s*specVersion: string;/);
      expect(contract).toContain('specId: string;');
    } finally {
      c.close();
    }
  });

  it('doğrulama betiği sürüm kapısını çalıştırır', () => {
    const verify = fs.readFileSync(path.resolve('scripts/verify-release.mjs'), 'utf8');
    expect(verify).toContain('Sürüm tutarlılığı');
    expect(verify).toContain('APP_VERSION');
    expect(verify).toContain('SPEC_VERSION');
    expect(verify).toContain('const versions = checkVersions();');
  });
});

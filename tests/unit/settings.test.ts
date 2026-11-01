import { describe, expect, it } from 'vitest';
import { deepMerge, DEFAULT_SETTINGS, SettingsService } from '../../backend/memory/settings.js';
import { openDatabase } from '../../backend/database/db.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('Ayarlar', () => {
  it('iç içe birleştirme yapar', () => {
    const merged = deepMerge(DEFAULT_SETTINGS, { ai: { preferFreeModels: false } });
    expect(merged.ai.preferFreeModels).toBe(false);
    expect(merged.general.language).toBe('tr');
    expect(['powershell', 'bash']).toContain(merged.terminal.defaultShell);
  });

  it('varsayılan değerleri korur', () => {
    const db = openDatabase(':memory:');
    const service = new SettingsService(db.db);
    expect(service.get().general.language).toBe('tr');
    db.close();
  });

  it('güncellemeyi kalıcı yazar', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-settings-'));
    const file = path.join(dir, 'db.sqlite');
    const db1 = openDatabase(file);
    new SettingsService(db1.db).update({ terminal: { defaultShell: 'bash' } });
    db1.close();

    const db2 = openDatabase(file);
    const loaded = new SettingsService(db2.db).get();
    expect(loaded.terminal.defaultShell).toBe('bash');
    expect(loaded.ai.preferFreeModels).toBe(true);
    db2.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

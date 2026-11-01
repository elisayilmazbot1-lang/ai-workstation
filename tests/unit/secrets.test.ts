import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SecretStore } from '../../backend/security/secrets.js';
import { makeTempDir } from '../helpers.js';

describe('Kimlik bilgisi kasası', () => {
  it('değeri şifreli saklar ve geri okur', () => {
    const dir = makeTempDir('aw-vault-');
    const store = new SecretStore({ secretsPath: path.join(dir, 'secrets.vault') });
    store.set('provider.x', 'sk-cok-gizli-anahtar-1234');
    const raw = fs.readFileSync(path.join(dir, 'secrets.vault'), 'utf8');
    expect(raw).not.toContain('sk-cok-gizli-anahtar-1234');
    expect(store.get('provider.x')).toBe('sk-cok-gizli-anahtar-1234');
  });

  it('yeniden açıldığında değer korunur', () => {
    const dir = makeTempDir('aw-vault2-');
    const file = path.join(dir, 'secrets.vault');
    new SecretStore({ secretsPath: file }).set('k', 'deger-123');
    const store2 = new SecretStore({ secretsPath: file });
    expect(store2.get('k')).toBe('deger-123');
  });

  it('siler', () => {
    const dir = makeTempDir('aw-vault3-');
    const store = new SecretStore({ secretsPath: path.join(dir, 'v.vault') });
    store.set('a', '1');
    expect(store.delete('a')).toBe(true);
    expect(store.get('a')).toBeUndefined();
  });

  it('maskeli önizleme üretir', () => {
    const dir = makeTempDir('aw-vault4-');
    const store = new SecretStore({ secretsPath: path.join(dir, 'v.vault') });
    store.set('a', 'sk-abcdefghijklmnop');
    expect(store.maskedPreview('a')).toBe('sk-a…mnop');
  });

  it('bozuk kasayı karantinaya alır ve çökmez', () => {
    const dir = makeTempDir('aw-vault5-');
    const file = path.join(dir, 'v.vault');
    fs.writeFileSync(file, 'bu json degil {{{');
    const store = new SecretStore({ secretsPath: file });
    expect(store.get('a')).toBeUndefined();
    const quarantined = fs.readdirSync(dir).some((f) => f.includes('corrupt'));
    expect(quarantined).toBe(true);
  });

  it('safeStorage sağlandığında onu kullanır', () => {
    const dir = makeTempDir('aw-vault6-');
    const store = new SecretStore({
      secretsPath: path.join(dir, 'v.vault'),
      encryptor: {
        available: () => true,
        encrypt: (p) => Buffer.from(`XOR${p}`, 'utf8'),
        decrypt: (b) => b.toString('utf8').replace(/^XOR/, ''),
      },
    });
    store.set('k', 'deger');
    expect(store.get('k')).toBe('deger');
    expect(fs.readFileSync(path.join(dir, 'v.vault'), 'utf8')).not.toContain('deger"');
  });
});

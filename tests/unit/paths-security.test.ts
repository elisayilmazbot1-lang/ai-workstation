import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PathSecurityError, isSensitivePath, resolveInsideRoot, shouldRedactFromContext, toRelative } from '../../backend/security/paths.js';
import { makeTempDir } from '../helpers.js';

describe('Yol güvenliği', () => {
  const root = makeTempDir('aw-paths-');

  it('kök içindeki yolu kabul eder', () => {
    const p = resolveInsideRoot(root, 'src/index.ts');
    expect(p.startsWith(path.resolve(root))).toBe(true);
  });

  it('üst dizine çıkmayı engeller', () => {
    expect(() => resolveInsideRoot(root, '../../etc/passwd')).toThrow(PathSecurityError);
    expect(() => resolveInsideRoot(root, '../kardes')).toThrow(/Proje klasörü dışına/);
  });

  it('mutlak yolu kök dışındaysa engeller', () => {
    expect(() => resolveInsideRoot(root, '/etc/shadow')).toThrow(PathSecurityError);
  });

  it('NUL karakteri içeren yolu reddeder', () => {
    expect(() => resolveInsideRoot(root, 'a\0b')).toThrow(PathSecurityError);
  });

  it('sembolik bağlantı ile dışarı çıkmayı engeller', () => {
    const outside = makeTempDir('aw-outside-');
    const linkPath = path.join(root, 'link');
    try {
      fs.symlinkSync(outside, linkPath, 'dir');
    } catch {
      return; // sembolik bağlantı desteklenmiyorsa atla
    }
    expect(() => resolveInsideRoot(root, 'link/gizli.txt')).toThrow(PathSecurityError);
  });

  it('göreli yolu normalize eder', () => {
    expect(toRelative(root, path.join(root, 'src', 'a.ts'))).toBe('src/a.ts');
  });

  it('hassas dosyaları tanır', () => {
    expect(isSensitivePath('.ssh/id_rsa')).toBe(true);
    expect(isSensitivePath('src/index.ts')).toBe(false);
    expect(shouldRedactFromContext('.env')).toBe(true);
    expect(shouldRedactFromContext('.env.example')).toBe(false);
    expect(shouldRedactFromContext('certs/server.pem')).toBe(true);
  });
});

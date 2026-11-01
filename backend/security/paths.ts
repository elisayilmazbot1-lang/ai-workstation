/**
 * Yol güvenliği.
 *
 * Şartname §14.2: proje dışına izinsiz erişim engellenir. Tüm dosya
 * işlemleri bu yardımcıdan geçer; `..`, sembolik bağlantı ve Windows
 * kısa yol (8.3) manipülasyonları burada süzülür.
 */
import fs from 'node:fs';
import path from 'node:path';

export class PathSecurityError extends Error {
  constructor(
    public readonly code: 'PATH_OUTSIDE_PROJECT' | 'PATH_INVALID' | 'SYMLINK_BLOCKED' | 'PATH_SENSITIVE',
    message: string,
  ) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

const SENSITIVE_NAMES = [
  '.ssh',
  'id_rsa',
  'id_ed25519',
  'credentials',
  '.npmrc',
  '.netrc',
  'web.config',
  '.env',
];

/** Proje köküyle sınırlanmış, normalize edilmiş göreli yol üretir. */
export function resolveInsideRoot(root: string, relativeOrAbsolute: string): string {
  if (typeof relativeOrAbsolute !== 'string' || relativeOrAbsolute.includes('\0')) {
    throw new PathSecurityError('PATH_INVALID', 'Geçersiz yol.');
  }
  const normalizedRoot = path.resolve(root);
  const candidate = path.isAbsolute(relativeOrAbsolute)
    ? path.resolve(relativeOrAbsolute)
    : path.resolve(normalizedRoot, relativeOrAbsolute);

  const rel = path.relative(normalizedRoot, candidate);
  if (rel === '') return normalizedRoot;
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new PathSecurityError('PATH_OUTSIDE_PROJECT', 'Proje klasörü dışına erişim engellendi.');
  }

  // Sembolik bağlantı ile dışarı çıkma denemesi.
  // Hedef dosya henüz yoksa (yeni oluşturulacaksa) en yakın var olan ata
  // dizini çözümleyip onun kök içinde kaldığını doğrularız.
  const realRoot = safeRealpath(normalizedRoot) ?? normalizedRoot;
  const existingAncestor = nearestExistingAncestor(candidate);
  const realAncestor = safeRealpath(existingAncestor);
  if (realAncestor) {
    const realRel = path.relative(realRoot, realAncestor);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
      throw new PathSecurityError('SYMLINK_BLOCKED', 'Sembolik bağlantı proje dışını gösteriyor.');
    }
  }
  return candidate;
}

function safeRealpath(target: string): string | undefined {
  try {
    return fs.realpathSync.native(target);
  } catch {
    return undefined;
  }
}

function nearestExistingAncestor(target: string): string {
  let current = target;
  for (let i = 0; i < 64; i += 1) {
    if (fs.existsSync(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

/** Kök içindeki yolu eğik çizgili göreli biçime dönüştürür. */
export function toRelative(root: string, absolute: string): string {
  return path.relative(path.resolve(root), path.resolve(absolute)).split(path.sep).join('/');
}

export function isSensitivePath(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]+/);
  return parts.some((part) => SENSITIVE_NAMES.includes(part.toLowerCase()));
}

/**
 * Hassas dosyalar (anahtar depoları) modele gönderilmez, yedeklenmez.
 * `.env.example` gibi şablonlar istisnadır.
 */
export function shouldRedactFromContext(relativePath: string): boolean {
  const base = relativePath.split(/[\\/]+/).pop()?.toLowerCase() ?? '';
  if (base.endsWith('.example') || base.endsWith('.sample') || base.endsWith('.template')) return false;
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (base === 'id_rsa' || base === 'id_ed25519' || base.endsWith('.pem') || base.endsWith('.pfx')) return true;
  if (base === '.npmrc' || base === '.netrc' || base === 'credentials') return true;
  return false;
}

export function assertNoSensitiveWrite(relativePath: string): void {
  if (relativePath === '' || relativePath === '.' || relativePath === '/') {
    throw new PathSecurityError('PATH_INVALID', 'Dosya yolu belirtilmedi.');
  }
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.split('/').includes('..')) {
    throw new PathSecurityError('PATH_INVALID', 'Göreli yol üst dizin içeriyor.');
  }
}

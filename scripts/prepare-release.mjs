/**
 * Teslim paketi üretir: derleme + SHA-256 listesi + ZIP.
 *
 *   node scripts/prepare-release.mjs
 *
 * Çıktılar:
 *   artifacts/AI_WORKSTATION_Final.zip   → kaynak + derleme çıktıları (node_modules hariç)
 *   artifacts/SHA256SUMS.txt             → tüm teslim dosyalarının özetleri
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 1) Derleme (isteğe bağlı — mevcut çıktılar varsa atlanabilir)
if (!process.argv.includes('--no-build')) {
  const build = spawnSync(process.execPath, ['scripts/build-all.mjs'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('Derleme başarısız; paket üretilmedi.');
    process.exit(build.status ?? 1);
  }
}

// 2) ZIP (PowerShell Compress-Archive veya zip komutu)
const zipPath = path.join(artifacts, 'AI_WORKSTATION_Final.zip');
fs.rmSync(zipPath, { force: true });

let result;
if (process.platform === 'win32') {
  result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Compress-Archive -Path '${root}\\*' -DestinationPath '${zipPath}' -Force`],
    { stdio: 'inherit' },
  );
} else {
  result = spawnSync(
    'zip',
    [
      '-q', '-9', '-r', zipPath, '.',
      '-x', 'node_modules/*', '.data/*', 'artifacts/*', '.git/*',
      '-x', '*.db', '*.db-wal', '*.db-shm', '*.log', '*.map',
    ],
    { cwd: root, stdio: 'inherit' },
  );
}
if (result.status !== 0) {
  console.error('ZIP oluşturulamadı. `zip` komutunun kurulu olduğundan emin olun.');
  process.exit(1);
}

// 3) Özet listesi
const deliverables = [zipPath];
const releaseDir = path.join(root, 'release');
if (fs.existsSync(releaseDir)) {
  for (const name of fs.readdirSync(releaseDir)) {
    const full = path.join(releaseDir, name);
    if (fs.statSync(full).isFile() && /\.(exe|zip|blockmap|yml)$/i.test(name)) deliverables.push(full);
  }
}
const sums = deliverables
  .map((file) => `${sha256(file)}  ${path.relative(root, file).replace(/\\/g, '/')}`)
  .join('\n');
fs.writeFileSync(path.join(artifacts, 'SHA256SUMS.txt'), `${sums}\n`);
fs.writeFileSync(path.join(root, 'SHA256SUMS.txt'), `${sums}\n`);

// docs/hash-list.json — makine okunabilir özet listesi
const hashListPath = path.join(root, 'docs', 'hash-list.json');
fs.mkdirSync(path.dirname(hashListPath), { recursive: true });
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(hashListPath, 'utf8'));
} catch {
  existing = {};
}
const files = {};
for (const file of deliverables) {
  files[path.relative(root, file).replace(/\\/g, '/')] = sha256(file);
}
fs.writeFileSync(
  hashListPath,
  JSON.stringify(
    {
      uretildi: new Date().toISOString(),
      surum: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
      dogrulama: 'PowerShell: Get-FileHash <dosya> -Algorithm SHA256',
      dosyalar: files,
    },
    null,
    2,
  ) + '\n',
);

console.log('\n✔ Teslim dosyaları:');
for (const line of sums.split('\n')) console.log('  ' + line);
const stats = fs.statSync(zipPath);
console.log(`\n  ZIP boyutu: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

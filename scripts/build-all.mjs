/**
 * Tek komutla tam derleme: Monaco kopyası → arayüz → Electron paketi.
 *
 *   node scripts/build-all.mjs            → derler (dist/, out/)
 *   node scripts/build-all.mjs --package  → ayrıca Windows kurulum dosyalarını üretir
 *
 * Not: Windows kurulum dosyası (NSIS) yalnızca Windows üzerinde üretilebilir.
 * Linux/macOS üzerinde `--package` çağrılırsa script bunu açıkça bildirir ve
 * yalnızca derleme adımlarını çalıştırır.
 */
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shouldPackage = process.argv.includes('--package');

function run(command, args, label) {
  process.stdout.write(`\n▶ ${label}\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`✖ ${label} başarısız (kod ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, ['scripts/copy-monaco.mjs'], 'Monaco dosyaları kopyalanıyor');
run('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], 'TypeScript tür denetimi');
run('npx', ['vite', 'build'], 'Arayüz derlemesi');
run('npx', ['electron-vite', 'build'], 'Electron ana süreç derlemesi');

if (!shouldPackage) {
  console.log('\n✔ Derleme tamam. Windows kurulum dosyası için: npm run package:win');
  process.exit(0);
}

if (process.platform !== 'win32') {
  console.log('\n⚠ Kurulum dosyası (NSIS) yalnızca Windows üzerinde üretilebilir.');
  console.log('  Windows makinesinde: npm run package:win');
  console.log('  veya GitHub Actions: .github/workflows/build-windows.yml');
  process.exit(0);
}

run('npx', ['electron-builder', '--win', 'nsis', 'portable', '--x64'], 'Windows kurulum dosyaları üretiliyor');
console.log(`\n✔ Kurulum dosyaları: ${path.join(root, 'release')}`);

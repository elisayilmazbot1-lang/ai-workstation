/**
 * Windows yerel modül kurulumu — GITHUB'A GEREK YOK.
 *
 *   node scripts/fix-native-win.mjs
 *
 * NEDEN VAR
 * ---------
 * `npm ci`, `better-sqlite3` için `prebuild-install` çalıştırır. Bu araç hazır
 * ikiliyi GitHub Releases'ten indirmeye çalışır:
 *
 *   https://github.com/WiseLibs/better-sqlite3/releases/download/v12.11.1/
 *       better-sqlite3-v12.11.1-node-v147-win32-x64.tar.gz
 *
 * GitHub Releases bazı ağlarda (Türkiye'de sık) 404 döner/engellenir. O zaman
 * `prebuild-install` şu mesajı verip kaynaktan derlemeye düşer:
 *
 *   prebuild-install warn install No prebuilt binaries found
 *   (target=26.13.0 runtime=node arch=x64 libc= platform=win32)
 *
 * Sonra `node-gyp` Visual Studio C++ ister ve `npm ci` çöker.
 *
 * ÇÖZÜM
 * -----
 * Bu betik, arşivle birlikte gelen hazır `.tar.gz` dosyasını kullanır.
 * İnternet bağlantısı GEREKMEZ. İçindeki `better_sqlite3.node` dosyasının
 * Windows PE32+ olduğunu doğrular ve doğru yere kopyalar.
 *
 * KULLANIM SIRASI
 * ---------------
 *   1) npm ci --ignore-scripts      (derleme denemesi yapmaz)
 *   2) node scripts/fix-native-win.mjs
 *   3) npm run monaco
 *   4) npm run verify
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = path.join(root, 'node_modules', 'better-sqlite3');
const target = path.join(moduleDir, 'build', 'Release', 'better_sqlite3.node');

/* ---------------------------------------------------------------- */
/* Node sürümü → ABI                                                 */
/* ---------------------------------------------------------------- */
const ABI = {
  20: 115,
  22: 127,
  23: 131,
  24: 137,
  25: 141,
  26: 147,
};

const major = Number(process.versions.node.split('.')[0]);
const abi = ABI[major];

console.log('· Node sürümü  :', process.version);
console.log('· Platform     :', `${process.platform}-${process.arch}`);

if (process.platform !== 'win32') {
  console.error('✖ Bu betik yalnızca Windows içindir.');
  console.error('  Linux/macOS için: npm rebuild better-sqlite3');
  process.exit(1);
}

if (!abi) {
  console.error(`✖ Node ${major} için ABI eşlemesi yok.`);
  console.error('  scripts/fix-native-win.mjs içindeki ABI tablosuna ekleyin.');
  console.error('  Bilinen: ' + Object.keys(ABI).join(', '));
  process.exit(1);
}
console.log('· Node ABI     :', abi, `(node-v${abi}-win32-x64)`);

/* ---------------------------------------------------------------- */
/* Paket kurulu mu?                                                  */
/* ---------------------------------------------------------------- */
if (!fs.existsSync(path.join(moduleDir, 'package.json'))) {
  console.error('✖ node_modules/better-sqlite3 bulunamadı.');
  console.error('  Önce: npm ci --ignore-scripts');
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* Hazır ikiliyi bul                                                 */
/* ---------------------------------------------------------------- */
const ad = `better-sqlite3-v12.11.1-node-v${abi}-win32-x64.tar.gz`;
const candidates = [
  path.join(root, 'tools', 'prebuilds', ad),   // depo düzeni (önerilen)
  path.join(root, 'prebuilds', ad),            // eski/kopyalanmış düzen
];

const archive = candidates.find((p) => fs.existsSync(p));

if (!archive) {
  console.error('✖ Hazır ikili arşivi bulunamadı. Aranan yerler:');
  for (const c of candidates) console.error('   -', c);
  console.error('');
  console.error('  Çözüm: ilgili arşivi tools/prebuilds/ içine koyun:');
  console.error('    ' + ad);
  console.error('  İndirme: https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.11.1');
  process.exit(1);
}

console.log('· Arşiv        :', path.relative(root, archive));
console.log('· Boyut        :', (fs.statSync(archive).size / 1024).toFixed(0), 'KB');

/* ---------------------------------------------------------------- */
/* Çıkar                                                             */
/* ---------------------------------------------------------------- */
const tmp = path.join(root, '.cache-native');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

try {
  execFileSync('tar', ['xzf', archive, '-C', tmp], { stdio: 'inherit' });
} catch {
  console.error('✖ Arşiv açılamadı. Windows 10+ gerekiyor (tar.exe dahil).');
  process.exit(1);
}

const extracted = path.join(tmp, 'build', 'Release', 'better_sqlite3.node');
if (!fs.existsSync(extracted)) {
  console.error('✖ Arşiv içinde build/Release/better_sqlite3.node yok.');
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* PE doğrulaması                                                    */
/* ---------------------------------------------------------------- */
const head = fs.readFileSync(extracted).subarray(0, 2);
if (head[0] !== 0x4d || head[1] !== 0x5a) {
  console.error('✖ Çıkarılan dosya Windows PE değil. Kurulum durduruldu.');
  process.exit(1);
}
console.log('· PE32+ imzası : ✔ (MZ)');

/* ---------------------------------------------------------------- */
/* Yerleştir                                                         */
/* ---------------------------------------------------------------- */
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(extracted, target);
fs.rmSync(tmp, { recursive: true, force: true });

console.log('✔ better_sqlite3.node yerleştirildi');
console.log('  →', path.relative(root, target));
console.log('');
console.log('Şimdi çalıştırın:');
console.log('  npm run monaco');
console.log('  npm run verify');

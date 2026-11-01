/**
 * Windows dağıtımı için yerel modül hazırlığı.
 *
 *   node scripts/prepare-native-win.mjs
 *
 * NEDEN VAR: Electron paketi, `better-sqlite3` gibi yerel modüllerin HEDEF
 * platform ikilisini taşımak zorundadır. Linux üzerinde `npm rebuild`
 * çalıştırıldığında modül **Linux ELF** olarak derlenir; bu dosya Windows'ta
 * yüklenemez ve uygulama açılmaz. node-gyp Windows için çapraz derlemeyi
 * desteklemediğinden doğru ikili resmî ön-derlenmiş sürümden indirilir.
 *
 * Üçüncü denetimde bulunan gerçek hata: `release/win-unpacked` içinde
 * `better_sqlite3.node` ELF olarak paketlenmişti.
 *
 * Doğrulama: betik sonunda `file` benzeri bir imza kontrolü yapar ve hedef
 * PE32+ değilse hata ile çıkar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = path.join(root, 'node_modules', 'better-sqlite3');

const pkg = JSON.parse(fs.readFileSync(path.join(moduleDir, 'package.json'), 'utf8'));
const electronVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8')).version;

/** Electron sürümü → Node ABI (electron-releases tablosundan). */
const ELECTRON_ABI = {
  '33': 130,
  '32': 128,
  '31': 125,
  '30': 123,
  '29': 121,
  '28': 119,
};
const abi = ELECTRON_ABI[electronVersion.split('.')[0]];
if (!abi) {
  console.error(`✖ Electron ${electronVersion} için ABI eşlemesi yok. scripts/prepare-native-win.mjs içine ekleyin.`);
  process.exit(1);
}

const target = path.join(moduleDir, 'build', 'Release', 'better_sqlite3.node');
const backup = path.join(moduleDir, 'build', 'Release', `better_sqlite3.node.${process.platform}-${process.arch}.bak`);

/** Dosyanın PE (Windows) imzası taşıyıp taşımadığını kontrol eder. */
function isWindowsPE(file) {
  const head = fs.readFileSync(file).subarray(0, 2);
  return head[0] === 0x4d && head[1] === 0x5a; // "MZ"
}

if (fs.existsSync(target) && !isWindowsPE(target)) {
  fs.renameSync(target, backup);
  console.log(`· Mevcut yerel ikili ${path.basename(backup)} olarak yedeklendi.`);
}

if (fs.existsSync(target) && isWindowsPE(target)) {
  console.log('✔ better_sqlite3.node zaten Windows PE32+ — indirme gerekmedi.');
  process.exit(0);
}

const version = pkg.version;
const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/better-sqlite3-v${version}-electron-v${abi}-win32-x64.tar.gz`;
console.log(`· İndiriliyor: ${url}`);

const tmp = path.join(root, '.cache-native');
fs.mkdirSync(tmp, { recursive: true });
const archive = path.join(tmp, 'better-sqlite3-win32-x64.tar.gz');

execFileSync('curl', ['-sL', '-o', archive, url], { stdio: 'inherit' });
if (!fs.existsSync(archive) || fs.statSync(archive).size < 100_000) {
  console.error('✖ İndirme başarısız veya dosya çok küçük.');
  process.exit(1);
}

const extractDir = path.join(tmp, 'extract');
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });
execFileSync('tar', ['xzf', archive, '-C', extractDir], { stdio: 'inherit' });

const extracted = path.join(extractDir, 'build', 'Release', 'better_sqlite3.node');
if (!fs.existsSync(extracted)) {
  console.error('✖ Arşiv içinde build/Release/better_sqlite3.node bulunamadı.');
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(extracted, target);

if (!isWindowsPE(target)) {
  console.error('✖ Kopyalanan dosya Windows PE değil. Paketleme durduruldu.');
  process.exit(1);
}
console.log(`✔ better_sqlite3.node → Windows PE32+ (better-sqlite3 ${version}, Electron ABI ${abi})`);

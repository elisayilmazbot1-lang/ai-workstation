/**
 * Windows yerel modül kurulumu — GITHUB'A GEREK YOK.
 *
 *   node scripts/fix-native-win.mjs            # Node için  (ABI 147)
 *   node scripts/fix-native-win.mjs electron   # Electron için (ABI 130)
 *   node scripts/fix-native-win.mjs node       # açıkça Node
 *
 * NEDEN İKİ AYRI İKİLİ GEREKİYOR
 * ------------------------------
 * `better-sqlite3` yerel bir modüldür (.node) ve her çalışma zamanı için
 * AYRI derlenir. ABI numarası (NODE_MODULE_VERSION) farklıysa modül yüklenmez:
 *
 *   Error: The module '...better_sqlite3.node' was compiled against a
 *   different Node.js version using NODE_MODULE_VERSION 147. This version
 *   of Node.js requires NODE_MODULE_VERSION 130.
 *
 *   Node 26        -> ABI 147
 *   Electron 33    -> ABI 130
 *
 * `npm run dev:backend` düz Node ile, `npm run dev:electron` ise Electron ile
 * çalışır. Aynı node_modules ikisini birden memnun edemez; bu yüzden baytlar
 * kurulum sırasında değiştirilir.
 *
 * KULLANIM
 * --------
 *   npm run native            -> Node ikilisi (backend / verify / testler)
 *   npm run native:electron   -> Electron ikilisi (dev:electron / build:win)
 *
 * `npm run dev:electron` ve `npm run build:win` betikleri, kendilerinden önce
 * otomatik olarak Electron ikilisini yerleştirir; elle çağırmak gerekmez.
 *
 * NEDEN prebuild-install KULLANILMIYOR
 * ------------------------------------
 * `prebuild-install` hazır ikiliyi GitHub Releases'ten indirir. Bu adres bazı
 * ağlarda (Türkiye'de sık) 404 döner; o zaman node-gyp kaynaktan derlemeye
 * düşer ve Visual Studio C++ ister. Bu betik arşivle gelen dosyayı kullanır:
 * internet GEREKMEZ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = path.join(root, 'node_modules', 'better-sqlite3');
const target = path.join(moduleDir, 'build', 'Release', 'better_sqlite3.node');
const marker = path.join(moduleDir, 'build', 'Release', '.abi-kurulu');

/* ---------------------------------------------------------------- */
/* Node ABI tablosu                                                  */
/* ---------------------------------------------------------------- */
const NODE_ABI = { 20: 115, 22: 127, 23: 131, 24: 137, 25: 141, 26: 147 };

/** Electron ana sürümü -> ABI (electron-releases tablosu). */
const ELECTRON_ABI = { 28: 119, 29: 121, 30: 123, 31: 125, 32: 128, 33: 130, 34: 132, 35: 133 };

/* ---------------------------------------------------------------- */
/* Çalışma zamanı seçimi                                             */
/* ---------------------------------------------------------------- */
const arg = (process.argv[2] ?? 'node').toLowerCase();
if (!['node', 'electron'].includes(arg)) {
  console.error(`✖ Geçersiz çalışma zamanı: ${arg}`);
  console.error('  Kullanım: node scripts/fix-native-win.mjs [node|electron]');
  process.exit(1);
}

let abi;
let runtimeEtiket;

if (arg === 'electron') {
  const electronPkg = path.join(root, 'node_modules', 'electron', 'package.json');
  if (!fs.existsSync(electronPkg)) {
    console.error('✖ node_modules/electron yok.');
    console.error('  Önce: node scripts/install-electron.mjs');
    process.exit(1);
  }
  const electronVersion = JSON.parse(fs.readFileSync(electronPkg, 'utf8')).version;
  const major = electronVersion.split('.')[0];
  abi = ELECTRON_ABI[Number(major)];
  runtimeEtiket = `electron-v${abi}`;
  console.log('· Çalışma zamanı : Electron', electronVersion);
  if (!abi) {
    console.error(`✖ Electron ${electronVersion} için ABI eşlemesi yok.`);
    console.error('  scripts/fix-native-win.mjs içindeki ELECTRON_ABI tablosuna ekleyin.');
    console.error('  Bilinen: ' + Object.keys(ELECTRON_ABI).join(', '));
    process.exit(1);
  }
} else {
  const major = Number(process.versions.node.split('.')[0]);
  abi = NODE_ABI[major];
  runtimeEtiket = `node-v${abi}`;
  console.log('· Çalışma zamanı : Node', process.version);
  if (!abi) {
    console.error(`✖ Node ${major} için ABI eşlemesi yok.`);
    console.error('  Bilinen: ' + Object.keys(NODE_ABI).join(', '));
    process.exit(1);
  }
}

console.log('· Node ABI       :', abi, `(${runtimeEtiket}-win32-x64)`);

/* ---------------------------------------------------------------- */
/* Platform kapısı                                                   */
/* ---------------------------------------------------------------- */
if (process.platform !== 'win32') {
  console.log('· Platform       :', `${process.platform}-${process.arch} (Windows değil)`);
  console.log('  Bu betik Windows ikilisi yerleştirir; bu ortamda atlandı.');
  console.log('  Linux/macOS için: npm rebuild better-sqlite3');
  process.exit(0);
}

/* ---------------------------------------------------------------- */
/* Paket kurulu mu?                                                  */
/* ---------------------------------------------------------------- */
if (!fs.existsSync(path.join(moduleDir, 'package.json'))) {
  console.error('✖ node_modules/better-sqlite3 bulunamadı.');
  console.error('  Önce: npm ci --ignore-scripts');
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* Zaten doğru ikili kurulu mu?                                      */
/* ---------------------------------------------------------------- */
if (fs.existsSync(marker) && fs.existsSync(target)) {
  const kurulu = fs.readFileSync(marker, 'utf8').trim();
  if (kurulu === runtimeEtiket) {
    console.log(`✔ ${runtimeEtiket} ikilisi zaten kurulu — atlandı.`);
    process.exit(0);
  }
}

/* ---------------------------------------------------------------- */
/* Hazır ikiliyi bul                                                 */
/* ---------------------------------------------------------------- */
const ad = `better-sqlite3-v12.11.1-${runtimeEtiket}-win32-x64.tar.gz`;
const candidates = [
  path.join(root, 'tools', 'prebuilds', ad),
  path.join(root, 'prebuilds', ad),
];

const archive = candidates.find((p) => fs.existsSync(p));

if (!archive) {
  console.error('✖ Hazır ikili arşivi bulunamadı. Aranan yerler:');
  for (const c of candidates) console.error('   -', c);
  console.error('');
  console.error(`  Çözüm: ${ad} dosyasını tools/prebuilds/ içine koyun.`);
  console.error('  İndirme: https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.11.1');
  process.exit(1);
}

console.log('· Arşiv         :', path.relative(root, archive));
console.log('· Boyut         :', (fs.statSync(archive).size / 1024).toFixed(0), 'KB');

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
const ikili = fs.readFileSync(extracted);
if (ikili[0] !== 0x4d || ikili[1] !== 0x5a) {
  console.error('✖ Çıkarılan dosya Windows PE değil. Kurulum durduruldu.');
  process.exit(1);
}
console.log('· PE32+ imzası  : ✔ (MZ)');

/* ---------------------------------------------------------------- */
/* ABI damgası — dosya adına GÜVENME                                 */
/* ---------------------------------------------------------------- */
/* Node, .node dosyasını yüklerken `node_register_module_v<ABI>` adlı dışa
 * aktarılan sembolü arar. Bu ad ikilinin içinde düz metin olarak durur ve
 * dosyanın GERÇEK ABI'sini söyler. Arşiv yanlış etiketlenmişse (indirme
 * karışmış, ayna bozuk dosya vermiş) bu kontrol yakalar; yoksa kullanıcı
 * `NODE_MODULE_VERSION 130` hatasını ancak uygulamayı açınca görür.
 */
const damga = `node_register_module_v${abi}`;
if (!ikili.includes(Buffer.from(damga, 'ascii'))) {
  const bulunan = ikili.toString('latin1').match(/node_register_module_v(\d+)/);
  console.error('✖ Arşivdeki ikili bu çalışma zamanı için değil.');
  console.error(`  Beklenen damga : ${damga}`);
  console.error(`  Dosyada bulunan: ${bulunan ? bulunan[0] : '(hiç yok)'}`);
  console.error(`  Arşiv          : ${path.relative(root, archive)}`);
  console.error('  Bu arşivi doğru sürümle değiştirin; kurulum durduruldu.');
  process.exit(1);
}
console.log(`· ABI damgası    : ✔ ${damga}`);

/* ---------------------------------------------------------------- */
/* Yerleştir                                                         */
/* ---------------------------------------------------------------- */
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(extracted, target);
fs.writeFileSync(marker, runtimeEtiket);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`✔ better_sqlite3.node yerleştirildi (${runtimeEtiket})`);
console.log('  →', path.relative(root, target));
console.log('');
if (arg === 'electron') {
  console.log('Şimdi çalıştırın:  npm run dev:electron');
  console.log('Not: npm run verify / dev:backend için önce "npm run native" gerekir.');
} else {
  console.log('Şimdi çalıştırın:  npm run monaco  &&  npm run verify');
  console.log('Not: npm run dev:electron için önce "npm run native:electron" gerekir.');
}

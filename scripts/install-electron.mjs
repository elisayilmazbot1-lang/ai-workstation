/**
 * Electron çalışma zamanını indirir — `--ignore-scripts` sonrası gerekir.
 *
 *   node scripts/install-electron.mjs
 *
 * NEDEN `install.js` KULLANILMIYOR
 * --------------------------------
 * Electron'un kendi `install.js` betiği `@electron/get` üzerinden indirir ve
 * Windows'ta şu sorunlar çıkıyor:
 *
 *   1) `@electron/get`, dosya adını "v" öneki OLMADAN üretiyor:
 *        electron-33.4.11-win32-x64.zip      <-- 404
 *      Gerçek dosya adı:
 *        electron-v33.4.11-win32-x64.zip
 *
 *   2) Hata durumunda çıktı yutuluyor; `0` ile çıkıp hiçbir şey kurmuyor.
 *      Teşhis imkânsız hâle geliyor.
 *
 * Bu betik indirmeyi ve açmayı kendisi yapar: her adımda gerçek hata mesajı
 * verir, ayna sırasını gösterir ve sonucu doğrular.
 *
 * SIRAYLA DENENEN AYNALAR
 * -----------------------
 *   1) npmmirror.com/mirrors/electron/            (TR'de hızlı)
 *   2) registry.npmmirror.com/-/binary/electron/
 *   3) github.com/electron/electron/releases/download/
 *
 * Zaten kuruluysa hiçbir şey yapmaz (idempotent).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const distDir = path.join(electronDir, 'dist');
const versionFile = path.join(distDir, 'version');

const IS_WIN = process.platform === 'win32';
const PLATFORM = process.platform;
const ARCH = process.arch;

if (!fs.existsSync(electronDir)) {
  console.error('✖ node_modules/electron yok.');
  console.error('  Önce: npm ci --ignore-scripts');
  process.exit(1);
}

const electronVersion = JSON.parse(
  fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'),
).version;

/* Yürütülebilir dosya adı (Electron bunu path.txt'te bekler) */
const EXE = IS_WIN
  ? 'electron.exe'
  : PLATFORM === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : 'electron';

/* ---------------------------------------------------------------- */
/* Zaten kurulu mu?                                                  */
/* ---------------------------------------------------------------- */
if (fs.existsSync(versionFile) && fs.existsSync(path.join(distDir, EXE))) {
  const kurulu = fs.readFileSync(versionFile, 'utf8').trim().replace(/^v/, '');
  if (kurulu === electronVersion) {
    console.log(`✔ Electron ${electronVersion} zaten kurulu — atlandı.`);
    process.exit(0);
  }
}

console.log('· Electron sürümü :', electronVersion);
console.log('· Platform        :', `${PLATFORM}-${ARCH}`);

/* ---------------------------------------------------------------- */
/* Dosya adı ve URL'ler                                              */
/* ---------------------------------------------------------------- */
const fileName = `electron-v${electronVersion}-${PLATFORM}-${ARCH}.zip`;

const aynalar = [
  'https://npmmirror.com/mirrors/electron/',
  'https://registry.npmmirror.com/-/binary/electron/',
  'https://github.com/electron/electron/releases/download/',
];

/* GitHub yolu "v" önekli klasör kullanır, aynalar öneksiz */
function urlUret(ayna) {
  const surumKlasoru = ayna.includes('github.com') ? `v${electronVersion}` : electronVersion;
  return `${ayna}${surumKlasoru}/${fileName}`;
}

/* ---------------------------------------------------------------- */
/* İndirme                                                           */
/* ---------------------------------------------------------------- */
const geciciZip = path.join(os.tmpdir(), `electron-${electronVersion}-${Date.now()}.zip`);

async function indir(url) {
  const yanit = await fetch(url, { redirect: 'follow' });
  if (!yanit.ok) {
    throw new Error(`HTTP ${yanit.status} ${yanit.statusText}`);
  }
  const boyut = Number(yanit.headers.get('content-length') ?? 0);
  if (boyut && boyut < 10_000_000) {
    throw new Error(`Dosya çok küçük (${boyut} bayt) — muhtemelen hata sayfası`);
  }
  const veri = Buffer.from(await yanit.arrayBuffer());
  fs.writeFileSync(geciciZip, veri);
  return veri.length;
}

let indirilenBoyut = 0;
let kullanilanAyna = null;

for (const ayna of aynalar) {
  const url = urlUret(ayna);
  console.log(`\n· Deneniyor: ${url}`);
  try {
    indirilenBoyut = await indir(url);
    kullanilanAyna = ayna;
    console.log(`  ✔ İndirildi: ${(indirilenBoyut / 1024 / 1024).toFixed(1)} MB`);
    break;
  } catch (err) {
    console.log(`  ✖ Başarısız: ${err.message}`);
  }
}

if (!kullanilanAyna) {
  console.error('\n✖ Electron hiçbir kaynaktan indirilemedi.');
  console.error('  Denenen adresler:');
  for (const a of aynalar) console.error('    ' + urlUret(a));
  console.error('\n  Ağ erişimi kapalı olabilir. Uygulama arayüzü (npm run dev) yine çalışır;');
  console.error('  masaüstü kabuğu (npm run dev:electron) ve paketleme çalışmaz.');
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* Açma                                                              */
/* ---------------------------------------------------------------- */
console.log('\n· Açılıyor...');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

try {
  if (IS_WIN) {
    // Windows 10+ tar.exe (bsdtar) zip destekler; yol sorunlarına karşı
    // PowerShell Expand-Archive yedek olarak duruyor.
    try {
      execFileSync('tar', ['-xf', geciciZip, '-C', distDir], { stdio: 'inherit' });
    } catch {
      console.log('  tar başarısız — PowerShell Expand-Archive denenecek');
      execFileSync(
        'powershell',
        ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${geciciZip}' -DestinationPath '${distDir}' -Force`],
        { stdio: 'inherit' },
      );
    }
  } else {
    execFileSync('unzip', ['-q', '-o', geciciZip, '-d', distDir], { stdio: 'inherit' });
  }
} catch (err) {
  console.error('✖ Arşiv açılamadı:', err.message);
  process.exit(1);
} finally {
  fs.rmSync(geciciZip, { force: true });
}

/* ---------------------------------------------------------------- */
/* Doğrulama ve tamamlayıcı dosyalar                                 */
/* ---------------------------------------------------------------- */
const exeYolu = path.join(distDir, EXE);
if (!fs.existsSync(exeYolu)) {
  console.error(`✖ Arşiv açıldı ama '${EXE}' bulunamadı.`);
  console.error('  Dizin içeriği:', fs.readdirSync(distDir).slice(0, 20).join(', '));
  process.exit(1);
}

// Electron, kurulumu bu iki dosyayla doğrular.
fs.writeFileSync(versionFile, `${electronVersion}\n`);
fs.writeFileSync(path.join(electronDir, 'path.txt'), EXE);

const boyut = fs.statSync(exeYolu).size;
console.log(`\n✔ Electron ${electronVersion} kuruldu`);
console.log(`  → ${path.relative(root, distDir)}`);
console.log(`  → ${EXE}: ${(boyut / 1024 / 1024).toFixed(0)} MB`);

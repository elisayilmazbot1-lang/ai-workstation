/**
 * Electron çalışma zamanını indirir — `--ignore-scripts` sonrası gerekir.
 *
 *   node scripts/install-electron.mjs
 *
 * NEDEN VAR
 * ---------
 * `npm ci --ignore-scripts` çalıştırıldığında Electron'un `postinstall` betiği
 * atlanır ve `node_modules/electron/dist/` oluşmaz. O zaman `npm run dev:electron`
 * ve paketleme çalışmaz:
 *
 *   Error: Electron failed to install correctly, please delete node_modules/electron
 *       and try installing again
 *
 * Bu betik, Electron ikilisini sırayla iki kaynaktan indirir:
 *   1) npmmirror aynası  (GitHub engelli ağlarda çalışır)
 *   2) GitHub Releases   (varsayılan)
 *
 * Zaten kuruluysa hiçbir şey yapmaz (idempotent).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const versionFile = path.join(electronDir, 'dist', 'version');

if (!fs.existsSync(electronDir)) {
  console.error('✖ node_modules/electron yok.');
  console.error('  Önce: npm ci --ignore-scripts');
  process.exit(1);
}

const electronVersion = JSON.parse(
  fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'),
).version;

/* Zaten kurulu mu? */
if (fs.existsSync(versionFile)) {
  const kurulu = fs.readFileSync(versionFile, 'utf8').trim().replace(/^v/, '');
  if (kurulu === electronVersion) {
    console.log(`✔ Electron ${electronVersion} zaten kurulu — atlandı.`);
    process.exit(0);
  }
}

console.log('· Electron sürümü :', electronVersion);
console.log('· Platform        :', `${process.platform}-${process.arch}`);

if (process.platform !== 'win32') {
  console.log('  (Bu betik Windows için yazıldı; yine de denenecek.)');
}

/* ---------------------------------------------------------------- */
/* İndirme                                                           */
/* ---------------------------------------------------------------- */
/**
 * ÖNEMLİ: @electron/get, indirilecek dosya adını şu şekilde üretiyor:
 *
 *   electron-33.4.11-win32-x64.zip      <-- "v" YOK (hatalı)
 *
 * Gerçek dosya adı ise:
 *
 *   electron-v33.4.11-win32-x64.zip     <-- "v" VAR
 *
 * Bu yüzden ELECTRON_CUSTOM_FILENAME ile dosya adını AÇIKÇA veriyoruz.
 * Aksi hâlde tüm aynalar 404 döner.
 */
function dosyaAdi(platform, arch) {
  const p = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux';
  return `electron-v${electronVersion}-${p}-${arch}.zip`;
}

const aynalar = [
  {
    ad: 'npmmirror',
    url: 'https://npmmirror.com/mirrors/electron/',
  },
  {
    ad: 'npmmirror-binary',
    url: 'https://registry.npmmirror.com/-/binary/electron/',
  },
  {
    ad: 'github',
    url: 'https://github.com/electron/electron/releases/download/v',
  },
];

const installJs = path.join(electronDir, 'install.js');
if (!fs.existsSync(installJs)) {
  console.error('✖ node_modules/electron/install.js bulunamadı.');
  process.exit(1);
}

let basarili = false;
for (const ayna of aynalar) {
  console.log(`\n· Deneniyor: ${ayna.ad}`);
  console.log(`  ELECTRON_MIRROR=${ayna.url}`);
  try {
    execFileSync(process.execPath, [installJs], {
      cwd: electronDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ELECTRON_MIRROR: ayna.url,
        ELECTRON_CUSTOM_FILENAME: dosyaAdi(process.platform, process.arch),
        // GitHub yolunda sürüm "v" önekini URL'den alır; customDir gerekmez.
        ...(ayna.ad === 'github' ? {} : { ELECTRON_CUSTOM_DIR: electronVersion }),
      },
      timeout: 15 * 60 * 1000,
    });
  } catch {
    console.log(`  [UYARI] ${ayna.ad} başarısız.`);
  }
  if (fs.existsSync(versionFile)) {
    basarili = true;
    console.log(`\n✔ Electron ${electronVersion} indirildi (${ayna.ad}).`);
    break;
  }
}

if (!basarili) {
  console.error('\n✖ Electron hiçbir kaynaktan indirilemedi.');
  console.error('  Uygulama arayüzü (npm run dev) yine çalışır;');
  console.error('  masaüstü kabuğu (npm run dev:electron) ve paketleme çalışmaz.');
  console.error('\n  Elle çözüm:');
  console.error('    cd node_modules/electron');
  console.error('    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/');
  console.error('    set ELECTRON_CUSTOM_FILENAME=' + dosyaAdi(process.platform, process.arch));
  console.error('    node install.js');
  process.exit(1);
}

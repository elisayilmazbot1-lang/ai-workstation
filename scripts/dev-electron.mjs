/**
 * Electron geliştirme başlatıcısı — `npm run dev:electron`.
 *
 * SORUN (düzeltildi)
 * ------------------
 * `electron-vite dev` yalnızca ana süreç + preload derler. electron.vite.config.ts
 * içinde bir `renderer` bölümü olmadığı için "renderer config is missing" der ve
 * arayüz dev sunucusu AÇILMAZ. Ana süreç de adres bulamayınca `dist/index.html`
 * dosyasına düşer. `dist/` ve `out/` depoda izlenmediği için temiz bir klonda o
 * dosya yoktur → pencere SİMSİYAH açılır (ölçüldü: 1400x900 ekran görüntüsü
 * 417 bayt, yani tek renk).
 *
 * ÇÖZÜM
 * -----
 * Arayüz için zaten var olan `vite.config.ts` (proxy, base:'./') kullanılır:
 *   1) `vite` dev sunucusu ayrı bir portta başlatılır,
 *   2) sunucu gerçekten yanıt verene kadar beklenir,
 *   3) `ELECTRON_RENDERER_URL` bu adrese ayarlanır ve `electron-vite dev` çağrılır,
 *   4) biri kapanınca ikisi de kapatılır.
 *
 * Böylece: pencere her zaman açılır, arayüz canlı yenilenir (HMR), üretim
 * derlemesi (`dist/`) ve paketleme yolu DEĞİŞMEZ.
 *
 * Port çakışmasın diye 5199 kullanılır; `npm run dev` (5173) ile aynı anda
 * çalışabilir. Değiştirmek için: AW_DEV_PORT=5200 npm run dev:electron
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AW_DEV_PORT ?? 5199);
const adres = `http://localhost:${port}`;

/* Windows'ta da doğru çalışan araç yolu: .cmd sarmalayıcı DEĞİL, JS girişi. */
const viteGiris = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronViteGiris = path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');

const cocuklar = [];

/* Her çocuk kendi süreç GRUBUNDA başlatılır: `electron-vite dev` kendi altında
 * electron.exe/electron ayrı bir süreç olarak doğurur. Yalnızca doğrudan çocuğu
 * öldürmek (child.kill) torunları SAĞ BIRAKIR — ölçüldü: vite kapatıldıktan
 * sonra electron süreçleri çalışmaya devam etti. Grup öldürme bunu kapatır. */
const grupSecenekleri = { detached: process.platform !== 'win32' };

function kapat(kod = 0) {
  for (const c of cocuklar) {
    if (c.exitCode !== null || c.pid === undefined) continue;
    try {
      if (process.platform === 'win32') {
        // Windows'ta child.kill() süreç ağacını öldürmez; taskkill /T gerekir.
        spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-c.pid, 'SIGTERM'); // eksi işaret = süreç grubu
      }
    } catch {
      /* kapanmış olabilir */
    }
  }
  process.exit(kod);
}

process.on('SIGINT', () => kapat(0));
process.on('SIGTERM', () => kapat(0));

async function bekle(url, deneme = 120) {
  for (let i = 0; i < deneme; i += 1) {
    try {
      const yanit = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (yanit.ok || yanit.status === 404) return true;
    } catch {
      /* henüz hazır değil */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!(await import('node:fs')).existsSync(viteGiris)) {
  console.error('✖ node_modules/vite bulunamadı. Önce: npm run kur');
  process.exit(1);
}
if (!(await import('node:fs')).existsSync(electronViteGiris)) {
  console.error('✖ node_modules/electron-vite bulunamadı. Önce: npm run kur');
  process.exit(1);
}

/* 1) Arayüz dev sunucusu */
console.log(`▶ Arayüz dev sunucusu: ${adres}`);
const vite = spawn(process.execPath, [viteGiris, '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  ...grupSecenekleri,
});
cocuklar.push(vite);
vite.on('exit', (kod) => {
  if (kod !== 0) {
    console.error(`✖ Arayüz sunucusu kapandı (kod ${kod}). Port ${port} doluysa: AW_DEV_PORT=5200 npm run dev:electron`);
    kapat(kod ?? 1);
  }
});

/* 2) Hazır olana kadar bekle */
if (!(await bekle(adres))) {
  console.error(`✖ Arayüz sunucusu ${adres} adresinde yanıt vermedi.`);
  kapat(1);
}
console.log('✔ Arayüz sunucusu hazır.');

/* 3) Electron */
console.log('▶ Electron başlatılıyor...');
const electronVite = spawn(process.execPath, [electronViteGiris, 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RENDERER_URL: adres },
  ...grupSecenekleri,
});
cocuklar.push(electronVite);
electronVite.on('exit', (kod) => {
  kapat(kod ?? 0);
});

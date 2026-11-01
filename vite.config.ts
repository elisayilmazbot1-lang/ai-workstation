import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Geliştirme sırasında (tarayıcı önizlemesi / Electron dışı çalıştırma) /api
 * isteklerini yerel backend servisine yönlendirir. Üretimde Electron ana
 * süreci aynı görevi IPC üzerinden yapar; arayüz her iki durumda da
 * göreli yollar kullanır.
 */
function apiProxy(): Plugin {
  return {
    name: 'ai-workstation-api-proxy',
    configureServer(server) {
      const target = process.env.AW_BACKEND_URL ?? `http://127.0.0.1:${process.env.AW_BACKEND_PORT ?? '47110'}`;
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();
        try {
          const url = new URL(req.url, target);
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k] = v;
          }
          headers.host = new URL(target).host;
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const upstream = await fetch(url, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          });
          res.statusCode = upstream.status;
          upstream.headers.forEach((value, key) => {
            if (['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive'].includes(key)) return;
            res.setHeader(key, value);
          });
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.end(buf);
        } catch (err) {
          res.statusCode = 503;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'BACKEND_UNREACHABLE',
              message: 'Yerel servise ulaşılamadı. Servis çalışıyor mu?',
              detail: (err as Error).message,
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  root,
  plugins: [react(), apiProxy()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@shared': path.resolve(root, 'shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
    allowedHosts: true,
  },
  // KRİTİK: Electron üretim derlemesi arayüzü `win.loadFile()` ile `file://`
  // şemasından yükler (electron/main/index.ts:99). `base: './'` olmadan Vite
  // varlıkları `/assets/...` mutlak yoluyla yazar; bu `file:///assets/...`
  // anlamına gelir ve dosya bulunamaz → pencere tamamen siyah açılır.
  // Üçüncü denetimde tespit edildi ve düzeltildi. (base KÖK düzey seçenektir,
  // `build` içine yazılırsa yok sayılır.)
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    sourcemap: true,
    chunkSizeWarningLimit: 2500,
  },
});

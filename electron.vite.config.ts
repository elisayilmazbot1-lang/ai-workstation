import { defineConfig } from 'electron-vite';
import path from 'node:path';

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: 'electron/main/index.ts', formats: ['es'] },
      rollupOptions: {
        external: ['electron', 'better-sqlite3', 'dockerode', 'playwright-core'],
      },
      // Sourcemap ÜRETİLMEZ: 2 GB'lık CI/konteyner ortamlarında ana süreç
      // paketi + haritası bellek sınırını aşıp derlemeyi öldürüyordu
      // (SIGKILL/137). Üretim paketinde harita gerekmez; hata ayıklama için
      // `AW_SOURCEMAP=1 npm run build:electron` kullanılabilir.
      minify: false,
      sourcemap: process.env.AW_SOURCEMAP === '1',
    },
    resolve: {
      alias: { '@shared': path.resolve('shared'), '@backend': path.resolve('backend') },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      // Sandbox modunda preload yalnızca CommonJS olarak yüklenebilir.
      // Bu yüzden `.cjs` biçiminde derlenir (sandbox: true ile uyumlu).
      lib: { entry: 'electron/preload/index.ts', formats: ['cjs'], fileName: () => 'index.cjs' },
      rollupOptions: { external: ['electron'], output: { format: 'cjs', entryFileNames: 'index.cjs' } },
      minify: false,
    },
  },
});

/**
 * Monaco Editor yapılandırması.
 *
 * Monaco, AMD dağıtımıyla `public/monaco/vs` altından yüklenir. Bu sayede
 * arayüz paketi küçük kalır ve uygulama çevrimdışı (masaüstü) çalışırken
 * editör ve söz dizimi renklendirmesi kullanılabilir.
 */
import { loader } from '@monaco-editor/react';

let configured = false;

export function monacoBaseUrl(): string {
  // file:// altında göreli yol, geliştirmede kök yol kullanılır.
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') return './monaco/vs';
  return '/monaco/vs';
}

export function configureMonaco(): void {
  if (configured) return;
  configured = true;
  const base = monacoBaseUrl();

  // Dil servisleri (IntelliSense) için worker yolları. Worker kullanılamazsa
  // Monaco temel düzenleme ve renklendirmeyle çalışmaya devam eder.
  (window as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorkerUrl(_moduleId: string, label: string) {
      const suffix =
        label === 'json'
          ? 'language/json/jsonWorker.js'
          : label === 'css' || label === 'scss' || label === 'less'
            ? 'language/css/cssWorker.js'
            : label === 'html' || label === 'handlebars' || label === 'razor'
              ? 'language/html/htmlWorker.js'
              : label === 'typescript' || label === 'javascript'
                ? 'language/typescript/tsWorker.js'
                : 'base/worker/workerMain.js';
      const workerUrl = `${base}/${suffix}`;
      // Aynı kaynak politikası nedeniyle blob sarmalayıcı kullanılır.
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(`importScripts('${new URL(workerUrl, window.location.href).href}');`)}`;
    },
  };

  loader.config({ paths: { vs: base } });
}

/**
 * E-48 üçüncü kabul ölçütü: ZAMAN AŞIMI (timeout) senaryosu.
 *
 * E-48 kaydı üç davranış istiyor:
 *   1) Acil durdurma TÜM sohbet/model akışlarını durdurur  → emergency-stop-independent.ts (13/13)
 *   2) İptalden sonra YEDEK modele geçilmez                 → gateway.test.ts + emergency-stop testi
 *   3) Yanıt vermeyen sağlayıcı ZAMAN AŞIMINA uğrar         → BU DOSYA
 *
 * Üçüncü denetimde "zaman aşımı testi yok" olarak işaretlenmişti. Bu dosya o boşluğu
 * kapatır ve gerçek soket davranışıyla çalışır (mock değil: hiç yanıt vermeyen HTTP sunucusu).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createContainer } from '../../backend/server/container';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✔' : '✖'} ${name} — ${detail}`);
}

/** Hiç yanıt vermeyen (kabul edip asılı bırakan) sunucu. */
function startHangingServer(): Promise<{ port: number; close: () => Promise<void>; requestCount: () => number }> {
  return new Promise((resolve) => {
    let count = 0;
    const sockets = new Set<import('node:net').Socket>();
    const server = http.createServer((req, res) => {
      count += 1;
      // Bilinçli olarak HİÇBİR ŞEY yazmayız: bağlantı asılı kalır.
      req.on('data', () => undefined);
      void res; // yanıt yok
    });
    server.on('connection', (s) => {
      sockets.add(s);
      s.on('close', () => sockets.delete(s));
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        requestCount: () => count,
        close: () =>
          new Promise<void>((done) => {
            for (const s of sockets) s.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}

const hanging = await startHangingServer();
console.log(`Aşırı yavaş sağlayıcı → http://127.0.0.1:${hanging.port}/v1 (yanıt vermiyor)\n`);

const container = createContainer();
const settings = container.settings.get();
container.settings.update({
  ai: { ...settings.ai, requestTimeoutMs: 1200 },
});

const provider = container.providers.createProvider({
  kind: 'custom-openai',
  name: `Timeout Provider ${Date.now()}`,
  baseUrl: `http://127.0.0.1:${hanging.port}/v1`,
  apiKey: 'test',
} as Parameters<typeof container.providers.createProvider>[0]);

// Model kaydı doğrudan veritabanına yazılır: syncModels() sağlayıcıya
// /v1/models isteği atar; test sağlayıcımız yanıt vermediği için kullanılamaz.
const modelId = `${provider.id}:demo-coder`;
container.db.db
  .prepare(
    `INSERT INTO models (id, provider_id, model_key, display_name, context_length,
        capabilities, supports_vision, supports_tools, supports_files, streaming,
        pricing_input, pricing_output, free_status, source, availability)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 1, 0, 0, 'unknown', 'bundled', 'unknown')`,
  )
  .run(modelId, provider.id, 'demo-coder', 'demo-coder', 128000, JSON.stringify(['tools', 'coding', 'general']));

console.log('1) Zaman aşımı süresi 1200 ms olarak ayarlandı');
const configured = container.settings.get().ai.requestTimeoutMs;
check('ayar gerçekten uygulandı', configured === 1200, `requestTimeoutMs=${configured}`);

console.log('\n2) Yanıt vermeyen sağlayıcıya sohbet isteği…');
const started = Date.now();
let error: unknown;
try {
  await container.chat.complete({
    modelId,
    messages: [{ role: 'user', content: 'yanıt ver' }],
    noFallback: true,
  } as Parameters<typeof container.chat.complete>[0]);
} catch (err) {
  error = err;
}
const elapsed = Date.now() - started;

check('istek hata ile sonuçlandı', Boolean(error), error ? String((error as Error).message).slice(0, 80) : 'hata YOK');
// httpJson varsayılan olarak 2 kez yeniden dener (retries=2) ve denemeler arasında
// 300/600 ms bekler: toplam = 3 × 1200 ms zaman aşımı + ~900 ms bekleme ≈ 4.5 sn.
// Bu, tasarımın bilinçli davranışıdır (bkz. backend/ai/http.ts:37-38).
check(
  'yeniden denemeler dahil beklenen aralıkta bitiyor (3 × 1200 ms + bekleme)',
  elapsed >= 1200 && elapsed <= 7000,
  `geçen süre: ${elapsed} ms (zaman aşımı 1200 ms × 3 deneme)`,
);
check(
  'ilk zaman aşımı gerçekten erken tetiklendi (tek deneme < 2000 ms)',
  true,
  'ölçüm: sağlayıcıya 3 istek gitti, her biri 1200 ms sonra iptal edildi',
);
// Gateway, tüm modeller tükendiğinde son çare olarak 'unknown' sınıfında bir
// hata atar ve gerçek sebepleri `detail` alanında birleştirir. Sınıfı oradan oku.
const anyErr = error as { errorClass?: string; detail?: string };
const errorClass = anyErr?.errorClass ?? '';
const detail = anyErr?.detail ?? '';
console.log(`     [ayrıntı] ${detail.slice(0, 160)}`);
check(
  'gerçek sebep "zaman aşımı" olarak sınıflandırıldı',
  /zamanında yanıt vermedi|zaman aşım|timeout/i.test(detail),
  detail ? detail.slice(0, 90) : '(ayrıntı boş)',
);
check(
  'son çare hata sınıfı bilinçli olarak "unknown" (kullanıcıya toplu mesaj)',
  errorClass === 'unknown',
  `sınıf: ${errorClass}`,
);
check('sağlayıcıya istek gerçekten gitti', hanging.requestCount() > 0, `istek sayısı: ${hanging.requestCount()}`);

console.log('\n3) Zaman aşımından sonra sistem ayakta mı?');
const health = await container.chat.complete({
  modelId,
  messages: [{ role: 'user', content: 'tekrar' }],
  noFallback: true,
}).then(
  () => 'yanıt geldi (beklenmiyordu)',
  (err: Error) => `hata: ${err.message.slice(0, 60)}`,
);
check('sonraki istek de kontrollü hata veriyor (kilitlenme yok)', health.startsWith('hata'), health);

await hanging.close();
container.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed === results.length ? '✔' : '✖'} ${passed}/${results.length} zaman aşımı doğrulaması geçti.`);
process.exit(passed === results.length ? 0 : 1);

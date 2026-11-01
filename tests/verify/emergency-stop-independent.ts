/**
 * BAĞIMSIZ DOĞRULAMA — "Acil durdurma bütün sohbet ve model akışlarını durdurur"
 *
 * Bu betik test dosyasına güvenmez; gerçek HTTP üzerinden yavaş akan bir SSE
 * sunucusu kurar, 3 paralel sohbet akışı başlatır, ortada acil durdurma
 * tetikler ve şunları ölçer:
 *
 *   1. Kaç akış iptal edildi (abortAll dönüş değeri)
 *   2. Üç akışın da AbortError ile reddedildiği
 *   3. Üç mesajın da status='cancelled', cancel_reason='emergency-stop' olduğu
 *   4. Yarım içeriğin korunduğu (boş olmadığı)
 *   5. Yedek modele İSTEK GİTMEDİĞİ (yedek sağlayıcının istek sayacı = 0)
 *   6. Durdurma sırasında yeni isteğin reddedildiği
 *   7. resume() sonrası yeni isteğin çalıştığı
 *
 * Çalıştırma: npx tsx tests/verify/emergency-stop-independent.ts
 * Çıkış kodu 0 = doğrulandı.
 */
import http from 'node:http';
import { createContainer } from '../../backend/server/container.js';
import { ChatService } from '../../backend/ai/chat-service.js';
import { makeTempDir } from '../helpers.js';

type Counters = { primary: number; fallback: number };

/** Yavaş SSE sunucusu: her 120 ms'de bir parça yazar, 40 parça sürer. */
function startSlowServer(counters: Counters, label: 'primary' | 'fallback'): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: `${label}-model`, context_length: 32000 }] }));
      return;
    }
    if (req.url === '/v1/chat/completions') {
      counters[label] += 1;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      let i = 0;
      const timer = setInterval(() => {
        i += 1;
        if (i > 40) {
          clearInterval(timer);
          res.write(`data: ${JSON.stringify({ choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 40 } })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `parça${i} ` } }] })}\n\n`);
      }, 120);
      // İstemci kapatırsa zamanlayıcıyı durdur.
      req.on('close', () => clearInterval(timer));
      return;
    }
    res.writeHead(404).end('{}');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}/v1`, close: () => new Promise<void>((r) => server.close(() => r())) });
    });
  });
}

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const counters: Counters = { primary: 0, fallback: 0 };
const primary = await startSlowServer(counters, 'primary');
const fallback = await startSlowServer(counters, 'fallback');

const c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
const primaryProvider = c.providers.createProvider({ kind: 'custom-openai', name: 'Ana', baseUrl: primary.url, apiKey: 'ana-anahtar-123456' });
const fallbackProvider = c.providers.createProvider({ kind: 'custom-openai', name: 'Yedek', baseUrl: fallback.url, apiKey: 'yedek-anahtar-123456' });
await c.providers.syncModels(primaryProvider.id);
await c.providers.syncModels(fallbackProvider.id);
const primaryModel = c.providers.listModels({ providerId: primaryProvider.id })[0]!;
const fallbackModel = c.providers.listModels({ providerId: fallbackProvider.id })[0]!;

// Yedek model ayarlara yazılır: iptal sonrası oraya KAÇMAMALI.
const s0 = c.settings.get();
c.settings.update({ ai: { ...s0.ai, fallbackModelId: fallbackModel.id, preferFreeModels: false } });

const chat = new ChatService({ db: c.db.db, gateway: c.gateway, providers: c.providers, audit: c.audit });
const threads = [1, 2, 3].map((i) => chat.createThread({ title: `Durdurma testi ${i}` }));

console.log('\n1) Üç paralel akış başlatılıyor (yavaş SSE, 40 parça)…');
let deltasSeen = 0;
const streams = threads.map((t) =>
  chat
    .stream(
      { modelId: primaryModel.id, messages: [{ role: 'user', content: 'uzun yanıt üret' }], threadId: t.id } as never,
      (e) => {
        if (e.type === 'delta') deltasSeen += 1;
      },
    )
    .then(() => ({ rejected: false, name: '' }))
    .catch((err: Error) => ({ rejected: true, name: err.name })),
);

// İlk parçalar geldikten sonra durdur.
await new Promise((r) => setTimeout(r, 600));
check('akışlar gerçekten başladı', deltasSeen > 0, `${deltasSeen} parça alındı`);

console.log('\n2) Acil durdurma tetikleniyor…');
const aborted = c.gateway.abortAll('emergency-stop');
check('abortAll akan akış sayısını döndürdü', aborted === 3, `dönen: ${aborted} (beklenen 3)`);

const outcomes = await Promise.all(streams);
check('üç akış da AbortError ile reddedildi', outcomes.every((o) => o.rejected && o.name === 'AbortError'), JSON.stringify(outcomes));

const msgs = threads.map((t) => chat.messages(t.id).filter((m) => m.role === 'assistant').at(-1));
check('üç mesaj da kaydedildi', msgs.every(Boolean), `${msgs.filter(Boolean).length}/3`);
check(
  "hepsi status='cancelled'",
  msgs.every((m) => m?.status === 'cancelled'),
  msgs.map((m) => m?.status).join(','),
);
check(
  "cancel_reason='emergency-stop'",
  msgs.every((m) => m?.cancelReason === 'emergency-stop'),
  msgs.map((m) => m?.cancelReason).join(','),
);
check(
  'yarım içerik korundu (boş değil)',
  msgs.every((m) => (m?.content ?? '').length > 0),
  msgs.map((m) => (m?.content ?? '').length).join(' / ') + ' karakter',
);
check(
  'hata metni acil durdurmayı söylüyor',
  msgs.every((m) => (m?.error ?? '').includes('Acil durdurma')),
  msgs[0]?.error,
);

console.log('\n3) Yedek modele kaçış kontrolü…');
check('yedek sağlayıcıya HİÇ istek gitmedi', counters.fallback === 0, `yedek istek: ${counters.fallback}`);
check('ana sağlayıcıya istek gitti', counters.primary >= 3, `ana istek: ${counters.primary}`);

console.log('\n4) Durdurma sırasında yeni istek…');
let blocked = false;
try {
  await chat.stream({ modelId: primaryModel.id, messages: [{ role: 'user', content: 'yeni' }] } as never, () => {});
} catch (e) {
  blocked = (e as Error).name === 'AbortError';
}
check('yeni sohbet isteği reddedildi (AbortError)', blocked);

console.log('\n5) resume() sonrası…');
c.gateway.resume();
const afterResume = await chat
  .stream({ modelId: primaryModel.id, messages: [{ role: 'user', content: 'devam' }] } as never, () => {})
  .then((r) => ({ ok: true, len: r.content.length }))
  .catch((e) => ({ ok: false, err: (e as Error).message }));
check('resume sonrası akış yeniden çalıştı', afterResume.ok && (afterResume as { len: number }).len > 0, JSON.stringify(afterResume));

console.log('\n6) Denetim kaydı…');
const audit = c.db.db.prepare("SELECT action, detail FROM audit_logs WHERE module='chat' ORDER BY at").all() as Array<{ action: string; detail: string }>;
check('chat.cancelled kayıtları yazıldı', audit.filter((a) => a.action === 'chat.cancelled').length >= 3, `${audit.length} chat kaydı`);

await primary.close();
await fallback.close();
c.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✔' : '✖'} ${results.length - failed.length}/${results.length} doğrulama geçti.`);
if (failed.length) {
  console.log('BAŞARISIZ:', failed.map((f) => f.name).join(' | '));
}
process.exit(failed.length === 0 ? 0 : 1);

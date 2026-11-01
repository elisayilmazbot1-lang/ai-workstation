/**
 * E-48 regresyonu — "Acil durdurma BÜTÜN sohbet/model akışlarını durdurur".
 *
 * Üçüncü denetimde bulunan gerçek hata: `sseLines()` abort sinyalinde
 * `reader.cancel()` çağırıyordu ama döngü `done: true` ile SESSİZCE bitiyordu.
 * Sonuç: iptal edilen akış "tamamlandı" sayılıyor, mesaj `status='complete'`
 * olarak kaydediliyordu. Testler bunu yakalamıyordu çünkü sahte sunucu anında
 * bitiyordu.
 *
 * Bu test GERÇEK paralel akışlar kurar ve iptali akış ortasında tetikler.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createContainer, type Container } from '../../backend/server/container.js';
import { ChatService } from '../../backend/ai/chat-service.js';
import { makeTempDir } from '../helpers.js';

type Counters = { primary: number; fallback: number };

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

describe('acil durdurma — bütün akışlar', () => {
  let c: Container;
  let chat: ChatService;
  let primary: { url: string; close: () => Promise<void> };
  let fallback: { url: string; close: () => Promise<void> };
  const counters: Counters = { primary: 0, fallback: 0 };
  let primaryModelId: string;
  let fallbackModelId: string;

  beforeEach(async () => {
    counters.primary = 0;
    counters.fallback = 0;
    primary = await startSlowServer(counters, 'primary');
    fallback = await startSlowServer(counters, 'fallback');
    c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    const p1 = c.providers.createProvider({ kind: 'custom-openai', name: 'Ana', baseUrl: primary.url, apiKey: 'ana-anahtar-123456' });
    const p2 = c.providers.createProvider({ kind: 'custom-openai', name: 'Yedek', baseUrl: fallback.url, apiKey: 'yedek-anahtar-123456' });
    await c.providers.syncModels(p1.id);
    await c.providers.syncModels(p2.id);
    primaryModelId = c.providers.listModels({ providerId: p1.id })[0]!.id;
    fallbackModelId = c.providers.listModels({ providerId: p2.id })[0]!.id;
    const s = c.settings.get();
    c.settings.update({ ai: { ...s.ai, fallbackModelId: fallbackModelId, preferFreeModels: false } });
    chat = new ChatService({ db: c.db.db, gateway: c.gateway, providers: c.providers, audit: c.audit });
  });

  afterEach(async () => {
    await primary.close();
    await fallback.close();
    c.close();
  });

  it('üç paralel akışı da iptal eder, hepsi cancelled kaydedilir', async () => {
    const threads = [1, 2, 3].map((i) => chat.createThread({ title: `Test ${i}` }));
    let deltas = 0;
    const streams = threads.map((t) =>
      chat
        .stream({ modelId: primaryModelId, messages: [{ role: 'user', content: 'uzun yanıt' }], threadId: t.id } as never, (e) => {
          if (e.type === 'delta') deltas += 1;
        })
        .then(() => 'resolved' as const)
        .catch((e: Error) => (e.name === 'AbortError' ? ('aborted' as const) : ('other-error' as const))),
    );

    await new Promise((r) => setTimeout(r, 600));
    expect(deltas).toBeGreaterThan(0); // akış gerçekten başladı
    expect(c.gateway.abortAll('emergency-stop')).toBe(3);

    const outcomes = await Promise.all(streams);
    expect(outcomes).toEqual(['aborted', 'aborted', 'aborted']);

    for (const t of threads) {
      const last = chat.messages(t.id).filter((m) => m.role === 'assistant').at(-1)!;
      expect(last.status).toBe('cancelled');
      expect(last.cancelReason).toBe('emergency-stop');
      expect(last.content.length).toBeGreaterThan(0); // yarım içerik korunur
      expect(last.error).toContain('Acil durdurma');
    }
  });

  it('iptal edilen akış yedek modele kaçmaz', async () => {
    const t = chat.createThread({ title: 'Yedek kaçışı' });
    const p = chat
      .stream({ modelId: primaryModelId, messages: [{ role: 'user', content: 'x' }], threadId: t.id } as never, () => {})
      .catch((e: Error) => e.name);
    await new Promise((r) => setTimeout(r, 500));
    c.gateway.abortAll('emergency-stop');
    await p;

    expect(counters.primary).toBe(1);
    expect(counters.fallback).toBe(0); // KRİTİK: yedek sağlayıcıya istek yok
  });

  it('durdurma sırasında yeni istek reddedilir, resume sonrası çalışır', async () => {
    c.gateway.abortAll('emergency-stop');
    await expect(
      chat.stream({ modelId: primaryModelId, messages: [{ role: 'user', content: 'yeni' }] } as never, () => {}),
    ).rejects.toMatchObject({ name: 'AbortError' });

    c.gateway.resume();
    const res = await chat.stream({ modelId: primaryModelId, messages: [{ role: 'user', content: 'devam' }] } as never, () => {});
    expect(res.content.length).toBeGreaterThan(0);
  });

  it('iptal denetim günlüğüne yazılır', async () => {
    const t = chat.createThread({ title: 'Denetim' });
    const p = chat
      .stream({ modelId: primaryModelId, messages: [{ role: 'user', content: 'x' }], threadId: t.id } as never, () => {})
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
    c.gateway.abortAll('emergency-stop');
    await p;
    const rows = c.db.db.prepare("SELECT action FROM audit_logs WHERE module='chat'").all() as Array<{ action: string }>;
    expect(rows.filter((r) => r.action === 'chat.cancelled').length).toBeGreaterThanOrEqual(1);
  });
});

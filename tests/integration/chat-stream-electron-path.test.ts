/**
 * Üretim (paket) yolunda sohbet akışı regresyon testi.
 *
 * KORUDUĞU HATA: `src/services/api.ts` içinde akışlı sohbet `fetch('/api/chat/stream')`
 * ile GÖRELİ yol kullanıyordu. Üretimde arayüz `file://` şemasından yüklendiği için
 * bu istek `file:///api/chat/stream` oluyor ve hiçbir sunucuya ulaşmıyordu; arayüzden
 * gönderilen mesaja yanıt gelmiyordu. Üçüncü denetimde tespit edildi.
 *
 * Bu test, arayüzde göreli `fetch` ÇAĞRILMADIĞINI ve akışın `window.aiWorkstation.stream`
 * köprüsü üzerinden alındığını doğrular.
 */
import { describe, expect, it, vi } from 'vitest';

// `src/services/api.ts` modül yüklenirken `window.aiWorkstation` değerini okur
// (`isDesktop` sabiti). Bu yüzden pencere nesnesi import'tan ÖNCE kurulmalıdır;
// bu yüzden import aşağıda DİNAMİK ve modül gövdesinde yapılır.
(globalThis as unknown as { window: Record<string, unknown> }).window = {
  location: { origin: 'http://localhost:5173' },
};

const { streamChat } = await import('../../src/services/api');

interface Bridge {
  stream: (request: { path: string; body?: unknown }, onChunk: (raw: string) => void, onEnd: () => void) => Promise<{ status: number; ok: boolean }>;
}

function win(): Record<string, unknown> {
  return (globalThis as unknown as { window: Record<string, unknown> }).window;
}

function installBridge(bridge: Partial<Bridge>) {
  win().aiWorkstation = bridge;
}

describe('streamChat — Electron üretim yolu', () => {
  it('göreli fetch yerine IPC akış köprüsünü kullanır', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const chunks = [
      JSON.stringify({ type: 'delta', text: 'Merhaba' }),
      JSON.stringify({ type: 'delta', text: ' dünya' }),
      JSON.stringify({ type: 'done', response: { content: 'Merhaba dünya' } }),
    ];

    installBridge({
      stream: async (_request, onChunk, onEnd) => {
        for (const chunk of chunks) onChunk(chunk);
        onEnd();
        return { status: 200, ok: true };
      },
    });

    const events: Array<Record<string, unknown>> = [];
    await streamChat(
      { modelId: 'm', messages: [{ role: 'user', content: 'selam' }] },
      (event) => events.push(event),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'delta', text: 'Merhaba' });
    expect(events[2]).toMatchObject({ type: 'done' });
  });

  it('akış köprüsü yoksa tarayıcı fetch yoluna düşer', async () => {
    win().aiWorkstation = undefined;
    const fetchSpy = vi.fn(async () => new Response('data: {"type":"delta","text":"x"}\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const events: Array<Record<string, unknown>> = [];
    await streamChat({ modelId: 'm', messages: [] }, (event) => events.push(event));

    expect(fetchSpy).toHaveBeenCalledWith('/api/chat/stream', expect.anything());
    expect(events[0]).toMatchObject({ type: 'delta' });
  });
});

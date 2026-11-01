/**
 * E-48 — İptal edilen sohbet yanıtı 'cancelled' olarak işaretlenir (şartname §15.3).
 * İptal edilen yarım yanıt "tamamlandı" sayılmaz; geçmişte görünür ve iptal nedeni saklanır.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { ChatService } from '../../backend/ai/chat-service.js';
import { createContainer, type Container } from '../../backend/server/container.js';
import { makeTempDir } from '../helpers.js';
import type { LlmGateway } from '../../backend/ai/gateway.js';

describe('sohbet iptali', () => {
  let c: Container;
  let chat: ChatService;
  let mockGateway: LlmGateway & { emergencyMode(v: boolean): void };

  beforeEach(() => {
    c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    let emergency = false;
    const gateway = {
      emergencyMode(value: boolean) {
        emergency = value;
      },
      isAborting: () => emergency,
      chatStream: async (
        _req: unknown,
        onEvent: (e: { type: string; text: string }) => void,
      ): Promise<never> => {
        onEvent({ type: 'delta', text: 'Yarım kalan yanıt' });
        const err = new Error(emergency ? 'Acil durdurma: istek iptal edildi.' : 'The operation was aborted');
        err.name = 'AbortError';
        throw err;
      },
    };
    mockGateway = gateway as unknown as LlmGateway & { emergencyMode(v: boolean): void };
    chat = new ChatService({ db: c.db.db, gateway: mockGateway, providers: c.providers, audit: c.audit });
  });

  it('iptal edilen yanıt cancelled olarak kaydedilir ve yarım içerik korunur', async () => {
    const thread = chat.createThread({ title: 'İptal testi' });
    await expect(
      chat.stream(
        { modelId: 'gpt-4o-mini' as never, messages: [{ role: 'user', content: 'Merhaba' }], threadId: thread.id },
        () => {},
      ),
    ).rejects.toThrow();

    const msgs = chat.messages(thread.id);
    const assistant = msgs.filter((m) => m.role === 'assistant').at(-1);
    expect(assistant).toBeTruthy();
    expect(assistant!.status).toBe('cancelled');
    expect(assistant!.cancelReason).toBe('user');
    expect(assistant!.content).toContain('Yarım kalan yanıt');
    expect(assistant!.status).not.toBe('complete');
  });

  it('acil durdurma iptali ayrı nedenle işaretlenir', async () => {
    const thread = chat.createThread({ title: 'Acil durdurma' });
    mockGateway.emergencyMode(true);
    await expect(
      chat.stream(
        { modelId: 'gpt-4o-mini' as never, messages: [{ role: 'user', content: 'Merhaba' }], threadId: thread.id },
        () => {},
      ),
    ).rejects.toThrow();
    const assistant = chat.messages(thread.id).filter((m) => m.role === 'assistant').at(-1)!;
    expect(assistant.status).toBe('cancelled');
    expect(assistant.cancelReason).toBe('emergency-stop');
    expect(assistant.error).toContain('Acil durdurma');
  });

  it('iptal edilmeyen normal mesaj complete durumundadır', async () => {
    const thread = chat.createThread({ title: 'Normal' });
    const msg = chat.addMessage({ threadId: thread.id, role: 'assistant', content: 'Tam yanıt' });
    expect(msg.status ?? 'complete').toBe('complete');
    expect(chat.messages(thread.id).at(-1)!.status).toBe('complete');
  });

  it('hata alan mesaj failed olarak işaretlenir', async () => {
    const thread = chat.createThread({ title: 'Hata' });
    chat.addMessage({ threadId: thread.id, role: 'assistant', content: '', error: 'sağlayıcı hatası' });
    const last = chat.messages(thread.id).at(-1)!;
    expect(last.status).toBe('failed');
    expect(last.error).toContain('sağlayıcı');
  });
});

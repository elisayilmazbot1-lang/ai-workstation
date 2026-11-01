/**
 * Sohbet servisi — tek sohbet ekranından tüm sistemin yönetimi
 * (şartname §2.2, §4).
 *
 * İki mod:
 *   1. "Sohbet" — doğrudan seçili modelle konuşma.
 *   2. "Görev" — mesaj, ajan orkestratörüne devredilir ve canlı ilerleme
 *      aynı sohbet akışında gösterilir.
 *
 * Komut kısayolları (mesaj başında):
 *   /görev <talep>   → görev başlat
 *   /analiz          → projeyi analiz görevi
 *   /test            → testleri çalıştır
 */
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { ChatRequest, ChatResponse, ChatStreamEvent } from '../../shared/types/models.js';
import type { ChatThread, ChatThreadMessage } from '../../shared/types/app.js';
import type { LlmGateway } from './gateway.js';
import type { ProviderService } from './provider-service.js';
import type { AuditService } from '../security/audit.js';
import { eventBus } from '../orchestration/events.js';
import { redact } from '../security/redaction.js';

export class ChatService {
  constructor(
    private readonly deps: {
      db: Db;
      gateway: LlmGateway;
      providers: ProviderService;
      audit: AuditService;
    },
  ) {}

  listThreads(): ChatThread[] {
    const rows = this.deps.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 100').all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapThread(r));
  }

  createThread(input: { title?: string; projectId?: string; modelId?: string }): ChatThread {
    const id = nanoid(12);
    const at = nowIso();
    this.deps.db
      .prepare('INSERT INTO conversations (id, title, project_id, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.title?.slice(0, 200) || 'Yeni sohbet', input.projectId ?? null, input.modelId ?? null, at, at);
    return this.getThread(id);
  }

  getThread(id: string): ChatThread {
    const row = this.deps.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Sohbet bulunamadı.');
    return this.mapThread(row);
  }

  deleteThread(id: string): void {
    this.deps.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }

  messages(threadId: string): ChatThreadMessage[] {
    const rows = this.deps.db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(threadId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      threadId: String(r.conversation_id),
      role: r.role as ChatThreadMessage['role'],
      content: String(r.content),
      modelId: (r.model_id as string) ?? undefined,
      providerId: (r.provider_id as string) ?? undefined,
      agentRole: (r.agent_role as ChatThreadMessage['agentRole']) ?? undefined,
      taskId: (r.task_id as string) ?? undefined,
      usage: {
        inputTokens: Number(r.usage_input ?? 0),
        outputTokens: Number(r.usage_output ?? 0),
        costUsd: Number(r.usage_cost ?? 0),
      },
      createdAt: String(r.created_at),
      error: (r.error as string) ?? undefined,
      status: (r.status as ChatThreadMessage['status']) ?? 'complete',
      cancelReason: (r.cancel_reason as ChatThreadMessage['cancelReason']) ?? undefined,
    }));
  }

  addMessage(input: {
    threadId: string;
    role: ChatThreadMessage['role'];
    content: string;
    modelId?: string;
    providerId?: string;
    agentRole?: ChatThreadMessage['agentRole'];
    taskId?: string;
    usage?: { inputTokens: number; outputTokens: number; costUsd: number };
    error?: string;
    status?: ChatThreadMessage['status'];
    cancelReason?: ChatThreadMessage['cancelReason'];
  }): ChatThreadMessage {
    const id = nanoid(12);
    const at = nowIso();
    this.deps.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, model_id, provider_id, agent_role, task_id, usage_input, usage_output, usage_cost, error, status, cancel_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.threadId,
        input.role,
        redact(input.content),
        input.modelId ?? null,
        input.providerId ?? null,
        input.agentRole ?? null,
        input.taskId ?? null,
        input.usage?.inputTokens ?? 0,
        input.usage?.outputTokens ?? 0,
        input.usage?.costUsd ?? 0,
        input.error ?? null,
        input.status ?? (input.error ? 'failed' : 'complete'),
        input.cancelReason ?? null,
        at,
      );
    this.deps.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(at, input.threadId);
    // İlk kullanıcı mesajından başlık türet.
    if (input.role === 'user') {
      const thread = this.getThread(input.threadId);
      if (thread.title === 'Yeni sohbet' || thread.title === '') {
        this.deps.db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(input.content.slice(0, 60), input.threadId);
      }
    }
    return this.messages(input.threadId).find((m) => m.id === id)!;
  }

  /** Model yanıtını akış hâlinde üretir. */
  async stream(request: ChatRequest & { threadId?: string }, onEvent: (event: ChatStreamEvent) => void): Promise<ChatResponse> {
    const threadId = request.threadId;
    if (threadId) {
      this.addMessage({ threadId, role: 'user', content: request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '' });
    }
    const chunks: string[] = [];
    let response: ChatResponse;
    try {
      response = await this.deps.gateway.chatStream(request, (event) => {
        if (event.type === 'delta') chunks.push(event.text);
        onEvent(event);
        if (threadId && event.type === 'delta') {
          eventBus.publish({ type: 'chat.delta', threadId, text: event.text });
        }
      });
    } catch (err) {
      // İptal (kullanıcı / acil durdurma / zaman aşımı): yarım yanıt kaybolmaz,
      // 'cancelled' olarak işaretlenir — "tamamlandı" sayılmaz (E-48).
      const cancelled = isAbort(err);
      const reason = cancelled ? (this.deps.gateway.isAborting() ? 'emergency-stop' : 'user') : undefined;
      if (threadId) {
        const saved = this.addMessage({
          threadId,
          role: 'assistant',
          content: chunks.join(''),
          status: cancelled ? 'cancelled' : 'failed',
          cancelReason: reason as 'user' | 'emergency-stop' | undefined,
          error: cancelled
            ? reason === 'emergency-stop'
              ? 'Acil durdurma nedeniyle iptal edildi.'
              : 'Yanıt iptal edildi.'
            : (err as Error).message,
        });
        eventBus.publish({ type: 'chat.done', threadId, messageId: saved.id });
        this.deps.audit.log({
          module: 'chat',
          action: cancelled ? 'chat.cancelled' : 'chat.failed',
          detail: `${threadId} · ${reason ?? 'hata'}`,
          risk: 'low',
        });
      }
      throw err;
    }

    if (threadId) {
      const saved = this.addMessage({
        threadId,
        role: 'assistant',
        content: response.content,
        modelId: response.modelId,
        providerId: response.providerId,
        usage: response.usage,
      });
      eventBus.publish({ type: 'chat.done', threadId, messageId: saved.id });
    }
    return response;
  }

  async complete(request: ChatRequest & { threadId?: string }): Promise<ChatResponse> {
    const threadId = request.threadId;
    const lastUser = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    if (threadId) this.addMessage({ threadId, role: 'user', content: lastUser });
    try {
      const response = await this.deps.gateway.chat(request);
      if (threadId) {
        this.addMessage({
          threadId,
          role: 'assistant',
          content: response.content,
          modelId: response.modelId,
          providerId: response.providerId,
          usage: response.usage,
        });
      }
      return response;
    } catch (err) {
      if (threadId) {
        this.addMessage({ threadId, role: 'assistant', content: '', error: (err as Error).message });
      }
      throw err;
    }
  }

  private mapThread(r: Record<string, unknown>): ChatThread {
    const id = String(r.id);
    const count = (this.deps.db.prepare('SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?').get(id) as { c: number }).c;
    const usage = this.deps.db
      .prepare('SELECT COALESCE(SUM(usage_input),0) a, COALESCE(SUM(usage_output),0) b, COALESCE(SUM(usage_cost),0) c FROM messages WHERE conversation_id = ?')
      .get(id) as { a: number; b: number; c: number };
    return {
      id,
      title: String(r.title),
      projectId: (r.project_id as ChatThread['projectId']) ?? undefined,
      modelId: (r.model_id as string) ?? undefined,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      messageCount: count,
      totalUsage: { inputTokens: usage.a, outputTokens: usage.b, costUsd: usage.c },
    };
  }
}

/** Akışın iptal (AbortError / abort sinyali) nedeniyle mi bittiğini anlar. */
function isAbort(err: unknown): boolean {
  const e = err as { name?: string; message?: string; code?: string } | null;
  if (!e) return false;
  return (
    e.name === 'AbortError' ||
    e.code === 'ABORT_ERR' ||
    /abort|iptal|cancel/i.test(e.message ?? '')
  );
}

/**
 * Canlı olay veri yolu (şartname §18).
 *
 * Görev ilerlemesi, ajan çalışmaları, onaylar ve bildirimler buradan
 * yayınlanır; arayüz SSE ile dinler. Olaylar kalıcı değildir, kalıcı veri
 * veritabanındadır — bu yalnızca canlı akıştır.
 */
import { EventEmitter } from 'node:events';

export type AppEvent =
  | { type: 'task.updated'; taskId: string; status: string; progress: number; title: string }
  | { type: 'task.step'; taskId: string; stepId: string; index: number; role: string; status: string; title: string }
  | { type: 'task.log'; taskId: string; message: string; level: 'info' | 'warn' | 'error' }
  | { type: 'agent.run'; taskId: string; runId: string; role: string; status: string; model?: string }
  | { type: 'approval.created'; approvalId: string; taskId?: string; title: string; risk: string }
  | { type: 'approval.decided'; approvalId: string; status: string }
  | { type: 'notification'; notificationId: string; kind: string; title: string; message: string }
  | { type: 'usage'; taskId?: string; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: 'chat.delta'; threadId: string; text: string }
  | { type: 'chat.done'; threadId: string; messageId: string }
  | { type: 'emergency'; stopped: boolean }
  | { type: 'docker.status'; available: boolean }
  | { type: 'system'; message: string };

class AppEventBus extends EventEmitter {
  private readonly maxListenersPerEvent = 50;

  constructor() {
    super();
    this.setMaxListeners(this.maxListenersPerEvent);
  }

  publish(event: AppEvent): void {
    try {
      this.emit('event', event);
      this.emit(event.type, event);
    } catch {
      // Bir dinleyici hatası olay yayınını engellememelidir.
    }
  }

  subscribe(listener: (event: AppEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}

export const eventBus = new AppEventBus();

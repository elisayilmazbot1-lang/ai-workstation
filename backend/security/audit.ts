/** Denetim günlüğü ve bildirim servisi. */
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { AuditLogEntry, AppNotification } from '../../shared/types/app.js';
import { redact } from './redaction.js';

export class AuditService {
  constructor(private readonly db: Db) {}

  /** Aynı kaydın kısa süre içinde tekrarını engellemek için son kayıt önbelleği. */
  private readonly recent = new Map<string, number>();

  /**
   * @param dedupeSeconds Aynı module+action+detail kaydı bu süre içinde
   *   tekrar yazılmaz (durum yoklamaları günlüğü doldurmasın).
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'at'> & { at?: string; dedupeSeconds?: number }): AuditLogEntry {
    const dedupeKey = `${entry.module}|${entry.action}|${entry.detail ?? ''}`;
    if (entry.dedupeSeconds) {
      const last = this.recent.get(dedupeKey);
      if (last && Date.now() - last < entry.dedupeSeconds * 1000) {
        return { id: 'deduped', at: nowIso(), module: entry.module, action: entry.action, risk: entry.risk, detail: entry.detail, redacted: true };
      }
      this.recent.set(dedupeKey, Date.now());
      if (this.recent.size > 500) {
        const cutoff = Date.now() - 3600_000;
        for (const [key, at] of this.recent) if (at < cutoff) this.recent.delete(key);
      }
    }
    const record: AuditLogEntry = {
      id: nanoid(12),
      at: entry.at ?? nowIso(),
      module: entry.module,
      action: entry.action,
      risk: entry.risk,
      taskId: entry.taskId,
      projectId: entry.projectId,
      detail: entry.detail ? redact(entry.detail).slice(0, 4000) : undefined,
      redacted: true,
    };
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, at, module, action, risk, task_id, project_id, detail, redacted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.at,
        record.module,
        record.action,
        record.risk ?? null,
        record.taskId ?? null,
        record.projectId ?? null,
        record.detail ?? null,
        record.redacted ? 1 : 0,
      );
    return record;
  }

  list(limit = 200, offset = 0): { items: AuditLogEntry[]; total: number } {
    const rows = this.db
      .prepare('SELECT * FROM audit_logs ORDER BY at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as Array<Record<string, unknown>>;
    const total = (this.db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get() as { c: number }).c;
    return {
      total,
      items: rows.map((r) => ({
        id: String(r.id),
        at: String(r.at),
        module: String(r.module),
        action: String(r.action),
        risk: (r.risk as AuditLogEntry['risk']) ?? undefined,
        taskId: (r.task_id as string) ?? undefined,
        projectId: (r.project_id as string) ?? undefined,
        detail: (r.detail as string) ?? undefined,
        redacted: r.redacted === 1,
      })),
    };
  }
}

export class NotificationService {
  constructor(private readonly db: Db) {}

  push(input: Omit<AppNotification, 'id' | 'at' | 'read'>): AppNotification {
    const record: AppNotification = {
      id: nanoid(10),
      at: nowIso(),
      read: false,
      kind: input.kind,
      title: input.title,
      message: redact(input.message),
      taskId: input.taskId,
    };
    this.db
      .prepare('INSERT INTO notifications (id, kind, title, message, read, task_id, at) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(record.id, record.kind, record.title, record.message, record.taskId ?? null, record.at);
    return record;
  }

  list(limit = 100): AppNotification[] {
    const rows = this.db
      .prepare('SELECT * FROM notifications ORDER BY at DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      kind: r.kind as AppNotification['kind'],
      title: String(r.title),
      message: String(r.message),
      at: String(r.at),
      read: r.read === 1,
      taskId: (r.task_id as string) ?? undefined,
    }));
  }

  markRead(options: { all?: boolean; id?: string }): void {
    if (options.all) {
      this.db.prepare('UPDATE notifications SET read = 1').run();
    } else if (options.id) {
      this.db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(options.id);
    }
  }

  unreadCount(): number {
    return (this.db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE read = 0').get() as { c: number }).c;
  }
}

/**
 * Onay kapısı.
 *
 * Yüksek riskli hiçbir işlem onaysız uygulanmaz. Onaylar veritabanında
 * tutulur; uygulama kapansa bile bekleyen onaylar kaybolmaz.
 */
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso, parseJson } from '../database/db.js';
import type { ApprovalKind, ApprovalRequest, ApprovalRisk } from '../../shared/types/agents.js';
import { LIMITS } from '../../shared/constants.js';
import type { AuditService, NotificationService } from './audit.js';

export class ApprovalError extends Error {
  constructor(public readonly code: 'APPROVAL_REQUIRED' | 'APPROVAL_NOT_FOUND' | 'APPROVAL_NOT_PENDING', message: string) {
    super(message);
    this.name = 'ApprovalError';
  }
}

export interface CreateApprovalInput {
  kind: ApprovalKind;
  risk: ApprovalRisk;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  taskId?: string;
  stepId?: string;
  ttlMinutes?: number;
}

export class ApprovalService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  create(input: CreateApprovalInput): ApprovalRequest {
    const id = nanoid(12);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? LIMITS.approvalTtlMinutes) * 60_000).toISOString();
    this.db
      .prepare(
        `INSERT INTO approvals (id, kind, risk, title, description, payload_json, task_id, step_id, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        id,
        input.kind,
        input.risk,
        input.title,
        input.description,
        JSON.stringify(input.payload),
        input.taskId ?? null,
        input.stepId ?? null,
        createdAt,
        expiresAt,
      );
    this.notifications.push({
      kind: input.risk === 'critical' ? 'error' : 'warning',
      title: 'Onay bekliyor',
      message: `${input.title} — ${input.description}`,
      taskId: input.taskId,
    });
    this.audit.log({ module: 'security.approvals', action: 'approval.create', risk: input.risk, detail: input.title, taskId: input.taskId });
    return this.get(id)!;
  }

  get(id: string): ApprovalRequest | undefined {
    const row = this.db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  list(status?: string): ApprovalRequest[] {
    const rows = (
      status
        ? this.db.prepare('SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC').all(status)
        : this.db.prepare('SELECT * FROM approvals ORDER BY created_at DESC').all()
    ) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  approve(id: string, remember = false): ApprovalRequest {
    const request = this.require(id);
    this.db
      .prepare("UPDATE approvals SET status = 'approved', decided_at = ?, decided_by = 'user' WHERE id = ?")
      .run(nowIso(), id);
    this.audit.log({
      module: 'security.approvals',
      action: remember ? 'approval.approve.remember' : 'approval.approve',
      risk: request.risk,
      detail: request.title,
      taskId: request.taskId,
    });
    return this.get(id)!;
  }

  reject(id: string, reason?: string): ApprovalRequest {
    const request = this.require(id);
    this.db
      .prepare("UPDATE approvals SET status = 'rejected', decided_at = ?, decided_by = ? WHERE id = ?")
      .run(nowIso(), reason ? `user: ${reason}` : 'user', id);
    this.audit.log({
      module: 'security.approvals',
      action: 'approval.reject',
      risk: request.risk,
      detail: `${request.title}${reason ? ' — ' + reason : ''}`,
      taskId: request.taskId,
    });
    return this.get(id)!;
  }

  /** İşlem yapılmadan önce onayın geçerliliğini doğrular. */
  assertApproved(id: string | undefined, expectedKind?: ApprovalKind): ApprovalRequest {
    if (!id) throw new ApprovalError('APPROVAL_REQUIRED', 'Bu işlem için kullanıcı onayı gerekiyor.');
    const request = this.get(id);
    if (!request) throw new ApprovalError('APPROVAL_NOT_FOUND', 'Onay kaydı bulunamadı.');
    if (request.status !== 'approved') throw new ApprovalError('APPROVAL_NOT_PENDING', 'İşlem onaylanmamış.');
    if (request.expiresAt && new Date(request.expiresAt).getTime() < Date.now() && request.status !== 'approved') {
      throw new ApprovalError('APPROVAL_NOT_PENDING', 'Onayın süresi doldu.');
    }
    if (expectedKind && request.kind !== expectedKind) throw new ApprovalError('APPROVAL_NOT_FOUND', 'Onay türü uyuşmuyor.');
    return request;
  }

  expireStale(): number {
    const now = nowIso();
    const result = this.db
      .prepare("UPDATE approvals SET status = 'expired' WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?")
      .run(now);
    return result.changes;
  }

  private require(id: string): ApprovalRequest {
    const request = this.get(id);
    if (!request) throw new ApprovalError('APPROVAL_NOT_FOUND', 'Onay kaydı bulunamadı.');
    if (request.status !== 'pending') throw new ApprovalError('APPROVAL_NOT_PENDING', 'Bu onay daha önce karara bağlanmış.');
    return request;
  }

  private mapRow(r: Record<string, unknown>): ApprovalRequest {
    return {
      id: String(r.id),
      kind: r.kind as ApprovalKind,
      risk: r.risk as ApprovalRisk,
      title: String(r.title),
      description: String(r.description),
      payload: parseJson<Record<string, unknown>>(r.payload_json, {}),
      taskId: (r.task_id as string) ?? undefined,
      stepId: (r.step_id as string) ?? undefined,
      createdAt: String(r.created_at),
      expiresAt: (r.expires_at as string) ?? undefined,
      status: r.status as ApprovalRequest['status'],
      decidedAt: (r.decided_at as string) ?? undefined,
      decidedBy: (r.decided_by as string) ?? undefined,
    };
  }
}

/**
 * Görev kayıt servisi (şartname §7).
 *
 * Görevler uygulama kapansa bile kaybolmaz; adımlar ve ajan çalışmaları
 * ayrı tablolarda tutulur ve yeniden başlatmada kaldığı yerden okunur.
 */
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso, parseJson } from '../database/db.js';
import type { AgentRole, AgentRun, TaskRecord, TaskReport, TaskStep, VerificationResult } from '../../shared/types/agents.js';
import type { TaskId } from '../../shared/types/common.js';
import { asTaskId } from '../../shared/types/common.js';
import type { TaskStatus, TaskKind, TaskPriority } from '../../shared/types/agents.js';

export class TaskService {
  constructor(private readonly db: Db) {}

  create(input: { title: string; description: string; projectId?: string; kind?: TaskKind; priority?: TaskPriority; messageId?: string }): TaskRecord {
    const id = asTaskId(nanoid(12));
    const createdAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO tasks (id, project_id, title, description, kind, priority, status, progress, created_at, source_message_id)
         VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)`,
      )
      .run(
        id,
        input.projectId ?? null,
        input.title.slice(0, 300),
        input.description,
        input.kind ?? inferKind(input.description),
        input.priority ?? 'normal',
        createdAt,
        input.messageId ?? null,
      );
    return this.get(id);
  }

  get(id: string): TaskRecord {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error(`Görev bulunamadı: ${id}`);
    return this.mapTask(row);
  }

  list(filter?: { status?: string; projectId?: string }): TaskRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.projectId) {
      conditions.push('project_id = ?');
      params.push(filter.projectId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT 200`).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapTask(r));
  }

  setStatus(id: string, status: TaskStatus, patch?: Partial<{ progress: number; startedAt: string; finishedAt: string; errorCount: number; testStatus: TaskRecord['testStatus']; report: TaskReport; emergencyStopped: boolean }>): TaskRecord {
    const current = this.get(id);
    this.db
      .prepare(
        `UPDATE tasks SET status = ?, progress = ?, started_at = ?, finished_at = ?, error_count = ?, test_status = ?, report_json = ?, emergency_stopped = ?
         WHERE id = ?`,
      )
      .run(
        status,
        patch?.progress ?? current.progress,
        patch?.startedAt ?? current.startedAt ?? null,
        patch?.finishedAt ?? current.finishedAt ?? null,
        patch?.errorCount ?? current.errorCount,
        patch?.testStatus ?? current.testStatus ?? null,
        patch?.report ? JSON.stringify(patch.report) : current.report ? JSON.stringify(current.report) : null,
        (patch?.emergencyStopped ?? current.emergencyStopped) ? 1 : 0,
        id,
      );
    return this.get(id);
  }

  updateProgress(id: string, progress: number): void {
    this.db.prepare('UPDATE tasks SET progress = ? WHERE id = ?').run(Math.max(0, Math.min(100, progress)), id);
  }

  addUsage(id: string, usage: { inputTokens: number; outputTokens: number; costUsd: number }): void {
    this.db
      .prepare('UPDATE tasks SET usage_input = usage_input + ?, usage_output = usage_output + ?, usage_cost = usage_cost + ? WHERE id = ?')
      .run(usage.inputTokens, usage.outputTokens, usage.costUsd, id);
  }

  /* --------------------------------- Adımlar -------------------------------- */

  createSteps(taskId: string, steps: Array<{ role: AgentRole; title: string; dependsOn: string[]; fileLocks: string[] }>): TaskStep[] {
    const insert = this.db.prepare(
      `INSERT INTO task_steps (id, task_id, idx, role, title, status, depends_on, file_locks)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      steps.forEach((step, index) => {
        insert.run(nanoid(10), taskId, index, step.role, step.title, JSON.stringify(step.dependsOn), JSON.stringify(step.fileLocks));
      });
    });
    tx();
    return this.getSteps(taskId);
  }

  getSteps(taskId: string): TaskStep[] {
    const rows = this.db.prepare('SELECT * FROM task_steps WHERE task_id = ? ORDER BY idx ASC').all(taskId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      taskId: asTaskId(String(r.task_id)),
      index: Number(r.idx),
      role: r.role as AgentRole,
      title: String(r.title),
      status: r.status as TaskStep['status'],
      agentRunId: (r.agent_run_id as string) ?? undefined,
      startedAt: (r.started_at as string) ?? undefined,
      finishedAt: (r.finished_at as string) ?? undefined,
      output: (r.output as string) ?? undefined,
      error: (r.error as string) ?? undefined,
      verification: parseJson<VerificationResult[] | undefined>(r.verification_json, undefined),
      dependsOn: parseJson<string[]>(r.depends_on, []),
      fileLocks: parseJson<string[]>(r.file_locks, []),
    }));
  }

  updateStep(
    stepId: string,
    patch: Partial<{
      status: TaskStep['status'];
      output: string;
      error: string;
      agentRunId: string;
      startedAt: string;
      finishedAt: string;
      verification: VerificationResult[];
    }>,
  ): void {
    const current = this.db.prepare('SELECT * FROM task_steps WHERE id = ?').get(stepId) as Record<string, unknown> | undefined;
    if (!current) return;
    this.db
      .prepare(
        `UPDATE task_steps SET status = ?, output = ?, error = ?, agent_run_id = ?, started_at = ?, finished_at = ?, verification_json = ? WHERE id = ?`,
      )
      .run(
        patch.status ?? String(current.status),
        patch.output ?? ((current.output as string) ?? null),
        patch.error ?? ((current.error as string) ?? null),
        patch.agentRunId ?? ((current.agent_run_id as string) ?? null),
        patch.startedAt ?? ((current.started_at as string) ?? null),
        patch.finishedAt ?? ((current.finished_at as string) ?? null),
        patch.verification ? JSON.stringify(patch.verification) : ((current.verification_json as string) ?? null),
        stepId,
      );
  }

  /** Adım bağımlılıklarını (DAG kenarları) günceller. */
  setStepDependencies(stepId: string, dependsOn: string[]): void {
    this.db.prepare('UPDATE task_steps SET depends_on = ? WHERE id = ?').run(JSON.stringify(dependsOn), stepId);
  }

  /* ------------------------------ Ajan çalışması ---------------------------- */

  startRun(input: { taskId: string; stepId?: string; role: AgentRole; modelId?: string; providerId?: string; inputSummary: string }): AgentRun {
    const id = nanoid(12);
    const startedAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO agent_runs (id, task_id, step_id, role, model_id, provider_id, status, input_summary, started_at)
         VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
      )
      .run(id, input.taskId, input.stepId ?? null, input.role, input.modelId ?? null, input.providerId ?? null, input.inputSummary.slice(0, 4000), startedAt);
    return {
      id,
      taskId: asTaskId(input.taskId),
      stepId: input.stepId,
      role: input.role,
      modelId: input.modelId,
      providerId: input.providerId,
      status: 'running',
      inputSummary: input.inputSummary,
      startedAt,
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      toolCallCount: 0,
    };
  }

  finishRun(
    id: string,
    patch: { status: AgentRun['status']; outputSummary?: string; usage?: { inputTokens: number; outputTokens: number; costUsd: number }; error?: string; toolCallCount?: number; modelId?: string; providerId?: string },
  ): void {
    const started = this.db.prepare('SELECT started_at FROM agent_runs WHERE id = ?').get(id) as { started_at: string } | undefined;
    const durationMs = started ? Date.now() - new Date(started.started_at).getTime() : 0;
    this.db
      .prepare(
        `UPDATE agent_runs SET status = ?, output_summary = ?, duration_ms = ?, usage_input = ?, usage_output = ?, usage_cost = ?, tool_call_count = ?, error = ?, finished_at = ?, model_id = COALESCE(?, model_id), provider_id = COALESCE(?, provider_id) WHERE id = ?`,
      )
      .run(
        patch.status,
        patch.outputSummary?.slice(0, 8000) ?? null,
        durationMs,
        patch.usage?.inputTokens ?? 0,
        patch.usage?.outputTokens ?? 0,
        patch.usage?.costUsd ?? 0,
        patch.toolCallCount ?? 0,
        patch.error?.slice(0, 4000) ?? null,
        nowIso(),
        patch.modelId ?? null,
        patch.providerId ?? null,
        id,
      );
  }

  listRuns(taskId?: string, limit = 100): AgentRun[] {
    const rows = (
      taskId
        ? this.db.prepare('SELECT * FROM agent_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?').all(taskId, limit)
        : this.db.prepare('SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?').all(limit)
    ) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      taskId: asTaskId(String(r.task_id)),
      stepId: (r.step_id as string) ?? undefined,
      role: r.role as AgentRole,
      modelId: (r.model_id as string) ?? undefined,
      providerId: (r.provider_id as string) ?? undefined,
      status: r.status as AgentRun['status'],
      inputSummary: String(r.input_summary),
      outputSummary: (r.output_summary as string) ?? undefined,
      startedAt: String(r.started_at),
      finishedAt: (r.finished_at as string) ?? undefined,
      durationMs: (r.duration_ms as number) ?? undefined,
      usage: {
        inputTokens: Number(r.usage_input ?? 0),
        outputTokens: Number(r.usage_output ?? 0),
        costUsd: Number(r.usage_cost ?? 0),
      },
      error: (r.error as string) ?? undefined,
      toolCallCount: Number(r.tool_call_count ?? 0),
    }));
  }

  private mapTask(r: Record<string, unknown>): TaskRecord {
    return {
      id: asTaskId(String(r.id)),
      projectId: (r.project_id as TaskRecord['projectId']) ?? undefined,
      title: String(r.title),
      description: String(r.description),
      kind: r.kind as TaskKind,
      priority: r.priority as TaskPriority,
      status: r.status as TaskStatus,
      progress: Number(r.progress ?? 0),
      createdAt: String(r.created_at),
      startedAt: (r.started_at as string) ?? undefined,
      finishedAt: (r.finished_at as string) ?? undefined,
      createdFromMessageId: (r.source_message_id as string) ?? undefined,
      errorCount: Number(r.error_count ?? 0),
      testStatus: (r.test_status as TaskRecord['testStatus']) ?? undefined,
      totalUsage: {
        inputTokens: Number(r.usage_input ?? 0),
        outputTokens: Number(r.usage_output ?? 0),
        costUsd: Number(r.usage_cost ?? 0),
      },
      report: parseJson<TaskReport | undefined>(r.report_json, undefined),
      emergencyStopped: r.emergency_stopped === 1,
    };
  }
}

function inferKind(description: string): TaskKind {
  const text = description.toLowerCase();
  if (/hata|bug|düzelt|fix/.test(text)) return 'fix-bugs';
  if (/ekle|feature|özellik|yeni/.test(text)) return 'add-feature';
  if (/test/.test(text)) return 'run-tests';
  if (/incele|review|denetle/.test(text)) return 'review-code';
  if (/araştır|research|karşılaştır/.test(text)) return 'research';
  if (/docker/.test(text)) return 'dockerize';
  if (/analiz|incele|tara/.test(text)) return 'analyze-project';
  return 'custom';
}

export type TaskIdType = TaskId;

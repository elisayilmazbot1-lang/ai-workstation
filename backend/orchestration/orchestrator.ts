/**
 * Ajan Orkestratörü — şartnamenin çekirdeği (bölüm 6, 7, 18).
 *
 * Akış:
 *   1. Yönetici ajan planı üretir (JSON adımlar + bağımlılıklar).
 *   2. Adımlar DAG olarak yürütülür; bağımsız adımlar paralel çalışır.
 *   3. Aynı dosyaya yazacak adımlar sıraya alınır (dosya kilidi).
 *   4. Kodlayıcı çıktısı ikinci bir model tarafından denetlenir.
 *   5. Test ajanı gerçek komutları çalıştırır (gerçek çıktı yoksa "başarılı" denmez).
 *   6. Dosya yazımları öneri olarak üretilir; kullanıcı onayı olmadan uygulanmaz.
 *   7. Rapor üretilir ve görev sonuçlandırılır.
 *
 * Kritik kural: bir model "başarılı" dese bile, test/derleme çıktısı yoksa
 * görev "kısmi" olarak raporlanır (şartname §6.12).
 */
import { nanoid } from 'nanoid';
import type { ChatMessage } from '../../shared/types/models.js';
import type { AgentProfile, AgentRole, FileChangeRecord, TaskReport, TaskStep, VerificationResult } from '../../shared/types/agents.js';
import type { TaskRecord } from '../../shared/types/agents.js';
import type { LlmGateway } from '../ai/gateway.js';
import type { ProviderService } from '../ai/provider-service.js';
import type { AgentProfileService } from '../agents/profiles.js';
import type { TaskService } from '../agents/task-service.js';
import { REVISION_PROMPT, SYSTEM_PROMPTS, buildStepUserMessage } from '../agents/prompts.js';
import { extractSummary, parseFileWrites, parsePlan, parseReview, type PlannedStep } from '../agents/parser.js';
import type { ProjectService } from '../projects/project-service.js';
import type { FileService } from '../files/file-service.js';
import type { TestService } from '../testing/test-service.js';
import type { ApprovalService } from '../security/approvals.js';
import type { AuditService, NotificationService } from '../security/audit.js';
import type { SettingsService } from '../memory/settings.js';
import type { TerminalService } from '../terminal/terminal-service.js';
import { buildContextBlock, collectProjectContext, keywordsFromText } from '../ai/context.js';
import { eventBus } from './events.js';
import { containsSecret } from '../security/redaction.js';
import { analyzeCommand, needsApproval } from '../security/command-analyzer.js';

export interface OrchestratorDeps {
  gateway: LlmGateway;
  providers: ProviderService;
  profiles: AgentProfileService;
  tasks: TaskService;
  projects: ProjectService;
  files: FileService;
  tests: TestService;
  approvals: ApprovalService;
  audit: AuditService;
  notifications: NotificationService;
  settings: SettingsService;
  terminal: TerminalService;
  secrets: { listKeys(): string[]; get(key: string): string | undefined };
}

interface RunningTaskState {
  cancelled: boolean;
  paused: boolean;
  controller: AbortController;
  fileLocks: Set<string>;
}

const ROLE_TOPS: Record<AgentRole, string> = {
  manager: 'Yönetici',
  researcher: 'Araştırma',
  architect: 'Mimari',
  coder: 'Kodlama',
  tester: 'Test',
  security: 'Güvenlik',
  performance: 'Performans',
  docs: 'Dokümantasyon',
  browser: 'Tarayıcı',
};

export class AgentOrchestrator {
  private readonly running = new Map<string, RunningTaskState>();
  private emergencyStopped = false;

  constructor(private readonly deps: OrchestratorDeps) {}

  isEmergencyStopped(): boolean {
    return this.emergencyStopped;
  }

  runningCount(): number {
    return this.running.size;
  }

  /* ------------------------------- Başlatma -------------------------------- */

  async start(taskId: string): Promise<TaskRecord> {
    if (this.emergencyStopped) throw new Error('Acil durdurma etkin. Devam etmek için acil durdurmayı kaldırın.');
    const task = this.deps.tasks.get(taskId);
    if (['running', 'planning'].includes(task.status)) return task;
    if (this.running.size >= this.deps.settings.get().agents.maxParallelTasks) {
      throw new Error('Paralel görev sınırına ulaşıldı. Ayarlardan artırabilir veya bekleyen görevi iptal edebilirsiniz.');
    }

    const state: RunningTaskState = { cancelled: false, paused: false, controller: new AbortController(), fileLocks: new Set() };
    this.running.set(taskId, state);
    this.deps.tasks.setStatus(taskId, 'planning', { startedAt: new Date().toISOString(), progress: 2 });
    eventBus.publish({ type: 'task.updated', taskId, status: 'planning', progress: 2, title: task.title });

    // Arka planda çalıştır; HTTP isteği hemen döner.
    void this.execute(task, state).catch((err) => {
      this.deps.audit.log({ module: 'orchestrator', action: 'task.crash', detail: (err as Error).message, risk: 'high', taskId });
      this.deps.tasks.setStatus(taskId, 'failed', { finishedAt: new Date().toISOString(), progress: 100 });
      eventBus.publish({ type: 'task.updated', taskId, status: 'failed', progress: 100, title: task.title });
    });

    return this.deps.tasks.get(taskId);
  }

  pause(taskId: string): TaskRecord {
    const state = this.running.get(taskId);
    if (state) state.paused = true;
    return this.deps.tasks.setStatus(taskId, 'paused');
  }

  resume(taskId: string): TaskRecord {
    const state = this.running.get(taskId);
    if (state) {
      state.paused = false;
      this.deps.tasks.setStatus(taskId, 'running');
      return this.deps.tasks.get(taskId);
    }
    // Süreç yoksa yeniden başlat (uygulama kapanıp açıldıysa).
    return this.deps.tasks.setStatus(taskId, 'queued');
  }

  cancel(taskId: string): TaskRecord {
    const state = this.running.get(taskId);
    if (state) {
      state.cancelled = true;
      state.controller.abort();
    }
    eventBus.publish({ type: 'task.updated', taskId, status: 'cancelled', progress: 100, title: this.deps.tasks.get(taskId).title });
    return this.deps.tasks.setStatus(taskId, 'cancelled', { finishedAt: new Date().toISOString() });
  }

  /** Şartname §14.5 — tüm ajanları ve komutları durdurur. */
  emergencyStop(): { stopped: true; affected: number } {
    this.emergencyStopped = true;
    const affected = this.running.size;
    for (const [taskId, state] of this.running) {
      state.cancelled = true;
      state.controller.abort();
      this.deps.tasks.setStatus(taskId, 'paused', { emergencyStopped: true });
      eventBus.publish({ type: 'task.updated', taskId, status: 'paused', progress: this.deps.tasks.get(taskId).progress, title: 'Acil durdurma' });
    }
    this.deps.terminal.cancelAll();
    this.deps.audit.log({ module: 'security', action: 'emergency.stop', detail: `${affected} görev durduruldu`, risk: 'critical' });
    this.deps.notifications.push({ kind: 'warning', title: 'Acil durdurma etkin', message: 'Tüm ajanlar ve komutlar durduruldu. Devam etmek için acil durdurmayı kaldırın.' });
    eventBus.publish({ type: 'emergency', stopped: true });
    return { stopped: true, affected };
  }

  resumeEmergency(): { resumed: true } {
    this.emergencyStopped = false;
    this.running.clear();
    eventBus.publish({ type: 'emergency', stopped: false });
    this.deps.audit.log({ module: 'security', action: 'emergency.resume', risk: 'medium' });
    return { resumed: true };
  }

  /* ------------------------------ Yürütme ---------------------------------- */

  private async execute(task: TaskRecord, state: RunningTaskState): Promise<void> {
    const log = (message: string, level: 'info' | 'warn' | 'error' = 'info') =>
      eventBus.publish({ type: 'task.log', taskId: task.id, message, level });

    log('Yönetici ajan görevi analiz ediyor…');
    const plan = await this.plan(task, state);
    if (state.cancelled) return;

    log(`Plan hazır: ${plan.plan.length} adım. ${plan.parseMode === 'fallback' ? '(Varsayılan iş akışı kullanıldı.)' : ''}`);

    // Adımları veritabanına yaz.
    const stepRecords = this.deps.tasks.createSteps(
      task.id,
      plan.plan.map((step) => ({
        role: step.role,
        title: step.title,
        dependsOn: [] as string[], // kimlikler oluşturulduktan sonra bağlanır
        fileLocks: step.files,
      })),
    );
    // dependsOn indekslerini kimliklere çevir.
    for (let i = 0; i < plan.plan.length; i += 1) {
      const ids = (plan.plan[i]?.dependsOn ?? []).map((idx) => stepRecords[idx]?.id).filter((v): v is string => Boolean(v));
      if (ids.length) {
        const step = stepRecords[i]!;
        this.deps.tasks.setStepDependencies(step.id, ids);
      }
    }

    this.deps.tasks.setStatus(task.id, 'running', { progress: 8 });
    eventBus.publish({ type: 'task.updated', taskId: task.id, status: 'running', progress: 8, title: task.title });

    const results = new Map<string, { role: AgentRole; title: string; output: string; ok: boolean; verification: VerificationResult[] }>();
    const proposedChanges: FileChangeRecord[] = [];
    const errors: string[] = [];
    const steps = this.deps.tasks.getSteps(task.id);
    const total = steps.length || 1;
    let completed = 0;

    // Bağımlılık sırasına göre dalgalar hâlinde çalıştır.
    const pending = new Set(steps.map((s) => s.id));
    while (pending.size > 0) {
      if (state.cancelled) {
        log('Görev iptal edildi.', 'warn');
        break;
      }
      while (state.paused && !state.cancelled) await sleep(500);
      if (state.cancelled) break;

      const ready = steps.filter(
        (s) => pending.has(s.id) && s.dependsOn.every((dep) => !pending.has(dep)),
      );
      if (!ready.length) break; // döngüsel bağımlılık veya çözülemeyen graf

      await Promise.all(
        ready.map(async (step) => {
          const result = await this.runStep(task, step, state, results, proposedChanges, errors, plan);
          pending.delete(step.id);
          completed += 1;
          const progress = Math.min(92, 8 + Math.round((completed / total) * 80));
          this.deps.tasks.updateProgress(task.id, progress);
          eventBus.publish({ type: 'task.updated', taskId: task.id, status: 'running', progress, title: task.title });
          results.set(step.id, result);
        }),
      );
    }

    if (state.cancelled) {
      this.running.delete(task.id);
      return;
    }

    // ---- Son doğrulama: gerçek testler ----
    log('Doğrulama testleri çalıştırılıyor…');
    let testReport: Awaited<ReturnType<TestService['run']>> | undefined;
    if (task.projectId) {
      try {
        testReport = await this.deps.tests.run(task.projectId, ['typecheck', 'unit', 'build']);
      } catch (err) {
        errors.push(`Test çalıştırılamadı: ${(err as Error).message}`);
      }
    }

    const verificationResults: VerificationResult[] = [];
    if (testReport) {
      for (const suite of testReport.suites) {
        verificationResults.push({
          kind: suite.kind === 'typecheck' ? 'typecheck' : suite.kind === 'build' ? 'build' : 'test',
          command: suite.command,
          ok: suite.outcome === 'passed',
          summary: `${suite.kind}: ${suite.outcome}${suite.notRunReason ? ` — ${suite.notRunReason}` : ''} (${suite.passed}/${suite.total})`,
          durationMs: suite.durationMs,
          at: suite.at,
        });
      }
    }

    // ---- Rapor ----
    const testStatus: TaskRecord['testStatus'] =
      !testReport || testReport.overall === 'not-run'
        ? 'not-run'
        : testReport.overall === 'passed'
          ? 'passed'
          : 'failed';

    const stepsNow = this.deps.tasks.getSteps(task.id);
    const report = this.buildReport(task, plan.risks, stepsNow, results, proposedChanges, verificationResults, errors, testStatus);
    const finalStatus = errors.length && testStatus === 'failed' ? 'failed' : 'completed';

    this.deps.tasks.setStatus(task.id, finalStatus, {
      progress: 100,
      finishedAt: new Date().toISOString(),
      report,
      testStatus,
      errorCount: errors.length,
    });
    this.running.delete(task.id);

    this.deps.notifications.push({
      kind: finalStatus === 'completed' ? (report.finalResult === 'success' ? 'success' : 'warning') : 'error',
      title: finalStatus === 'completed' ? 'Görev tamamlandı' : 'Görev başarısız',
      message: report.summary,
      taskId: task.id,
    });
    eventBus.publish({ type: 'task.updated', taskId: task.id, status: finalStatus, progress: 100, title: task.title });
    this.deps.audit.log({ module: 'orchestrator', action: 'task.finish', detail: `${task.id} → ${finalStatus}`, taskId: task.id, risk: 'low' });
  }

  /* --------------------------------- Plan ---------------------------------- */

  private async plan(task: TaskRecord, state: RunningTaskState): Promise<ReturnType<typeof parsePlan>> {
    const manager = this.deps.profiles.get('manager');
    const modelId = this.managerModel(manager);
    if (!modelId) {
      return parsePlan('', task.title, task.description);
    }

    let contextBlock = '';
    if (task.projectId) {
      try {
        const project = this.deps.projects.get(task.projectId);
        const ctx = collectProjectContext(project.rootPath, {
          maxFiles: 12,
          maxCharsPerFile: 6000,
          maxTotalChars: 30_000,
          keywords: keywordsFromText(`${task.title} ${task.description}`),
        });
        contextBlock = buildContextBlock(ctx.files);
      } catch {
        contextBlock = '';
      }
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPTS.manager },
      {
        role: 'user',
        content: buildStepUserMessage({
          role: 'manager',
          taskTitle: task.title,
          taskDescription: task.description,
          instruction: 'Görevi adımlara böl ve JSON plan döndür.',
          contextBlock,
          previousOutputs: [],
          projectInfo: task.projectId ? this.projectInfo(task.projectId) : undefined,
        }),
      },
    ];

    const run = this.deps.tasks.startRun({ taskId: task.id, role: 'manager', modelId, inputSummary: task.description.slice(0, 1000) });
    eventBus.publish({ type: 'agent.run', taskId: task.id, runId: run.id, role: 'manager', status: 'running', model: modelId });

    try {
      const response = await this.deps.gateway.chat(
        { modelId, messages, temperature: 0.1, maxOutputTokens: 3000, signal: state.controller.signal },
        { fallbackModelId: manager.fallbackModelId, purpose: 'plan', agentRole: 'manager', taskId: task.id },
      );
      this.deps.tasks.finishRun(run.id, {
        status: 'completed',
        outputSummary: response.content.slice(0, 4000),
        usage: response.usage,
        modelId: response.modelId,
        providerId: response.providerId,
      });
      this.deps.tasks.addUsage(task.id, response.usage);
      eventBus.publish({ type: 'agent.run', taskId: task.id, runId: run.id, role: 'manager', status: 'completed', model: response.modelId });
      eventBus.publish({ type: 'usage', taskId: task.id, ...response.usage });
      return parsePlan(response.content, task.title, task.description);
    } catch (err) {
      this.deps.tasks.finishRun(run.id, { status: 'failed', error: (err as Error).message });
      eventBus.publish({ type: 'agent.run', taskId: task.id, runId: run.id, role: 'manager', status: 'failed' });
      // Planlama başarısız olsa bile görev güvenli varsayılan akışla ilerler.
      return parsePlan('', task.title, task.description);
    }
  }

  private managerModel(profile: AgentProfile): string | undefined {
    if (profile.modelId) return profile.modelId;
    const settings = this.deps.settings.get();
    if (settings.ai.defaultModelId) return settings.ai.defaultModelId;
    const models = this.deps.providers.listModels({});
    const free = settings.ai.preferFreeModels ? models.find((m) => m.freeStatus === 'free' || m.freeStatus === 'free-tier') : undefined;
    return (free ?? models[0])?.id;
  }

  private projectInfo(projectId: string): { name: string; rootPath: string } | undefined {
    try {
      const p = this.deps.projects.get(projectId);
      return { name: p.name, rootPath: p.rootPath };
    } catch {
      return undefined;
    }
  }

  /* --------------------------------- Adım ---------------------------------- */

  private async runStep(
    task: TaskRecord,
    step: TaskStep,
    state: RunningTaskState,
    results: Map<string, { role: AgentRole; title: string; output: string; ok: boolean; verification: VerificationResult[] }>,
    proposedChanges: FileChangeRecord[],
    errors: string[],
    plan: ReturnType<typeof parsePlan>,
  ): Promise<{ role: AgentRole; title: string; output: string; ok: boolean; verification: VerificationResult[] }> {
    if (state.cancelled) return { role: step.role, title: step.title, output: '', ok: false, verification: [] };

    // Dosya kilidi: aynı dosyaya yazan adımlar bekler.
    const locks = step.fileLocks;
    await this.acquireLocks(state, locks);

    const profile = this.deps.profiles.get(step.role);
    const modelId = this.resolveAgentModel(profile);

    this.deps.tasks.updateStep(step.id, { status: 'running', startedAt: new Date().toISOString() });
    eventBus.publish({ type: 'task.step', taskId: task.id, stepId: step.id, index: step.index, role: step.role, status: 'running', title: step.title });

    if (!modelId) {
      const message = 'Bu ajan için model atanmamış ve kullanılabilir model yok. Model Merkezi\'nden sağlayıcı ekleyin.';
      this.deps.tasks.updateStep(step.id, { status: 'failed', error: message, finishedAt: new Date().toISOString() });
      errors.push(`${ROLE_TOPS[step.role]}: ${message}`);
      eventBus.publish({ type: 'task.step', taskId: task.id, stepId: step.id, index: step.index, role: step.role, status: 'failed', title: step.title });
      this.releaseLocks(state, locks);
      return { role: step.role, title: step.title, output: '', ok: false, verification: [] };
    }

    // Bağımlı adımların çıktıları bağlam olarak verilir.
    const previousOutputs = step.dependsOn
      .map((dep) => results.get(dep))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({ role: r.role, title: r.title, output: r.output }));

    let contextBlock = '';
    if (task.projectId) {
      try {
        const project = this.deps.projects.get(task.projectId);
        const keywords = keywordsFromText(`${task.title} ${step.title} ${step.fileLocks.join(' ')} ${task.description}`);
        const ctx = collectProjectContext(project.rootPath, {
          maxFiles: step.role === 'coder' ? 18 : 10,
          maxCharsPerFile: 8000,
          maxTotalChars: 60_000,
          keywords: step.fileLocks.length ? [...step.fileLocks.map((f) => f.split('/').pop() ?? f), ...keywords] : keywords,
        });
        contextBlock = buildContextBlock(ctx.files);
      } catch {
        /* bağlam yoksa devam */
      }
    }

    const plannedStep: PlannedStep | undefined = plan.plan[step.index];
    const instruction = plannedStep?.instruction || step.title;
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPTS[step.role] },
      {
        role: 'user',
        content: buildStepUserMessage({
          role: step.role,
          taskTitle: task.title,
          taskDescription: task.description,
          instruction,
          contextBlock,
          previousOutputs,
          projectInfo: task.projectId ? this.projectInfo(task.projectId) : undefined,
        }),
      },
    ];

    const run = this.deps.tasks.startRun({
      taskId: task.id,
      stepId: step.id,
      role: step.role,
      modelId,
      inputSummary: instruction.slice(0, 1000),
    });
    this.deps.tasks.updateStep(step.id, { agentRunId: run.id });
    eventBus.publish({ type: 'agent.run', taskId: task.id, runId: run.id, role: step.role, status: 'running', model: modelId });

    try {
      const response = await this.deps.gateway.chat(
        { modelId, messages, temperature: profile.temperature, maxOutputTokens: 6000, signal: state.controller.signal },
        { fallbackModelId: profile.fallbackModelId, purpose: `step:${step.role}`, agentRole: step.role, taskId: task.id },
      );

      // Gizli bilgi sızıntısı kontrolü.
      let output = response.content;
      for (const key of this.deps.secrets.listKeys()) {
        const secret = this.deps.secrets.get(key);
        if (secret && containsSecret(output, secret)) {
          output = output.split(secret).join('***REDACTED***');
          errors.push('Model çıktısında bir API anahtarı tespit edildi ve maskelendi. Güvenlik ajanı incelesin.');
          this.deps.audit.log({ module: 'security', action: 'secret.leak.blocked', detail: key, risk: 'critical', taskId: task.id });
        }
      }

      this.deps.tasks.finishRun(run.id, {
        status: 'completed',
        outputSummary: output.slice(0, 6000),
        usage: response.usage,
        modelId: response.modelId,
        providerId: response.providerId,
      });
      this.deps.tasks.addUsage(task.id, response.usage);
      eventBus.publish({ type: 'usage', taskId: task.id, ...response.usage });
      eventBus.publish({ type: 'agent.run', taskId: task.id, runId: run.id, role: step.role, status: 'completed', model: response.modelId });

      const verification: VerificationResult[] = [];

      // ---- Kodlama adımı: dosya yazma önerileri + bağımsız denetim ----
      if (step.role === 'coder' || step.role === 'docs') {
        const writes = parseFileWrites(output);
        if (writes.length && task.projectId) {
          const review = await this.reviewChanges(task, step, writes, state);
          verification.push({
            kind: 'security-scan',
            ok: review.verdict === 'approve' || review.issues.every((i) => i.severity === 'low'),
            summary:
              review.verdict === 'approve'
                ? `Bağımsız model denetimi: onaylandı (güven ${review.confidence}).`
                : `Bağımsız model denetimi: düzeltme önerildi — ${review.issues.map((i) => i.description).slice(0, 3).join('; ')}`,
            at: new Date().toISOString(),
          });
          if (review.verdict === 'revise') {
            eventBus.publish({ type: 'task.log', taskId: task.id, message: `Denetçi model düzeltme önerdi: ${review.issues.map((i) => i.description).slice(0, 2).join(' | ')}`, level: 'warn' });
          }

          for (const write of writes) {
            try {
              const existing = safeRead(this.deps.files, task.projectId, write.path);
              const change = this.deps.files.recordChange({
                projectId: task.projectId,
                path: write.path,
                operation: existing === undefined ? 'create' : 'update',
                oldContent: existing ?? '',
                newContent: write.content,
                summary: `${ROLE_TOPS[step.role]} ajanı tarafından önerildi: ${write.path}`,
                status: 'proposed',
                taskId: task.id,
                agentRole: step.role,
              });
              proposedChanges.push(change);
            } catch (err) {
              errors.push(`Dosya önerisi kaydedilemedi (${write.path}): ${(err as Error).message}`);
            }
          }

          if (proposedChanges.length) {
            const approval = this.deps.approvals.create({
              kind: 'file-write',
              risk: 'medium',
              title: `${proposedChanges.length} dosya değişikliği onay bekliyor`,
              description: proposedChanges.map((c) => `• ${c.operation === 'create' ? 'Yeni' : 'Güncelle'} ${c.path}`).join('\n'),
              payload: {
                changeIds: proposedChanges.map((c) => c.id),
                contentHashes: Object.fromEntries(proposedChanges.map((c) => [c.id, this.deps.files.changeContentHash(c)])),
                taskId: task.id,
              },
              taskId: task.id,
              stepId: step.id,
            });
            eventBus.publish({ type: 'approval.created', approvalId: approval.id, taskId: task.id, title: approval.title, risk: approval.risk });
          }
        }
      }

      // ---- Test adımı: gerçekten çalıştır ----
      if (step.role === 'tester' && task.projectId) {
        const report = await this.deps.tests.run(task.projectId, ['typecheck', 'unit']);
        for (const suite of report.suites) {
          verification.push({
            kind: suite.kind === 'typecheck' ? 'typecheck' : 'test',
            command: suite.command,
            ok: suite.outcome === 'passed',
            summary: `${suite.kind}: ${suite.outcome}${suite.notRunReason ? ` — ${suite.notRunReason}` : ` (${suite.passed}/${suite.total})`}`,
            durationMs: suite.durationMs,
            at: suite.at,
          });
          if (suite.outcome === 'failed') {
            errors.push(`Test başarısız (${suite.kind}): ${suite.cases.find((c) => c.outcome === 'failed')?.error?.slice(0, 400) ?? 'ayrıntı yok'}`);
          }
        }
        output += `\n\n## Gerçek test sonucu\n${report.suites
          .map((s) => `- ${s.kind}: ${s.outcome}${s.notRunReason ? ` (${s.notRunReason})` : ''}`)
          .join('\n')}`;
      }

      // ---- Güvenlik adımı: statik tarama ----
      if (step.role === 'security') {
        const scan = this.staticSecurityScan(task);
        verification.push(...scan);
        output += `\n\n## Otomatik güvenlik taraması\n${scan.map((s) => `- ${s.ok ? '✅' : '⚠️'} ${s.summary}`).join('\n') || '- Bulgu yok'}`;
      }

      this.deps.tasks.updateStep(step.id, {
        status: 'completed',
        output: output.slice(0, 20_000),
        finishedAt: new Date().toISOString(),
        verification,
      });
      eventBus.publish({ type: 'task.step', taskId: task.id, stepId: step.id, index: step.index, role: step.role, status: 'completed', title: step.title });

      return { role: step.role, title: step.title, output, ok: true, verification };
    } catch (err) {
      const message = (err as Error).message;
      this.deps.tasks.finishRun(run.id, { status: 'failed', error: message });
      this.deps.tasks.updateStep(step.id, { status: 'failed', error: message, finishedAt: new Date().toISOString() });
      errors.push(`${ROLE_TOPS[step.role]} adımı başarısız: ${message}`);
      eventBus.publish({ type: 'agent.run', taskId: task.id, runId: run.id, role: step.role, status: 'failed' });
      eventBus.publish({ type: 'task.step', taskId: task.id, stepId: step.id, index: step.index, role: step.role, status: 'failed', title: step.title });
      return { role: step.role, title: step.title, output: '', ok: false, verification: [] };
    } finally {
      this.releaseLocks(state, locks);
    }
  }

  private resolveAgentModel(profile: AgentProfile): string | undefined {
    const settings = this.deps.settings.get();
    const models = this.deps.providers.listModels({});
    if (profile.modelId && models.some((m) => m.id === profile.modelId)) return profile.modelId;
    if (settings.ai.defaultModelId && models.some((m) => m.id === settings.ai.defaultModelId)) return settings.ai.defaultModelId;
    const free = settings.ai.preferFreeModels ? models.find((m) => m.freeStatus === 'free' || m.freeStatus === 'free-tier') : undefined;
    return (free ?? models[0])?.id;
  }

  /** Bağımsız denetim: kodlayıcıdan FARKLI bir model kullanmayı dener. */
  private async reviewChanges(
    task: TaskRecord,
    step: TaskStep,
    writes: Array<{ path: string; content: string }>,
    state: RunningTaskState,
  ): Promise<ReturnType<typeof parseReview>> {
    const models = this.deps.providers.listModels({});
    const coderModel = this.deps.profiles.get('coder').modelId;
    const reviewer =
      models.find((m) => m.id !== coderModel && (m.capabilities.includes('coding') || m.capabilities.includes('reasoning'))) ?? models[0];
    if (!reviewer) return parseReview('');

    const payload = writes
      .slice(0, 6)
      .map((w) => `### ${w.path}\n\`\`\`\n${w.content.slice(0, 8000)}\n\`\`\``)
      .join('\n\n');

    const run = this.deps.tasks.startRun({
      taskId: task.id,
      stepId: step.id,
      role: 'security',
      modelId: reviewer.id,
      inputSummary: `Bağımsız kod denetimi (${writes.length} dosya)`,
    });

    try {
      const response = await this.deps.gateway.chat(
        {
          modelId: reviewer.id,
          messages: [
            { role: 'system', content: REVISION_PROMPT },
            {
              role: 'user',
              content: `GÖREV: ${task.title}\n${task.description}\n\nÖNERİLEN DEĞİŞİKLİKLER:\n${payload}`,
            },
          ],
          temperature: 0.1,
          maxOutputTokens: 1500,
          signal: state.controller.signal,
        },
        { purpose: 'review', agentRole: 'security', taskId: task.id },
      );
      this.deps.tasks.finishRun(run.id, {
        status: 'completed',
        outputSummary: response.content.slice(0, 4000),
        usage: response.usage,
        modelId: response.modelId,
      });
      this.deps.tasks.addUsage(task.id, response.usage);
      eventBus.publish({ type: 'usage', taskId: task.id, ...response.usage });
      return parseReview(response.content);
    } catch {
      this.deps.tasks.finishRun(run.id, { status: 'failed', error: 'Denetim modeli yanıt vermedi.' });
      return parseReview('');
    }
  }

  /** Deterministik güvenlik taraması — model yorumuna bağlı değildir. */
  private staticSecurityScan(task: TaskRecord): VerificationResult[] {
    const results: VerificationResult[] = [];
    if (!task.projectId) {
      return [{ kind: 'security-scan', ok: true, summary: 'Proje bağlı olmadığı için dosya taraması yapılmadı.', at: new Date().toISOString() }];
    }
    try {
      const project = this.deps.projects.get(task.projectId);
      const ctx = collectProjectContext(project.rootPath, {
        maxFiles: 60,
        maxCharsPerFile: 20_000,
        maxTotalChars: 400_000,
        keywords: [],
      });
      const secretPatterns = [/sk-[A-Za-z0-9]{20,}/, /AIza[0-9A-Za-z_-]{30,}/, /(api[_-]?key|password)\s*[:=]\s*["'][^"']{12,}["']/i];
      const injectionPatterns = [/eval\s*\(/, /child_process/, /exec\s*\(\s*(req|params|query)/, /\.\.\/\.\.\//];
      let secretHits = 0;
      let injectionHits = 0;
      for (const file of ctx.files) {
        if (secretPatterns.some((p) => p.test(file.content))) {
          secretHits += 1;
          results.push({ kind: 'security-scan', ok: false, summary: `Olası gizli bilgi: ${file.path}`, at: new Date().toISOString() });
        }
        if (injectionPatterns.some((p) => p.test(file.content))) {
          injectionHits += 1;
          results.push({ kind: 'security-scan', ok: false, summary: `Olası enjeksiyon riski: ${file.path}`, at: new Date().toISOString() });
        }
      }
      results.push({
        kind: 'security-scan',
        ok: secretHits === 0 && injectionHits === 0,
        summary: `${ctx.files.length} dosya tarandı — ${secretHits} gizli bilgi şüphesi, ${injectionHits} enjeksiyon şüphesi.`,
        at: new Date().toISOString(),
      });
    } catch (err) {
      results.push({ kind: 'security-scan', ok: false, summary: `Tarama yapılamadı: ${(err as Error).message}`, at: new Date().toISOString() });
    }
    return results;
  }

  private async acquireLocks(state: RunningTaskState, locks: string[]): Promise<void> {
    if (!locks.length) return;
    let waited = 0;
    while (locks.some((l) => state.fileLocks.has(l))) {
      await sleep(300);
      waited += 300;
      if (waited > 120_000) break;
    }
    for (const lock of locks) state.fileLocks.add(lock);
  }

  private releaseLocks(state: RunningTaskState, locks: string[]): void {
    for (const lock of locks) state.fileLocks.delete(lock);
  }

  private buildReport(
    task: TaskRecord,
    risks: string[],
    steps: TaskStep[],
    results: Map<string, { role: AgentRole; title: string; output: string; ok: boolean; verification: VerificationResult[] }>,
    changes: FileChangeRecord[],
    verification: VerificationResult[],
    errors: string[],
    testStatus: TaskRecord['testStatus'],
  ): TaskReport {
    const runs = this.deps.tasks.listRuns(task.id);
    const anyNotRun = testStatus === 'not-run';
    const hasRealEvidence = verification.some((v) => v.ok && ['test', 'typecheck', 'build'].includes(v.kind));
    const finalResult: TaskReport['finalResult'] =
      errors.length && testStatus === 'failed' ? 'failed' : hasRealEvidence && !errors.length ? 'success' : 'partial';

    const summaryParts = [
      `${steps.filter((s) => s.status === 'completed').length}/${steps.length} adım tamamlandı.`,
      changes.length ? `${changes.length} dosya değişikliği önerildi (onay bekliyor).` : 'Dosya değişikliği önerilmedi.',
      testStatus === 'passed' ? 'Testler geçti.' : testStatus === 'failed' ? 'Testler başarısız.' : 'Test çalıştırılmadı — sonuç kısmi kabul edilir.',
      errors.length ? `${errors.length} hata kaydı var.` : 'Hata kaydı yok.',
      anyNotRun ? 'Not: doğrulama çıktısı bulunmadığı için model beyanı tek başına yeterli sayılmadı.' : '',
    ].filter(Boolean);

    return {
      taskId: task.id,
      title: task.title,
      summary: summaryParts.join(' '),
      actions: steps.map((s) => `${s.index + 1}. [${ROLE_TOPS[s.role]}] ${s.title}: ${s.status}`),
      modelsUsed: [...new Set(runs.map((r) => r.modelId).filter((v): v is string => Boolean(v)))],
      agentsUsed: [...new Set(steps.map((s) => s.role))],
      changedFiles: changes.filter((c) => c.operation === 'update').map((c) => c.path),
      createdFiles: changes.filter((c) => c.operation === 'create').map((c) => c.path),
      tests: verification,
      errors: [...errors, ...risks.map((r) => `Risk: ${r}`)],
      securityChecks: results.get(steps.find((s) => s.role === 'security')?.id ?? '')?.verification.map((v) => v.summary) ?? [],
      finalResult,
      generatedAt: new Date().toISOString(),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeRead(files: FileService, projectId: string, path: string): string | undefined {
  try {
    return files.read(projectId, path).content;
  } catch {
    return undefined;
  }
}

export { analyzeCommand, needsApproval };
export const _nanoid = nanoid;

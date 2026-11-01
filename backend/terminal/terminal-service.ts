/**
 * Terminal servisi (şartname §10).
 *
 * - Tek uzun ömürlü kabuk süreci yerine komut başına süreç: çıktı izole,
 *   iptal güvenli, asılı kalan süreç riski yok.
 * - Risk sınıflandırması ve onay zorunluluğu burada uygulanır.
 * - Çıktı boyutu ve süre sınırlandırılır.
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { CommandAnalysis, ShellKind, TerminalCommandRecord, TerminalRunRequest, TerminalRunResult, TerminalSessionInfo } from '../../shared/types/runtime.js';
import { LIMITS } from '../../shared/constants.js';
import { analyzeCommand, needsApproval } from '../security/command-analyzer.js';
import type { ApprovalService } from '../security/approvals.js';
import type { AuditService } from '../security/audit.js';
import type { SettingsService } from '../memory/settings.js';
import { redact, redactText } from '../security/redaction.js';

export interface TerminalServiceDeps {
  db: Db;
  approvals: ApprovalService;
  audit: AuditService;
  settings: SettingsService;
  /** Acil durdurma durumunu bildirir; etkinken hiçbir komut çalışmaz. */
  isEmergencyStopped?: () => boolean;
}

interface RunningCommand {
  child: ChildProcessWithoutNullStreams;
  cancelled: boolean;
}

export class TerminalService {
  private readonly running = new Map<string, RunningCommand>();
  private readonly sessions = new Map<string, { shell: ShellKind; cwd: string; startedAt: string }>();

  constructor(private readonly deps: TerminalServiceDeps) {}

  /* -------------------------------- Oturumlar ------------------------------- */

  listSessions(): TerminalSessionInfo[] {
    return [...this.sessions.entries()].map(([id, s]) => ({
      id,
      shell: s.shell,
      cwd: s.cwd,
      startedAt: s.startedAt,
      running: [...this.running.values()].some((r) => !r.cancelled),
    }));
  }

  createSession(input: { shell?: ShellKind; cwd: string }): TerminalSessionInfo {
    const shell = (input.shell as ShellKind) ?? this.deps.settings.get().terminal.defaultShell;
    const id = nanoid(10);
    const startedAt = nowIso();
    this.sessions.set(id, { shell, cwd: input.cwd, startedAt });
    this.deps.db.prepare('INSERT INTO terminal_sessions (id, shell, cwd, started_at) VALUES (?, ?, ?, ?)').run(id, shell, input.cwd, startedAt);
    return { id, shell, cwd: input.cwd, startedAt, running: false };
  }

  closeSession(id: string): void {
    this.sessions.delete(id);
    this.deps.db.prepare('UPDATE terminal_sessions SET finished_at = ? WHERE id = ?').run(nowIso(), id);
  }

  /* --------------------------------- Analiz -------------------------------- */

  analyze(command: string): CommandAnalysis {
    return analyzeCommand(command);
  }

  /* --------------------------------- Çalışma ------------------------------- */

  async run(request: TerminalRunRequest): Promise<TerminalRunResult> {
    // Acil durdurma etkinken hiçbir komut çalıştırılmaz (onaylı olsa bile).
    if (this.deps.isEmergencyStopped?.()) {
      throw new Error('Acil durdurma etkin. Komut çalıştırılamaz; önce acil durdurmayı kaldırın.');
    }
    const settings = this.deps.settings.get();
    const analysis = this.analyze(request.command);
    const approvalNeeded =
      request.proposedBy === 'agent'
        ? needsApproval(analysis, settings.agents.autoApproveRisk === 'none' ? { autoApproveRisk: 'none', autoApproveLowRisk: false } : { autoApproveRisk: settings.agents.autoApproveRisk, autoApproveLowRisk: settings.security.autoApproveLowRisk })
        : needsApproval(analysis, { autoApproveRisk: settings.agents.autoApproveRisk, autoApproveLowRisk: true });

    const commandId = nanoid(12);

    if (approvalNeeded && !request.approvalId) {
      // Aynı komut + dizin için bekleyen onay varsa yenisi oluşturulmaz;
      // böylece onay kuyruğu aynı istekle dolmaz.
      const pending = this.deps.approvals.list('pending').find((item) => {
        if (item.kind !== 'command') return false;
        const payload = item.payload as { command?: string; cwd?: string };
        return payload.command === request.command && payload.cwd === request.cwd;
      });
      if (pending) {
        return {
          commandId,
          exitCode: null,
          stdout: '',
          stderr: '',
          durationMs: 0,
          truncated: false,
          cancelled: false,
          requiresApproval: { approvalId: pending.id, analysis },
        };
      }
      const approval = this.deps.approvals.create({
        kind: 'command',
        risk: analysis.risk,
        title: `Komut çalıştırılacak (${analysis.risk} risk)`,
        description: `${request.command}\nDizin: ${request.cwd}\nNeden: ${analysis.reasons.join(', ')}`,
        payload: { command: request.command, cwd: request.cwd, sessionId: request.sessionId },
        ttlMinutes: 15,
      });
      return {
        commandId,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        truncated: false,
        cancelled: false,
        requiresApproval: { approvalId: approval.id, analysis },
      };
    }
    if (request.approvalId) {
      // Onay, çalıştırılacak komuta ve dizine bağlıdır: onaylanan metinden
      // farklı bir komut bu onayla çalıştırılamaz (TOCTOU koruması).
      const approval = this.deps.approvals.assertApproved(request.approvalId, 'command');
      const approvedPayload = approval.payload as { command?: string; cwd?: string };
      if (
        (approvedPayload.command && approvedPayload.command !== request.command) ||
        (approvedPayload.cwd && approvedPayload.cwd !== request.cwd)
      ) {
        throw new Error('Onaylanan komut ile çalıştırılmak istenen komut uyuşmuyor. Yeni onay gerekiyor.');
      }
    }

    this.deps.audit.log({
      module: 'terminal',
      action: 'command.run',
      detail: request.command,
      risk: analysis.risk === 'low' ? 'low' : analysis.risk,
      taskId: undefined,
    });

    const timeoutMs = Math.min(request.timeoutMs ?? settings.terminal.commandTimeoutMs, 10 * 60_000);
    const { command, args } = this.buildInvocation(request.command, this.shellFor(request.sessionId));
    const startedAt = nowIso();
    const started = Date.now();

    return await new Promise<TerminalRunResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let truncated = false;
      let finished = false;

      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(command, args, {
          cwd: request.cwd,
          windowsHide: true,
          env: { ...process.env, AI_WORKSTATION: '1' },
        }) as ChildProcessWithoutNullStreams;
      } catch (err) {
        resolve({
          commandId,
          exitCode: null,
          stdout: '',
          stderr: redactText(redact((err as Error).message)),
          durationMs: 0,
          truncated: false,
          cancelled: false,
        });
        return;
      }
      this.running.set(commandId, { child, cancelled: false });

      const limit = settings.terminal.maxOutputKb * 1024;
      const append = (target: 'out' | 'err', chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (target === 'out') {
          if (stdout.length + text.length > limit) {
            stdout += text.slice(0, Math.max(0, limit - stdout.length));
            truncated = true;
          } else stdout += text;
        } else {
          if (stderr.length + text.length > limit) {
            stderr += text.slice(0, Math.max(0, limit - stderr.length));
            truncated = true;
          } else stderr += text;
        }
      };

      child.stdout.on('data', (c: Buffer) => append('out', c));
      child.stderr.on('data', (c: Buffer) => append('err', c));

      const timer = setTimeout(() => {
        if (!finished) {
          stderr += `\n[AI Workstation] Komut ${timeoutMs} ms içinde tamamlanmadı, durduruldu.`;
          this.running.get(commandId)!.cancelled = true;
          child.kill('SIGKILL');
        }
      }, timeoutMs);

      const finalize = (exitCode: number | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        const entry = this.running.get(commandId);
        this.running.delete(commandId);
        const durationMs = Date.now() - started;
        const record: TerminalCommandRecord = {
          id: commandId,
          sessionId: request.sessionId ?? 'default',
          command: request.command,
          cwd: request.cwd,
          risk: analysis.risk,
          exitCode: exitCode ?? undefined,
          stdout,
          stderr,
          startedAt,
          finishedAt: nowIso(),
          durationMs,
          truncated,
          cancelled: entry?.cancelled ?? false,
          proposedBy: request.proposedBy ?? 'user',
          approvalId: request.approvalId,
        };
        this.persist(record);
        resolve({
          commandId,
          exitCode,
          stdout: redactText(redact(stdout)),
          stderr: redactText(redact(stderr)),
          durationMs,
          truncated,
          cancelled: record.cancelled ?? false,
        });
      };

      child.on('error', (err) => {
        stderr += `\n${redactText(redact(err.message))}`;
        finalize(null);
      });
      child.on('close', (code) => finalize(code));
    });
  }

  cancel(commandId: string): boolean {
    const entry = this.running.get(commandId);
    if (!entry) return false;
    entry.cancelled = true;
    try {
      entry.child.kill('SIGKILL');
    } catch {
      /* yoksay */
    }
    return true;
  }

  cancelAll(): number {
    let count = 0;
    for (const [id] of this.running) if (this.cancel(id)) count += 1;
    return count;
  }

  history(limit = 100): TerminalCommandRecord[] {
    const rows = this.deps.db.prepare('SELECT * FROM terminal_commands ORDER BY started_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      sessionId: String(r.session_id ?? 'default'),
      command: String(r.command),
      cwd: String(r.cwd),
      risk: r.risk as TerminalCommandRecord['risk'],
      exitCode: (r.exit_code as number) ?? undefined,
      stdout: (r.stdout as string) ?? '',
      stderr: (r.stderr as string) ?? '',
      startedAt: String(r.started_at),
      finishedAt: (r.finished_at as string) ?? undefined,
      durationMs: (r.duration_ms as number) ?? undefined,
      truncated: r.truncated === 1,
      cancelled: r.cancelled === 1,
      proposedBy: (r.proposed_by as 'user' | 'agent') ?? 'user',
    }));
  }

  private persist(record: TerminalCommandRecord): void {
    this.deps.db
      .prepare(
        `INSERT INTO terminal_commands (id, session_id, command, cwd, risk, proposed_by, approval_id, exit_code, stdout, stderr, truncated, cancelled, duration_ms, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.sessionId,
        record.command,
        record.cwd,
        record.risk,
        record.proposedBy ?? 'user',
        record.approvalId ?? null,
        record.exitCode ?? null,
        redactText(redact(record.stdout ?? '')).slice(0, LIMITS.maxCommandOutputBytes),
        redactText(redact(record.stderr ?? '')).slice(0, LIMITS.maxCommandOutputBytes),
        record.truncated ? 1 : 0,
        record.cancelled ? 1 : 0,
        record.durationMs ?? null,
        record.startedAt,
        record.finishedAt ?? null,
      );
  }

  private readonly availability = new Map<string, boolean>();

  /** Bir çalıştırılabilir dosyanın sistemde bulunup bulunmadığını önbellekli denetler. */
  private hasExecutable(bin: string): boolean {
    const cached = this.availability.get(bin);
    if (cached !== undefined) return cached;
    let available = false;
    try {
      const probe = process.platform === 'win32' ? spawnSync('where', [bin], { windowsHide: true }) : spawnSync('which', [bin]);
      available = probe.status === 0;
    } catch {
      available = false;
    }
    this.availability.set(bin, available);
    return available;
  }

  private shellFor(sessionId?: string): ShellKind {
    const requested = sessionId && this.sessions.has(sessionId) ? this.sessions.get(sessionId)!.shell : this.deps.settings.get().terminal.defaultShell;
    if (process.platform === 'win32') {
      if (requested === 'powershell' && !this.hasExecutable('powershell.exe')) return 'cmd';
      if (requested === 'cmd' && !this.hasExecutable('cmd.exe')) return 'powershell';
      if (requested === 'git-bash' && !this.hasExecutable('bash.exe')) return 'cmd';
      return requested;
    }
    // POSIX: PowerShell (pwsh) kurulu değilse bash'e düş.
    if (requested === 'powershell' && !this.hasExecutable('pwsh')) return 'bash';
    if (requested === 'cmd') return 'bash';
    if (requested === 'git-bash' && !this.hasExecutable('bash')) return 'bash';
    return requested === 'wsl' ? (this.hasExecutable('wsl.exe') ? 'wsl' : 'bash') : requested;
  }

  /** Platforma ve kabuğa göre çalıştırma komutunu üretir. */
  private buildInvocation(commandLine: string, shell: ShellKind): { command: string; args: string[] } {
    const isWin = process.platform === 'win32';
    switch (shell) {
      case 'powershell':
        return isWin
          ? { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', commandLine] }
          : { command: 'pwsh', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', commandLine] };
      case 'cmd':
        return { command: 'cmd.exe', args: ['/d', '/s', '/c', commandLine] };
      case 'wsl':
        return { command: 'wsl.exe', args: ['--', 'bash', '-lc', commandLine] };
      case 'git-bash':
        return isWin ? { command: 'bash.exe', args: ['-lc', commandLine] } : { command: 'bash', args: ['-lc', commandLine] };
      case 'bash':
      default:
        return isWin ? { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-Command', commandLine] } : { command: 'bash', args: ['-lc', commandLine] };
    }
  }
}

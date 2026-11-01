/**
 * Test merkezi (şartname §15).
 *
 * Önemli ilke: "Test çalıştırılmadıysa başarılı gösterilmez."
 * Bu servis yalnızca gerçekten çalıştırılan komutların çıktısını raporlar;
 * komut yoksa `not-run` döner ve nedeni yazılır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { TestCaseResult, TestKind, TestOutcome, TestRunReport, TestSuiteResult } from '../../shared/types/runtime.js';
import type { ProjectService } from '../projects/project-service.js';
import type { TerminalService } from '../terminal/terminal-service.js';

interface SuiteDefinition {
  kind: TestKind;
  label: string;
  /** Projede bu testin tanımlı olup olmadığını anlar. */
  detect: (root: string) => boolean;
  command: (root: string) => { command: string; cwd: string } | undefined;
}

export class TestService {
  constructor(
    private readonly deps: { db: Db; projects: ProjectService; terminal: TerminalService },
  ) {}

  private definitions(): SuiteDefinition[] {
    return [
      {
        kind: 'typecheck',
        label: 'TypeScript tip denetimi',
        detect: (root) => fs.existsSync(path.join(root, 'tsconfig.json')),
        command: () => ({ command: 'npx --no-install tsc --noEmit', cwd: '' }),
      },
      {
        kind: 'unit',
        label: 'Birim testleri',
        detect: (root) =>
          this.packageJsonHas(root, /vitest|jest|mocha/) ||
          this.packageJsonHas(root, /"test"\s*:/) ||
          fs.existsSync(path.join(root, 'tests')) ||
          fs.existsSync(path.join(root, 'test')),
        command: (root) => {
          // Yalnızca gerçekten kurulu araçlar kullanılır; kurulu olmayan bir
          // çalıştırıcı varsayılmaz (ör. vitest yoksa vitest çağrılmaz).
          const installed = (pkg: string) => fs.existsSync(path.join(root, 'node_modules', pkg));
          if (installed('vitest')) return { command: 'npx --no-install vitest run --reporter=json', cwd: '' };
          if (installed('jest')) return { command: 'npx --no-install jest --json', cwd: '' };
          if (this.packageJsonHas(root, /node\s+--test/)) return { command: 'npm test', cwd: '' };
          return undefined;
        },
      },
      {
        kind: 'e2e',
        label: 'Uçtan uca testler',
        detect: (root) => fs.existsSync(path.join(root, 'playwright.config.ts')) || fs.existsSync(path.join(root, 'playwright.config.js')),
        command: () => ({ command: 'npx --no-install playwright test --reporter=json', cwd: '' }),
      },
      {
        kind: 'build',
        label: 'Üretim derlemesi',
        detect: (root) => this.packageJsonHas(root, /"build"\s*:/),
        command: () => ({ command: 'npm run build', cwd: '' }),
      },
      {
        kind: 'security',
        label: 'Bağımlılık güvenlik denetimi',
        detect: (root) => this.packageJsonHas(root, /"dependencies"/),
        command: () => ({ command: 'npm audit --json --audit-level=high', cwd: '' }),
      },
      {
        kind: 'dependency',
        label: 'Bağımlılık ağacı',
        detect: (root) => fs.existsSync(path.join(root, 'package.json')),
        command: () => ({ command: 'npm ls --depth=0 --json', cwd: '' }),
      },
    ];
  }

  private packageJsonHas(root: string, pattern: RegExp): boolean {
    const p = path.join(root, 'package.json');
    if (!fs.existsSync(p)) return false;
    try {
      return pattern.test(fs.readFileSync(p, 'utf8'));
    } catch {
      return false;
    }
  }

  /**
   * @param initiator 'user' → kullanıcı Test Merkezi'nden başlattı (düşük/orta
   *   riskli test komutları doğrudan çalışır); 'agent' → ajan başlattı (onay
   *   sınıflandırması uygulanır, gerekirse onay istenir).
   */
  async run(projectId: string | undefined, kinds?: string[], initiator: 'user' | 'agent' = 'agent'): Promise<TestRunReport> {
    const startedAt = nowIso();
    const suites: TestSuiteResult[] = [];
    let root = process.cwd();
    if (projectId) {
      root = this.deps.projects.get(projectId).rootPath;
    }

    const defs = this.definitions().filter((d) => !kinds?.length || kinds.includes(d.kind));
    for (const def of defs) {
      if (!def.detect(root)) {
        suites.push({
          kind: def.kind,
          outcome: 'not-run',
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          durationMs: 0,
          cases: [],
          notRunReason: 'Bu projede ilgili test altyapısı bulunamadı.',
          at: nowIso(),
        });
        continue;
      }
      const command = def.command(root);
      if (!command) {
        suites.push({
          kind: def.kind,
          outcome: 'not-run',
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          durationMs: 0,
          cases: [],
          notRunReason: 'Komut tanımlı değil.',
          at: nowIso(),
        });
        continue;
      }

      const result = await this.deps.terminal.run({
        command: command.command,
        cwd: command.cwd || root,
        timeoutMs: 300_000,
        proposedBy: initiator,
      });

      if (result.requiresApproval) {
        suites.push({
          kind: def.kind,
          outcome: 'not-run',
          command: command.command,
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          durationMs: 0,
          cases: [],
          notRunReason: `Test komutu için onay gerekiyor (onay kimliği: ${result.requiresApproval.approvalId}). Onayladıktan sonra tekrar çalıştırın.`,
          at: nowIso(),
        });
        continue;
      }

      suites.push(
        this.parseSuite(def.kind, command.command, result.exitCode, result.stdout, result.stderr, result.durationMs, {
          cancelled: result.cancelled,
        }),
      );
    }

    // Öncelik: cancelled > failed > error > passed > not-run > skipped.
    // Hiçbir durumda 'cancelled' veya 'error' "geçti" olarak raporlanmaz.
    const overall: TestOutcome = suites.some((s) => s.outcome === 'cancelled')
      ? 'cancelled'
      : suites.some((s) => s.outcome === 'failed')
        ? 'failed'
        : suites.some((s) => s.outcome === 'error')
          ? 'error'
          : suites.every((s) => s.outcome === 'not-run')
            ? 'not-run'
            : suites.some((s) => s.outcome === 'passed')
              ? 'passed'
              : 'skipped';

    const report: TestRunReport = {
      id: nanoid(12),
      projectId,
      suites,
      startedAt,
      finishedAt: nowIso(),
      overall,
    };
    this.deps.db
      .prepare('INSERT INTO test_runs (id, project_id, overall, report_json, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(report.id, projectId ?? null, overall, JSON.stringify(report), report.startedAt, report.finishedAt);
    return report;
  }

  listRuns(limit = 20, projectId?: string): TestRunReport[] {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 20)));
    const rows = (
      projectId
        ? this.deps.db.prepare('SELECT report_json FROM test_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?').all(projectId, safeLimit)
        : this.deps.db.prepare('SELECT report_json FROM test_runs ORDER BY started_at DESC LIMIT ?').all(safeLimit)
    ) as Array<{ report_json: string }>;
    return rows.map((r) => JSON.parse(r.report_json) as TestRunReport);
  }

  private parseSuite(
    kind: TestKind,
    command: string,
    exitCode: number | null,
    stdout: string,
    stderr: string,
    durationMs: number,
    flags: { cancelled: boolean; cancelReason?: 'user' | 'emergency-stop' | 'timeout' } = { cancelled: false },
  ): TestSuiteResult {
    const cases: TestCaseResult[] = [];
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Vitest JSON çıktısı
    if (kind === 'unit') {
      const json = extractJson(stdout);
      if (json && typeof json === 'object' && 'testResults' in json) {
        const parsed = json as { numTotalTests?: number; numPassedTests?: number; numFailedTests?: number; numPendingTests?: number; testResults?: Array<{ name?: string; assertionResults?: Array<{ title?: string; status?: string; failureMessages?: string[] }> }> };
        total = parsed.numTotalTests ?? 0;
        passed = parsed.numPassedTests ?? 0;
        failed = parsed.numFailedTests ?? 0;
        skipped = parsed.numPendingTests ?? 0;
        for (const file of parsed.testResults ?? []) {
          for (const a of file.assertionResults ?? []) {
            cases.push({
              name: `${path.basename(file.name ?? '')} › ${a.title ?? ''}`,
              outcome: a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped',
              error: a.failureMessages?.[0]?.slice(0, 1500),
              file: file.name,
            });
          }
        }
      }
    }

    // İptal ve altyapı hatası ayrı sonuçlardır; "geçti" sayılmazlar.
    if (flags.cancelled) {
      return {
        kind,
        outcome: 'cancelled',
        command,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        durationMs,
        cases: [],
        cancelReason: flags.cancelReason ?? 'user',
        at: nowIso(),
      };
    }
    // exitCode null = süreç hiç başlamadı ya da öldürüldü (altyapı hatası).
    if (exitCode === null) {
      return {
        kind,
        outcome: 'error',
        command,
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs,
        cases: [{ name: command, outcome: 'error', error: (stderr || 'Süreç başlatılamadı.').slice(-3000) }],
        notRunReason: 'Test komutu çalıştırılamadı (altyapı hatası).',
        at: nowIso(),
      };
    }
    const outcome: TestOutcome = exitCode === 0 ? 'passed' : 'failed';
    if (!total) {
      total = 1;
      if (outcome === 'passed') passed = 1;
      else failed = 1;
      cases.push({
        name: kind === 'typecheck' ? 'TypeScript derleme kontrolü' : command,
        outcome,
        error: outcome === 'failed' ? (stderr || stdout).slice(-3000) : undefined,
        suggestion: outcome === 'failed' ? suggestFix(kind, stderr || stdout) : undefined,
      });
    }

    return { kind, outcome, command, total, passed, failed, skipped, durationMs, cases, at: nowIso() };
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function suggestFix(kind: TestKind, output: string): string {
  if (kind === 'typecheck') {
    const m = output.match(/error TS\d+:\s*(.+)/);
    return m ? `Tip hatası: ${m[1]}. İlgili tür tanımını ve import'ları kontrol edin.` : 'Tip tanımlarını ve import yollarını kontrol edin.';
  }
  if (kind === 'security') return 'Bağımlılıkları güncelleyin: npm audit fix. Yüksek riskli paketleri sürüm notlarıyla birlikte inceleyin.';
  if (kind === 'build') return 'Derleme hatalarını sırayla çözün; önce eksik modül/import hataları, sonra tip hataları.';
  return 'Test çıktısındaki ilk hatayı düzeltip tekrar çalıştırın.';
}

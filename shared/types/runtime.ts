/** Terminal, Docker, tarayıcı, ses ve test tipleri. */
import type { ISODate } from './common.js';

/* ------------------------------------------------------------------ */
/* Terminal                                                            */
/* ------------------------------------------------------------------ */

export type ShellKind = 'powershell' | 'cmd' | 'wsl' | 'bash' | 'git-bash';

export interface TerminalSessionInfo {
  id: string;
  shell: ShellKind;
  cwd: string;
  startedAt: ISODate;
  running: boolean;
}

export interface TerminalCommandRecord {
  id: string;
  sessionId: string;
  command: string;
  cwd: string;
  risk: CommandRisk;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  startedAt: ISODate;
  finishedAt?: ISODate;
  durationMs?: number;
  truncated?: boolean;
  cancelled?: boolean;
  proposedBy?: 'user' | 'agent';
  approvalId?: string;
}

export type CommandRisk = 'low' | 'medium' | 'high' | 'critical';

export interface CommandAnalysis {
  command: string;
  risk: CommandRisk;
  requiresApproval: boolean;
  reasons: string[];
  /** Tespit edilen tehlikeli kalıplar. */
  matches: string[];
}

export interface TerminalRunRequest {
  sessionId?: string;
  command: string;
  cwd: string;
  timeoutMs?: number;
  approvalId?: string;
  proposedBy?: 'user' | 'agent';
}

export interface TerminalRunResult {
  commandId: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  cancelled: boolean;
  requiresApproval?: { approvalId: string; analysis: CommandAnalysis };
}

/* ------------------------------------------------------------------ */
/* Docker                                                              */
/* ------------------------------------------------------------------ */

export interface DockerStatus {
  available: boolean;
  version?: string;
  apiVersion?: string;
  os?: string;
  containers: number;
  running: number;
  images: number;
  message: string;
  checkedAt: ISODate;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
  createdAt: string;
}

export interface DockerImage {
  id: string;
  tags: string[];
  size: number;
  createdAt: string;
}

export interface DockerComposeStatus {
  composeFile?: string;
  services: Array<{ name: string; containerId?: string; state: string; ports: string[] }>;
}

export type DockerActionRisk = 'low' | 'medium' | 'high' | 'critical';

/* ------------------------------------------------------------------ */
/* Tarayıcı                                                            */
/* ------------------------------------------------------------------ */

export interface BrowserTabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  screenshot?: string; // data URI
}

export interface BrowserPageSnapshot {
  url: string;
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  forms: Array<{ action: string; fields: Array<{ name: string; type: string; label?: string }> }>;
  interactiveElements: Array<{ selector: string; tag: string; text: string; role?: string }>;
  screenshot?: string;
}

export interface BrowserActionRequest {
  tabId: string;
  action:
    | { type: 'navigate'; url: string }
    | { type: 'click'; selector: string }
    | { type: 'type'; selector: string; text: string; submit?: boolean }
    | { type: 'screenshot' }
    | { type: 'read-page' }
    | { type: 'go-back' }
    | { type: 'go-forward' }
    | { type: 'reload' };
  approvalId?: string;
}

/* ------------------------------------------------------------------ */
/* Ses                                                                 */
/* ------------------------------------------------------------------ */

export interface VoiceSettings {
  enabled: boolean;
  sttProvider: 'webspeech' | 'whisper-api' | 'off';
  ttsProvider: 'webspeech' | 'off';
  language: string;
  voiceName?: string;
  rate: number;
  pitch: number;
  inputDeviceId?: string;
  outputDeviceId?: string;
}

export interface VoiceTranscription {
  text: string;
  language: string;
  durationMs: number;
  provider: string;
}

/* ------------------------------------------------------------------ */
/* Test merkezi                                                        */
/* ------------------------------------------------------------------ */

export type TestKind =
  | 'syntax'
  | 'typecheck'
  | 'unit'
  | 'integration'
  | 'e2e'
  | 'security'
  | 'dependency'
  | 'performance'
  | 'build'
  | 'packaging';

/**
 * Test sonucu — TEK veri sözleşmesi (şartname §15.2, §33.1).
 *
 * `error`     : komut çalıştı ama altyapı hatası (ayrıştırma/izin/çökme).
 * `cancelled` : kullanıcı veya acil durdurma iptal etti.
 * `not-run`   : hiç denenmedi (altyapı yok / onay bekliyor / komut yok).
 *
 * Kural: `not-run` ve `cancelled` ASLA `passed` sayılmaz.
 */
export type TestOutcome = 'passed' | 'failed' | 'error' | 'skipped' | 'cancelled' | 'not-run';

export interface TestCaseResult {
  name: string;
  outcome: TestOutcome;
  durationMs?: number;
  error?: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface TestSuiteResult {
  kind: TestKind;
  outcome: TestOutcome;
  command?: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  cases: TestCaseResult[];
  /** Komut çalıştırılamadıysa nedeni. */
  notRunReason?: string;
  /** `cancelled` ise iptali başlatan taraf. */
  cancelReason?: 'user' | 'emergency-stop' | 'timeout';
  at: ISODate;
}

export interface TestRunReport {
  id: string;
  projectId?: string;
  suites: TestSuiteResult[];
  startedAt: ISODate;
  finishedAt: ISODate;
  overall: TestOutcome;
  /** Koşu iptal edildiyse nedeni; aksi hâlde tanımsız. */
  cancelReason?: 'user' | 'emergency-stop' | 'timeout';
}

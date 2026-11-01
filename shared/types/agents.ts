/**
 * Ajan, görev, iş akışı ve onay tipleri.
 *
 * Tasarım notu (şartname 6.12): Bir kodun doğruluğuna modelin "başarılı"
 * demesiyle karar verilmez. Bu nedenle `TaskStep.verification` alanı
 * yalnızca gerçek çıktıları (test, derleme, statik analiz) taşır.
 */
import type { AgentRunId, ISODate, ModelId, ProjectId, TaskId, TokenUsage } from './common.js';

export type AgentRole =
  | 'manager'
  | 'researcher'
  | 'architect'
  | 'coder'
  | 'tester'
  | 'security'
  | 'performance'
  | 'docs'
  | 'browser';

export const AGENT_ROLES: AgentRole[] = [
  'manager',
  'researcher',
  'architect',
  'coder',
  'tester',
  'security',
  'performance',
  'docs',
  'browser',
];

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  manager: 'Yönetici Ajan',
  researcher: 'Araştırma Ajanı',
  architect: 'Mimar Ajanı',
  coder: 'Kodlama Ajanı',
  tester: 'Test Ajanı',
  security: 'Güvenlik Ajanı',
  performance: 'Performans Ajanı',
  docs: 'Dokümantasyon Ajanı',
  browser: 'Tarayıcı Ajanı',
};

export interface AgentProfile {
  role: AgentRole;
  displayName: string;
  description: string;
  /** Bu ajana atanan birincil model. */
  modelId?: ModelId;
  /** Model başarısız olursa denenecek yedek model. */
  fallbackModelId?: ModelId;
  enabled: boolean;
  maxParallelRuns: number;
  temperature: number;
  /** Ajanın erişebileceği araç adları (boş = hiçbir araç). */
  allowedTools: string[];
  /** Ajanın dosya yazma yetkisi. */
  canWriteFiles: boolean;
  /** Ajanın terminal komutu önerebilme yetkisi. */
  canProposeCommands: boolean;
}

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  queued: 'Sırada',
  planning: 'Planlanıyor',
  running: 'Çalışıyor',
  awaiting_approval: 'Onay Bekliyor',
  paused: 'Duraklatıldı',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  cancelled: 'İptal Edildi',
};

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskKind =
  | 'analyze-project'
  | 'fix-bugs'
  | 'add-feature'
  | 'run-tests'
  | 'review-code'
  | 'research'
  | 'dockerize'
  | 'custom';

export interface TaskRecord {
  id: TaskId;
  projectId?: ProjectId;
  title: string;
  description: string;
  kind: TaskKind;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  createdAt: ISODate;
  startedAt?: ISODate;
  finishedAt?: ISODate;
  createdFromMessageId?: string;
  errorCount: number;
  testStatus?: 'passed' | 'failed' | 'skipped' | 'not-run';
  totalUsage: TokenUsage;
  /** Özet rapor (tamamlandığında doldurulur). */
  report?: TaskReport;
  /** Kullanıcı tarafından başlatılan acil durdurma. */
  emergencyStopped?: boolean;
}

export interface TaskStep {
  id: string;
  taskId: TaskId;
  index: number;
  role: AgentRole;
  title: string;
  status: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  agentRunId?: AgentRunId;
  startedAt?: ISODate;
  finishedAt?: ISODate;
  /** Ajanın ham çıktısı (kısaltılmış). */
  output?: string;
  error?: string;
  /** Yalnızca gerçek doğrulama çıktıları. */
  verification?: VerificationResult[];
  /** Bu adımı besleyen adım kimlikleri (DAG kenarları). */
  dependsOn: string[];
  /** Aynı anda yazma yapacak adımları sıraya almak için dosya kilidi anahtarları. */
  fileLocks: string[];
}

export interface VerificationResult {
  kind: 'test' | 'build' | 'typecheck' | 'lint' | 'security-scan' | 'run';
  command?: string;
  ok: boolean;
  summary: string;
  details?: string;
  durationMs?: number;
  at: ISODate;
}

export interface AgentRun {
  id: AgentRunId;
  taskId: TaskId;
  stepId?: string;
  role: AgentRole;
  modelId?: ModelId;
  providerId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  inputSummary: string;
  outputSummary?: string;
  startedAt: ISODate;
  finishedAt?: ISODate;
  durationMs?: number;
  usage: TokenUsage;
  error?: string;
  /** Ajanın ürettiği araç çağrıları (kayıt amaçlı). */
  toolCallCount: number;
}

export interface TaskReport {
  taskId: TaskId;
  title: string;
  summary: string;
  actions: string[];
  modelsUsed: string[];
  agentsUsed: AgentRole[];
  changedFiles: string[];
  createdFiles: string[];
  tests: VerificationResult[];
  errors: string[];
  securityChecks: string[];
  finalResult: 'success' | 'partial' | 'failed';
  generatedAt: ISODate;
}

export type ApprovalRisk = 'low' | 'medium' | 'high' | 'critical';

export type ApprovalKind =
  | 'file-write'
  | 'file-delete'
  | 'command'
  | 'docker'
  | 'browser-submit'
  | 'network';

export interface ApprovalRequest {
  id: string;
  kind: ApprovalKind;
  risk: ApprovalRisk;
  title: string;
  description: string;
  /** Onaylanacak somut işlem (komut, dosya yolu, diff özeti). */
  payload: Record<string, unknown>;
  taskId?: TaskId;
  stepId?: string;
  createdAt: ISODate;
  expiresAt?: ISODate;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedAt?: ISODate;
  decidedBy?: string;
}

export interface FileChangeRecord {
  id: string;
  projectId: ProjectId;
  taskId?: TaskId;
  agentRole?: AgentRole;
  path: string;
  operation: 'create' | 'update' | 'delete' | 'rename';
  oldContent?: string;
  newContent?: string;
  diff: string;
  summary: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected' | 'reverted';
  backupId?: string;
  createdAt: ISODate;
  appliedAt?: ISODate;
  revertedAt?: ISODate;
}

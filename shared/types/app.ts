/** Ayar, sohbet, bildirim, günlük ve istatistik tipleri. */
import type { ISODate, ModelId, ProjectId, TokenUsage } from './common.js';
import type { VoiceSettings } from './runtime.js';
import type { AgentRole } from './agents.js';

export interface AppSettings {
  general: {
    language: 'tr';
    theme: 'dark' | 'light' | 'system';
    startMinimized: boolean;
    notifications: boolean;
  };
  ai: {
    defaultModelId?: ModelId;
    fallbackModelId?: ModelId;
    /** Ücretsiz modelleri otomatik öncele. */
    preferFreeModels: boolean;
    requestTimeoutMs: number;
    maxOutputTokens: number;
  };
  agents: {
    maxParallelTasks: number;
    maxParallelRunsPerAgent: number;
    autoApproveRisk: 'none' | 'low' | 'medium';
  };
  files: {
    defaultProjectRoot?: string;
    backupBeforeWrite: boolean;
    maxFileSizeKb: number;
    respectGitignore: boolean;
  };
  browser: {
    downloadDirectory?: string;
    requireApprovalForSubmit: boolean;
    blockThirdPartyCookies: boolean;
  };
  terminal: {
    defaultShell: 'powershell' | 'cmd' | 'wsl' | 'bash' | 'git-bash';
    commandTimeoutMs: number;
    maxOutputKb: number;
  };
  docker: {
    socketPath?: string;
    endpoint?: string;
  };
  voice: VoiceSettings;
  security: {
    autoApproveLowRisk: boolean;
    logSensitiveData: false;
    emergencyStopShortcut: string;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  projectId?: ProjectId;
  modelId?: ModelId;
  createdAt: ISODate;
  updatedAt: ISODate;
  messageCount: number;
  totalUsage: TokenUsage;
}

export interface ChatThreadMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  modelId?: ModelId;
  providerId?: string;
  agentRole?: AgentRole;
  taskId?: string;
  usage?: TokenUsage;
  createdAt: ISODate;
  error?: string;
  /** Mesaj yaşam döngüsü (şartname §15.3, E-48). 'cancelled' asla 'complete' sayılmaz. */
  status?: 'complete' | 'cancelled' | 'failed' | 'streaming';
  /** İptali başlatan taraf. */
  cancelReason?: 'user' | 'emergency-stop' | 'timeout';
}

export interface AuditLogEntry {
  id: string;
  at: ISODate;
  module: string;
  action: string;
  risk?: 'low' | 'medium' | 'high' | 'critical';
  taskId?: string;
  projectId?: string;
  detail?: string;
  /** Gizli veri asla buraya yazılmaz; sadece maskeleme sonucu. */
  redacted?: boolean;
}

export interface AppNotification {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  at: ISODate;
  read: boolean;
  taskId?: string;
}

export interface AppStats {
  tasks: { total: number; running: number; completed: number; failed: number };
  models: { total: number; free: number; available: number };
  providers: { total: number; healthy: number };
  tokens: { today: TokenUsage; allTime: TokenUsage };
  storage: { dbBytes: number; backups: number; uptimeSec: number };
  emergencyStop: boolean;
}

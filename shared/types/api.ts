/**
 * API sözleşmesi — istek/yanıt tipleri.
 *
 * Bir modülün arayüzle konuştuğu her şey burada tanımlıdır. Tuple-tabanlı
 * (TS5.3 uyumlu) türetme, uygulama ile sözleşme arasında derleme zamanı
 * bağlantı kurar.
 */
import type { Page, TokenUsage } from './common.js';
import type { ChatRequest, ChatResponse, ModelRecord, ProviderHealth, ProviderRecord, ProviderKind } from './models.js';
import type { AgentProfile, AgentRun, ApprovalRequest, FileChangeRecord, TaskRecord, TaskStep } from './agents.js';
import type { BackupRecord, FileDiff, FileNode, FileReadResult, FileSearchResult, ProjectRecord } from './projects.js';
import type {
  BrowserActionRequest,
  BrowserPageSnapshot,
  BrowserTabInfo,
  CommandAnalysis,
  DockerContainer,
  DockerImage,
  DockerStatus,
  TerminalCommandRecord,
  TerminalRunResult,
  TerminalSessionInfo,
  TestRunReport,
} from './runtime.js';
import type { AppNotification, AppSettings, AppStats, AuditLogEntry, ChatThread, ChatThreadMessage } from './app.js';

export type { Page };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RouteSpec = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  query?: unknown;
  result: unknown;
};

export type Routes = {
  'GET /api/health': {
    body: void;
    query: void;
    result: {
      status: 'ok';
      version: string;
      /** Şartname sürümü — uygulama sürümünden bağımsız (AWS-SPEC-x.y). */
      specVersion: string;
      specId: string;
      uptimeSec: number;
      platform: string;
      dbPath: string;
      emergencyStop: boolean;
      modules: Record<string, { ready: boolean; message?: string }>;
    };
  };

  /* Sağlayıcılar */
  'GET /api/providers': { body: void; query: void; result: ProviderRecord[] };
  'POST /api/providers': {
    body: { kind: ProviderKind; name: string; apiKey?: string; baseUrl?: string; offersFreeTier?: boolean };
    query: void;
    result: ProviderRecord;
  };
  'PATCH /api/providers/:id': {
    body: { name?: string; apiKey?: string; baseUrl?: string; enabled?: boolean; offersFreeTier?: boolean };
    query: void;
    result: ProviderRecord;
  };
  'DELETE /api/providers/:id': { body: void; query: void; result: { deleted: true } };
  'POST /api/providers/:id/test': { body: void; query: void; result: ProviderHealth };
  'POST /api/providers/:id/sync-models': { body: void; query: void; result: { added: number; updated: number; total: number } };

  /* Modeller */
  'GET /api/models': {
    body: void;
    query: { free?: string; capability?: string; providerId?: string; q?: string; sort?: string };
    result: ModelRecord[];
  };
  'GET /api/models/:id': { body: void; query: void; result: ModelRecord };
  'POST /api/models/refresh': { body: void; query: void; result: { updated: number } };

  /* Sohbet */
  'POST /api/chat': { body: ChatRequest & { threadId?: string }; query: void; result: ChatResponse };
  'GET /api/threads': { body: void; query: void; result: ChatThread[] };
  'POST /api/threads': { body: { title?: string; projectId?: string; modelId?: string }; query: void; result: ChatThread };
  'GET /api/threads/:id/messages': { body: void; query: void; result: ChatThreadMessage[] };
  'DELETE /api/threads/:id': { body: void; query: void; result: { deleted: true } };

  /* Ajanlar */
  'GET /api/agents': { body: void; query: void; result: AgentProfile[] };
  'PATCH /api/agents/:role': { body: Partial<AgentProfile>; query: void; result: AgentProfile };
  'GET /api/agent-runs': { body: void; query: { taskId?: string; limit?: string }; result: AgentRun[] };

  /* Görevler */
  'GET /api/tasks': { body: void; query: { status?: string; projectId?: string }; result: TaskRecord[] };
  'POST /api/tasks': {
    body: {
      title: string;
      description: string;
      projectId?: string;
      kind?: TaskRecord['kind'];
      priority?: TaskRecord['priority'];
      autoStart?: boolean;
    };
    query: void;
    result: TaskRecord;
  };
  'GET /api/tasks/:id': { body: void; query: void; result: { task: TaskRecord; steps: TaskStep[]; runs: AgentRun[] } };
  'POST /api/tasks/:id/start': { body: void; query: void; result: TaskRecord };
  'POST /api/tasks/:id/pause': { body: void; query: void; result: TaskRecord };
  'POST /api/tasks/:id/cancel': { body: void; query: void; result: TaskRecord };
  'POST /api/tasks/:id/resume': { body: void; query: void; result: TaskRecord };
  'GET /api/tasks/:id/report': { body: void; query: void; result: NonNullable<TaskRecord['report']> };

  /* Onaylar */
  'GET /api/approvals': { body: void; query: { status?: string }; result: ApprovalRequest[] };
  'POST /api/approvals/:id/approve': { body: { remember?: boolean }; query: void; result: ApprovalRequest };
  'POST /api/approvals/:id/reject': { body: { reason?: string }; query: void; result: ApprovalRequest };

  /* Projeler ve dosyalar */
  'GET /api/projects': { body: void; query: void; result: ProjectRecord[] };
  'POST /api/projects': { body: { rootPath: string; name?: string; description?: string }; query: void; result: ProjectRecord };
  'DELETE /api/projects/:id': { body: void; query: void; result: { deleted: true } };
  'GET /api/projects/:id/tree': { body: void; query: { depth?: string }; result: FileNode };
  'GET /api/projects/:id/file': { body: void; query: { path: string }; result: FileReadResult };
  'PUT /api/projects/:id/file': {
    body: { path: string; content: string; createBackup?: boolean; approvalId?: string };
    query: void;
    result: { change: FileChangeRecord; backup?: BackupRecord };
  };
  'POST /api/projects/:id/search': { body: { query: string; maxResults?: number }; query: void; result: FileSearchResult[] };
  'GET /api/projects/:id/diff': { body: void; query: { path: string }; result: FileDiff };
  'GET /api/projects/:id/backups': { body: void; query: { path?: string }; result: BackupRecord[] };
  'POST /api/projects/:id/backups/:backupId/restore': { body: void; query: void; result: { restored: true; path: string } };
  'GET /api/changes': { body: void; query: { projectId?: string; status?: string }; result: FileChangeRecord[] };
  'POST /api/changes/:id/apply': { body: void; query: void; result: FileChangeRecord };
  'POST /api/changes/request-approval': { body: { changeIds: string[] }; query: void; result: { approvalId: string; count: number; contentHash: string } };
  'POST /api/changes/:id/revert': { body: void; query: void; result: FileChangeRecord };

  /* Terminal */
  'GET /api/terminal/sessions': { body: void; query: void; result: TerminalSessionInfo[] };
  'POST /api/terminal/sessions': { body: { shell?: string; cwd: string }; query: void; result: TerminalSessionInfo };
  'DELETE /api/terminal/sessions/:id': { body: void; query: void; result: { closed: true } };
  'POST /api/terminal/analyze': { body: { command: string }; query: void; result: CommandAnalysis };
  'POST /api/terminal/run': {
    body: { sessionId?: string; command: string; cwd: string; timeoutMs?: number; approvalId?: string };
    query: void;
    result: TerminalRunResult;
  };

  /* Docker */
  'GET /api/docker/status': { body: void; query: void; result: DockerStatus };
  'GET /api/docker/containers': { body: void; query: void; result: DockerContainer[] };
  'GET /api/docker/images': { body: void; query: void; result: DockerImage[] };
  'POST /api/docker/containers/:id/:action': { body: { approvalId?: string }; query: void; result: { ok: boolean; message: string } };
  'GET /api/docker/containers/:id/logs': { body: void; query: { tail?: string }; result: { logs: string } };
  'POST /api/docker/compose/:action': {
    body: { projectId?: string; composePath?: string; approvalId?: string };
    query: void;
    result: TerminalRunResult;
  };

  /* Tarayıcı */
  'GET /api/browser/tabs': { body: void; query: void; result: BrowserTabInfo[] };
  'POST /api/browser/tabs': { body: { url?: string }; query: void; result: BrowserTabInfo };
  'DELETE /api/browser/tabs/:id': { body: void; query: void; result: { closed: true } };
  'POST /api/browser/action': { body: BrowserActionRequest; query: void; result: { ok: boolean; snapshot?: BrowserPageSnapshot; message: string } };

  /* Test merkezi */
  'POST /api/tests/run': { body: { projectId?: string; kinds?: string[] }; query: void; result: TestRunReport };
  'GET /api/tests/runs': { body: void; query: { limit?: string }; result: TestRunReport[] };

  /* Ayarlar, bildirimler, günlük */
  'GET /api/settings': { body: void; query: void; result: AppSettings };
  'PATCH /api/settings': { body: Partial<AppSettings>; query: void; result: AppSettings };
  'GET /api/notifications': { body: void; query: void; result: AppNotification[] };
  'POST /api/notifications/read': { body: { all?: boolean; id?: string }; query: void; result: { ok: true } };
  'GET /api/audit': { body: void; query: { limit?: string }; result: Page<AuditLogEntry> };
  'GET /api/stats': { body: void; query: void; result: AppStats };
  'POST /api/emergency-stop': { body: void; query: void; result: { stopped: true; affected: number; abortedStreams: number } };
  'POST /api/emergency-resume': { body: void; query: void; result: { resumed: true } };

  /* Yedekleme */
  'POST /api/backup/export': { body: { includeSecrets?: boolean }; query: void; result: { path: string; bytes: number; checksum: string } };
  'POST /api/backup/import': { body: { path: string }; query: void; result: { restored: true; tables: number } };

  /* Ek (iç kullanım) */
  'GET /api/terminal/history': { body: void; query: { limit?: string }; result: TerminalCommandRecord[] };
  'PATCH /api/projects/:id': {
    body: { name?: string; description?: string; defaultModelId?: string };
    query: void;
    result: ProjectRecord;
  };
};

export type RouteKey = keyof Routes;

export type RouteResult<K extends RouteKey> = Routes[K]['result'];
export type RouteBody<K extends RouteKey> = Routes[K]['body'];
export type RouteQuery<K extends RouteKey> = Routes[K]['query'];

/** Arayüz tarafında kullanılan yardımcı: yalnızca yolu olan anahtarlar. */
export type RoutePath<K extends RouteKey> = K extends `${HttpMethod} ${infer P}` ? P : never;

export type { TokenUsage };

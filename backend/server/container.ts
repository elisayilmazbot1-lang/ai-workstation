/**
 * Bağımlılık kabı (composition root).
 *
 * Tüm servisler burada bir kez kurulur ve birbirine enjekte edilir.
 * Hiçbir modül kendi bağımlılığını `import` ederek oluşturmaz; bu sayede
 * testlerde tüm sistem sahte (fake) servislerle çalıştırılabilir.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type DbHandle } from '../database/db.js';
import { SecretStore } from '../security/secrets.js';
import { AuditService, NotificationService } from '../security/audit.js';
import { ApprovalService } from '../security/approvals.js';
import { SettingsService } from '../memory/settings.js';
import { ProviderService } from '../ai/provider-service.js';
import { LlmGateway } from '../ai/gateway.js';
import { ChatService } from '../ai/chat-service.js';
import { ProjectService } from '../projects/project-service.js';
import { FileService } from '../files/file-service.js';
import { TerminalService } from '../terminal/terminal-service.js';
import { DockerService } from '../docker/docker-service.js';
import { BrowserService } from '../browser/browser-service.js';
import { TestService } from '../testing/test-service.js';
import { AgentProfileService } from '../agents/profiles.js';
import { TaskService } from '../agents/task-service.js';
import { AgentOrchestrator } from '../orchestration/orchestrator.js';
import { eventBus } from '../orchestration/events.js';
import { APP_VERSION } from '../../shared/constants.js';

export interface ContainerOptions {
  /** Veri dizini. Verilmezse işletim sistemine uygun varsayılan kullanılır. */
  dataDir?: string;
  /** Testlerde bellek içi DB. */
  inMemoryDb?: boolean;
  /** Electron safeStorage köprüsü (varsa). */
  safeStorage?: {
    encrypt(plain: string): Buffer;
    decrypt(payload: Buffer): string;
    available(): boolean;
  };
}

export interface Container {
  db: DbHandle;
  dataDir: string;
  secrets: SecretStore;
  audit: AuditService;
  notifications: NotificationService;
  approvals: ApprovalService;
  settings: SettingsService;
  providers: ProviderService;
  gateway: LlmGateway;
  chat: ChatService;
  projects: ProjectService;
  files: FileService;
  terminal: TerminalService;
  docker: DockerService;
  browser: BrowserService;
  tests: TestService;
  profiles: AgentProfileService;
  tasks: TaskService;
  orchestrator: AgentOrchestrator;
  startedAt: number;
  version: string;
  close(): void;
}

export function resolveDataDir(): string {
  const fromEnv = process.env.AW_DATA_DIR;
  if (fromEnv) return fromEnv;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'AIWorkstation');
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(xdg, 'ai-workstation');
}

export function createContainer(options: ContainerOptions = {}): Container {
  const dataDir = options.dataDir ?? resolveDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = options.inMemoryDb ? ':memory:' : path.join(dataDir, 'workstation.db');
  const db = openDatabase(dbPath);

  const secrets = new SecretStore({
    secretsPath: path.join(dataDir, 'secrets.vault'),
    encryptor: options.safeStorage,
  });
  const audit = new AuditService(db.db);
  const notifications = new NotificationService(db.db);
  const settings = new SettingsService(db.db);
  const approvals = new ApprovalService(db.db, audit, notifications);
  const providers = new ProviderService({ db: db.db, secrets, audit });
  const gateway = new LlmGateway({ providers, settings, audit });
  gateway.onUsage((usage, meta) => {
    eventBus.publish({ type: 'usage', taskId: meta.taskId, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd });
  });
  const chat = new ChatService({ db: db.db, gateway, providers, audit });
  const projects = new ProjectService(db.db, audit);
  const files = new FileService({ db: db.db, projects, audit, approvals, backupDir: path.join(dataDir, 'backups') });
  // Terminal, acil durdurma durumunu orkestratörden öğrenir. Orkestratör daha
  // sonra kurulduğu için tembel bir başvuru kullanılır.
  let orchestratorRef: { isEmergencyStopped(): boolean } | undefined;
  const terminal = new TerminalService({
    db: db.db,
    approvals,
    audit,
    settings,
    isEmergencyStopped: () => orchestratorRef?.isEmergencyStopped() ?? false,
  });
  const docker = new DockerService({ db: db.db, approvals, audit, settings, terminal });
  const browser = new BrowserService({ db: db.db, approvals, audit, settings });
  const tests = new TestService({ db: db.db, projects, terminal });
  const profiles = new AgentProfileService(db.db);
  const tasks = new TaskService(db.db);
  const orchestrator = new AgentOrchestrator({
    gateway,
    providers,
    profiles,
    tasks,
    projects,
    files,
    tests,
    approvals,
    audit,
    notifications,
    settings,
    terminal,
    secrets: { listKeys: () => secrets.listKeys(), get: (k) => secrets.get(k) },
  });
  orchestratorRef = orchestrator;

  return {
    db,
    dataDir,
    secrets,
    audit,
    notifications,
    approvals,
    settings,
    providers,
    gateway,
    chat,
    projects,
    files,
    terminal,
    docker,
    browser,
    tests,
    profiles,
    tasks,
    orchestrator,
    startedAt: Date.now(),
    version: APP_VERSION,
    close: () => db.close(),
  };
}

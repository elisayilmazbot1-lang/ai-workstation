/**
 * Dosya servisi (şartname §8.2).
 *
 * - Okuma/yazma/arama/karşılaştırma
 * - Her yazmadan önce yedek
 * - Değişiklik kaydı (diff + onay + geri alma)
 * - Yol güvenliği (proje sınırı, sembolik bağlantı, hassas dosya)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { createTwoFilesPatch, diffLines } from 'diff';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type {
  BackupRecord,
  FileDiff,
  FileNode,
  FileReadResult,
  FileSearchResult,
} from '../../shared/types/projects.js';
import { BINARY_EXTENSIONS, IGNORED_DIRECTORIES } from '../../shared/types/projects.js';
import type { AgentRole, FileChangeRecord } from '../../shared/types/agents.js';
import { LIMITS } from '../../shared/constants.js';
import type { ProjectService } from '../projects/project-service.js';
import type { ApprovalService } from '../security/approvals.js';
import type { AuditService } from '../security/audit.js';
import { assertNoSensitiveWrite, isSensitivePath, shouldRedactFromContext } from '../security/paths.js';

export class FileError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FileError';
  }
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html', py: 'python', go: 'go', rs: 'rust',
  java: 'java', cs: 'csharp', php: 'php', rb: 'ruby', kt: 'kotlin', swift: 'swift', sql: 'sql', sh: 'shell',
  ps1: 'powershell', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', xml: 'xml', vue: 'vue', svelte: 'svelte',
};

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (/^dockerfile$/i.test(path.basename(filePath))) return 'dockerfile';
  return LANGUAGE_MAP[ext] ?? 'plaintext';
}

export interface FileServiceDeps {
  db: Db;
  projects: ProjectService;
  audit: AuditService;
  approvals: ApprovalService;
  backupDir: string;
}

export class FileService {
  constructor(private readonly deps: FileServiceDeps) {}

  /* ---------------------------------- Ağaç --------------------------------- */

  tree(projectId: string, depth = 3): FileNode {
    const project = this.deps.projects.get(projectId);
    const rootStat = fs.statSync(project.rootPath);
    return this.walk(project.rootPath, project.rootPath, 0, depth, rootStat);
  }

  private walk(root: string, dir: string, level: number, maxDepth: number, stat?: fs.Stats): FileNode {
    const relative = path.relative(root, dir).split(path.sep).join('/') || '.';
    const node: FileNode = {
      name: level === 0 ? path.basename(root) : path.basename(dir),
      path: relative,
      type: 'directory',
      modifiedAt: (stat ?? fs.statSync(dir)).mtime.toISOString(),
      children: [],
    };
    if (level >= maxDepth) return node;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return node;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, 'tr');
    });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        const ignored = IGNORED_DIRECTORIES.includes(entry.name);
        if (ignored) {
          node.children!.push({ name: entry.name, path: rel, type: 'directory', ignored: true, children: [] });
          continue;
        }
        if (entry.isSymbolicLink()) continue;
        try {
          node.children!.push(this.walk(root, full, level + 1, maxDepth));
        } catch {
          node.children!.push({ name: entry.name, path: rel, type: 'directory', ignored: true, children: [] });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      let s: fs.Stats | undefined;
      try {
        s = fs.statSync(full);
      } catch {
        continue;
      }
      node.children!.push({
        name: entry.name,
        path: rel,
        type: 'file',
        size: s.size,
        modifiedAt: s.mtime.toISOString(),
        extension: path.extname(entry.name).slice(1).toLowerCase(),
      });
    }
    return node;
  }

  /* --------------------------------- Okuma --------------------------------- */

  read(projectId: string, relativePath: string): FileReadResult {
    const { absolute, relative } = this.deps.projects.resolveFile(projectId, relativePath);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      throw new FileError('FILE_NOT_FOUND', `Dosya bulunamadı: ${relative}`);
    }
    const stat = fs.statSync(absolute);
    const ext = path.extname(absolute).slice(1).toLowerCase();
    const isBinary = BINARY_EXTENSIONS.includes(ext);
    if (isBinary) {
      return {
        path: relative,
        content: '',
        encoding: 'binary',
        size: stat.size,
        language: detectLanguage(relative),
        truncated: false,
        modifiedAt: stat.mtime.toISOString(),
      };
    }
    const limit = LIMITS.maxFileReadBytes;
    const truncated = stat.size > limit;
    const fd = fs.openSync(absolute, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, limit));
      fs.readSync(fd, buffer, 0, buffer.length, 0);
      return {
        path: relative,
        content: buffer.toString('utf8'),
        encoding: 'utf-8',
        size: stat.size,
        language: detectLanguage(relative),
        truncated,
        modifiedAt: stat.mtime.toISOString(),
      };
    } finally {
      fs.closeSync(fd);
    }
  }

  /* --------------------------------- Yazma --------------------------------- */

  /** Yazar, önce yedek alır ve değişiklik kaydı oluşturur. Onay önkoşuldur. */
  write(input: {
    projectId: string;
    relativePath: string;
    content: string;
    changeId?: string;
    createBackup?: boolean;
    agentRole?: AgentRole;
    taskId?: string;
  }): { change: FileChangeRecord; backup?: BackupRecord } {
    const { absolute, relative } = this.deps.projects.resolveFile(input.projectId, input.relativePath);
    assertNoSensitiveWrite(relative);

    const existed = fs.existsSync(absolute);
    const oldContent = existed && fs.statSync(absolute).isFile() ? fs.readFileSync(absolute, 'utf8') : '';
    if (oldContent === input.content && existed) {
      throw new FileError('NO_CHANGES', 'İçerik değişmedi; yazma işlemi atlandı.');
    }

    let backup: BackupRecord | undefined;
    if (existed && (input.createBackup ?? true)) {
      backup = this.createBackup(input.projectId, relative, oldContent, 'pre-write');
    }

    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, input.content, 'utf8');

    const change = this.recordChange({
      projectId: input.projectId,
      path: relative,
      operation: existed ? 'update' : 'create',
      oldContent,
      newContent: input.content,
      summary: `${existed ? 'Güncellendi' : 'Oluşturuldu'}: ${relative}`,
      status: 'applied',
      backupId: backup?.id,
      taskId: input.taskId,
      agentRole: input.agentRole,
    });

    this.deps.audit.log({
      module: 'files',
      action: existed ? 'file.update' : 'file.create',
      detail: relative,
      risk: 'medium',
      projectId: input.projectId,
      taskId: input.taskId,
    });
    return { change, backup };
  }

  delete(input: { projectId: string; relativePath: string; agentRole?: AgentRole; taskId?: string }): { change: FileChangeRecord; backup?: BackupRecord } {
    const { absolute, relative } = this.deps.projects.resolveFile(input.projectId, input.relativePath);
    if (!fs.existsSync(absolute)) throw new FileError('FILE_NOT_FOUND', `Dosya bulunamadı: ${relative}`);
    if (fs.statSync(absolute).isDirectory()) throw new FileError('IS_DIRECTORY', 'Klasör silme bu çağrıyla desteklenmiyor.');
    const oldContent = fs.readFileSync(absolute, 'utf8');
    const backup = this.createBackup(input.projectId, relative, oldContent, 'pre-delete');
    fs.unlinkSync(absolute);
    const change = this.recordChange({
      projectId: input.projectId,
      path: relative,
      operation: 'delete',
      oldContent,
      newContent: '',
      summary: `Silindi: ${relative}`,
      status: 'applied',
      backupId: backup.id,
      taskId: input.taskId,
      agentRole: input.agentRole,
    });
    this.deps.audit.log({ module: 'files', action: 'file.delete', detail: relative, risk: 'high', projectId: input.projectId, taskId: input.taskId });
    return { change, backup };
  }

  /* --------------------------------- Yedek --------------------------------- */

  createBackup(projectId: string, relativePath: string, content: string, reason: BackupRecord['reason']): BackupRecord {
    const id = nanoid(12);
    const dir = path.join(this.deps.backupDir, projectId);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = relativePath.replace(/[\\/]/g, '__');
    const storedPath = path.join(dir, `${id}__${safeName}.bak`);
    fs.writeFileSync(storedPath, content, 'utf8');
    const record: BackupRecord = {
      id,
      projectId: projectId as BackupRecord['projectId'],
      path: relativePath,
      storedPath,
      size: Buffer.byteLength(content),
      createdAt: nowIso(),
      reason,
    };
    this.deps.db
      .prepare('INSERT INTO file_backups (id, project_id, path, stored_path, size, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(record.id, record.projectId, record.path, record.storedPath, record.size, record.reason, record.createdAt);
    return record;
  }

  listBackups(projectId: string, filePath?: string): BackupRecord[] {
    const rows = (
      filePath
        ? this.deps.db.prepare('SELECT * FROM file_backups WHERE project_id = ? AND path = ? ORDER BY created_at DESC').all(projectId, filePath)
        : this.deps.db.prepare('SELECT * FROM file_backups WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
    ) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      projectId: r.project_id as BackupRecord['projectId'],
      path: String(r.path),
      storedPath: String(r.stored_path),
      size: Number(r.size),
      createdAt: String(r.created_at),
      reason: r.reason as BackupRecord['reason'],
    }));
  }

  restoreBackup(projectId: string, backupId: string): { restored: true; path: string } {
    const row = this.deps.db.prepare('SELECT * FROM file_backups WHERE id = ? AND project_id = ?').get(backupId, projectId) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new FileError('BACKUP_NOT_FOUND', 'Yedek bulunamadı.');
    const relativePath = String(row.path);
    const { absolute } = this.deps.projects.resolveFile(projectId, relativePath);
    const content = fs.readFileSync(String(row.stored_path), 'utf8');
    // Mevcut hâli de yedekle ki geri alma geri alınabilsin.
    if (fs.existsSync(absolute)) this.createBackup(projectId, relativePath, fs.readFileSync(absolute, 'utf8'), 'manual');
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
    this.deps.audit.log({ module: 'files', action: 'backup.restore', detail: `${relativePath} <- ${backupId}`, risk: 'medium', projectId });
    return { restored: true, path: relativePath };
  }

  /* ------------------------------- Değişiklik ------------------------------ */

  recordChange(input: {
    projectId: string;
    path: string;
    operation: FileChangeRecord['operation'];
    oldContent: string;
    newContent: string;
    summary: string;
    status: FileChangeRecord['status'];
    backupId?: string;
    taskId?: string;
    agentRole?: AgentRole;
  }): FileChangeRecord {
    // Ajanlar hassas dosyalara (.env, anahtar kasaları, kimlik bilgileri)
    // değişiklik öneremez. Kullanıcı da bu yolları bu arayüzden yazamaz.
    if (isSensitivePath(input.path)) {
      throw new FileError('PATH_SENSITIVE', `Hassas dosyaya değişiklik önerisi reddedildi: ${input.path}`);
    }
    if (input.operation !== 'delete') assertNoSensitiveWrite(input.path);
    const id = nanoid(12);
    const diff = createTwoFilesPatch(`a/${input.path}`, `b/${input.path}`, input.oldContent, input.newContent, 'önce', 'sonra', {
      context: 3,
    });
    const record: FileChangeRecord = {
      id,
      projectId: input.projectId as FileChangeRecord['projectId'],
      taskId: input.taskId,
      agentRole: input.agentRole,
      path: input.path,
      operation: input.operation,
      oldContent: input.oldContent,
      newContent: input.newContent,
      diff,
      summary: input.summary,
      status: input.status,
      backupId: input.backupId,
      createdAt: nowIso(),
      appliedAt: input.status === 'applied' ? nowIso() : undefined,
    };
    this.deps.db
      .prepare(
        `INSERT INTO file_changes (id, project_id, task_id, agent_role, path, operation, old_content, new_content, diff, summary, status, backup_id, created_at, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.projectId,
        record.taskId ?? null,
        record.agentRole ?? null,
        record.path,
        record.operation,
        record.oldContent ?? null,
        record.newContent ?? null,
        record.diff,
        record.summary,
        record.status,
        record.backupId ?? null,
        record.createdAt,
        record.appliedAt ?? null,
      );
    return record;
  }

  listChanges(projectId?: string, status?: string): FileChangeRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.deps.db.prepare(`SELECT * FROM file_changes ${where} ORDER BY created_at DESC LIMIT 500`).all(...params) as Array<
      Record<string, unknown>
    >;
    return rows.map((r) => ({
      id: String(r.id),
      projectId: r.project_id as FileChangeRecord['projectId'],
      taskId: (r.task_id as string) ?? undefined,
      agentRole: (r.agent_role as AgentRole) ?? undefined,
      path: String(r.path),
      operation: r.operation as FileChangeRecord['operation'],
      oldContent: (r.old_content as string) ?? undefined,
      newContent: (r.new_content as string) ?? undefined,
      diff: String(r.diff),
      summary: String(r.summary),
      status: r.status as FileChangeRecord['status'],
      backupId: (r.backup_id as string) ?? undefined,
      createdAt: String(r.created_at),
      appliedAt: (r.applied_at as string) ?? undefined,
      revertedAt: (r.reverted_at as string) ?? undefined,
    }));
  }

  getChange(id: string): FileChangeRecord {
    const change = this.listChanges().find((c) => c.id === id);
    if (!change) throw new FileError('CHANGE_NOT_FOUND', 'Değişiklik kaydı bulunamadı.');
    return change;
  }

  /**
   * Önerilmiş değişikliği uygular.
   *
   * İki kapı vardır:
   *  1. Kullanıcı onayı — `file-write` türünde, bu değişikliği hedefleyen ve
   *     İÇERİĞE bağlı (hash) bir onay kaydı olmadan yazma yapılmaz.
   *  2. İçerik değişmezliği — onaydan sonra kayıt değiştirilmişse
   *     (zamanlama/TOCTOU saldırısı) yazma reddedilir.
   */
  applyChange(id: string): FileChangeRecord {
    const change = this.getChange(id);
    if (change.status === 'applied') throw new FileError('ALREADY_APPLIED', 'Bu değişiklik zaten uygulanmış.');
    if (change.status !== 'proposed' && change.status !== 'approved') {
      throw new FileError('INVALID_STATE', 'Bu değişiklik uygulanamaz durumda.');
    }

    const expectedHash = this.changeContentHash(change);
    const approvals = this.deps.approvals.list('approved').filter((approval) => {
      const payload = approval.payload as { changeIds?: string[]; contentHash?: string; contentHashes?: Record<string, string> };
      if (approval.kind !== 'file-write') return false;
      if (Array.isArray(payload.changeIds) && !payload.changeIds.includes(change.id)) return false;
      const approvedHash = payload.contentHashes?.[change.id] ?? payload.contentHash;
      if (approvedHash && approvedHash !== expectedHash) return false;
      return true;
    });
    if (approvals.length === 0) {
      throw new FileError(
        'APPROVAL_REQUIRED',
        'Bu değişiklik için kullanıcı onayı gerekiyor (onaysız yazma yapılmaz). Onay kuyruğundan onaylayın veya "Onaya sun" ile istek oluşturun.',
      );
    }
    if (change.status === 'proposed') {
      this.deps.db.prepare("UPDATE file_changes SET status = 'approved' WHERE id = ?").run(id);
    }
    const { absolute } = this.deps.projects.resolveFile(change.projectId, change.path);
    const existed = fs.existsSync(absolute);
    const backup = existed ? this.createBackup(change.projectId, change.path, fs.readFileSync(absolute, 'utf8'), 'pre-write') : undefined;
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    if (change.operation === 'delete') {
      if (existed) fs.unlinkSync(absolute);
    } else {
      fs.writeFileSync(absolute, change.newContent ?? '', 'utf8');
    }
    this.deps.db
      .prepare("UPDATE file_changes SET status = 'applied', applied_at = ?, backup_id = ? WHERE id = ?")
      .run(nowIso(), backup?.id ?? change.backupId ?? null, id);
    this.deps.audit.log({ module: 'files', action: 'change.apply', detail: change.path, risk: 'medium', projectId: change.projectId, taskId: change.taskId });
    return this.getChange(id);
  }

  /** Değişiklik içeriğinin değişmezlik özeti (onay içeriğe bağlanır). */
  changeContentHash(change: FileChangeRecord): string {
    return crypto
      .createHash('sha256')
      .update(`${change.path}\u0000${change.operation}\u0000${change.oldContent ?? ''}\u0000${change.newContent ?? ''}`)
      .digest('hex');
  }

  /**
   * Bekleyen değişiklikler için tek bir onay isteği oluşturur.
   * Onay, değişiklik kimliklerini ve içerik özetlerini taşır; bu sayede onay
   * verilen içerik sonradan değiştirilemez.
   */
  requestChangeApproval(changeIds: string[]): { approvalId: string; count: number; contentHash: string } | undefined {
    const changes = changeIds.map((changeId) => this.getChange(changeId)).filter((c) => c.status === 'proposed');
    if (changes.length === 0) return undefined;
    const payload = {
      changeIds: changes.map((c) => c.id),
      paths: changes.map((c) => c.path),
      contentHashes: Object.fromEntries(changes.map((c) => [c.id, this.changeContentHash(c)])),
    };
    const existing = this.deps.approvals.list('pending').find((approval) => {
      if (approval.kind !== 'file-write') return false;
      const ids = (approval.payload as { changeIds?: string[] }).changeIds ?? [];
      return ids.length === changes.length && ids.every((changeId) => payload.changeIds.includes(changeId));
    });
    if (existing) return { approvalId: existing.id, count: changes.length, contentHash: '' };
    const approval = this.deps.approvals.create({
      kind: 'file-write',
      risk: changes.some((c) => c.operation === 'delete') ? 'high' : 'medium',
      title: changes.length === 1 ? '1 dosya değişikliği onay bekliyor' : `${changes.length} dosya değişikliği onay bekliyor`,
      description: changes.map((c) => `${c.operation === 'create' ? 'Yeni' : c.operation === 'delete' ? 'Silinecek' : 'Güncellenecek'} ${c.path}`).join('\n'),
      payload,
      taskId: changes[0]?.taskId,
    });
    return { approvalId: approval.id, count: changes.length, contentHash: '' };
  }

  /** Uygulanmış değişikliği geri alır. */
  revertChange(id: string): FileChangeRecord {
    const change = this.getChange(id);
    if (change.status !== 'applied') throw new FileError('INVALID_STATE', 'Yalnızca uygulanmış değişiklikler geri alınabilir.');
    const { absolute } = this.deps.projects.resolveFile(change.projectId, change.path);
    if (change.backupId) {
      const row = this.deps.db.prepare('SELECT stored_path FROM file_backups WHERE id = ?').get(change.backupId) as { stored_path: string } | undefined;
      if (row) {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.copyFileSync(row.stored_path, absolute);
      }
    } else if (change.operation === 'create') {
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    } else if (change.operation === 'delete') {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, change.oldContent ?? '', 'utf8');
    }
    this.deps.db.prepare("UPDATE file_changes SET status = 'reverted', reverted_at = ? WHERE id = ?").run(nowIso(), id);
    this.deps.audit.log({ module: 'files', action: 'change.revert', detail: change.path, risk: 'medium', projectId: change.projectId, taskId: change.taskId });
    return this.getChange(id);
  }

  /* --------------------------------- Arama --------------------------------- */

  search(projectId: string, query: string, maxResults: number = LIMITS.maxSearchResults): FileSearchResult[] {
    const project = this.deps.projects.get(projectId);
    if (!query || query.trim().length < 2) return [];
    const needle = query.toLowerCase();
    const results: FileSearchResult[] = [];
    const root = project.rootPath;

    const walk = (dir: string, depth: number): void => {
      if (depth > 8 || results.length >= maxResults) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (IGNORED_DIRECTORIES.includes(entry.name)) continue;
          walk(full, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (BINARY_EXTENSIONS.includes(ext)) continue;
        const rel = path.relative(root, full).split(path.sep).join('/');
        if (shouldRedactFromContext(rel)) continue;
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.size > 1024 * 1024) continue;
        let content: string;
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i] ?? '';
          const idx = line.toLowerCase().indexOf(needle);
          if (idx < 0) continue;
          results.push({
            path: rel,
            line: i + 1,
            column: idx + 1,
            preview: line.trim().slice(0, 240),
            matchLength: query.length,
          });
          if (results.length >= maxResults) return;
        }
      }
    };
    walk(root, 0);
    return results;
  }

  /* ---------------------------------- Diff --------------------------------- */

  diff(projectId: string, relativePath: string, proposedContent?: string): FileDiff {
    const current = this.read(projectId, relativePath);
    const next = proposedContent ?? current.content;
    const parts = diffLines(current.content, next);
    let additions = 0;
    let removals = 0;
    for (const part of parts) {
      const count = part.value.split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === '')).length;
      if (part.added) additions += count;
      if (part.removed) removals += count;
    }
    return {
      path: relativePath,
      oldContent: current.content,
      newContent: next,
      unified: createTwoFilesPatch(`a/${relativePath}`, `b/${relativePath}`, current.content, next, 'önce', 'sonra', { context: 3 }),
      additions,
      removals,
      hunks: [],
    };
  }

  /** Bağlam için hassas dosya filtresi. */
  isSensitive(relativePath: string): boolean {
    return isSensitivePath(relativePath) || shouldRedactFromContext(relativePath);
  }

  checksum(projectId: string, relativePath: string): string {
    const { absolute } = this.deps.projects.resolveFile(projectId, relativePath);
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(absolute));
    return hash.digest('hex');
  }
}

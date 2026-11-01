/**
 * Proje yönetimi (şartname §8.1).
 *
 * Proje = kullanıcının diskindeki bir klasör + uygulama içi kayıt.
 * Kök yol doğrulanır; her dosya işlemi bu kökle sınırlandırılır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { ProjectRecord } from '../../shared/types/projects.js';
import type { ProjectId } from '../../shared/types/common.js';
import { asProjectId } from '../../shared/types/common.js';
import type { AuditService } from '../security/audit.js';
import { PathSecurityError, resolveInsideRoot } from '../security/paths.js';

export class ProjectError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ProjectError';
  }
}

export class ProjectService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  list(): ProjectRecord[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY last_opened_at DESC').all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  get(id: ProjectId | string): ProjectRecord {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new ProjectError('PROJECT_NOT_FOUND', 'Proje bulunamadı.');
    return this.mapRow(row);
  }

  create(input: { rootPath: string; name?: string; description?: string }): ProjectRecord {
    const resolved = path.resolve(input.rootPath);
    if (!fs.existsSync(resolved)) {
      throw new ProjectError('PATH_NOT_FOUND', 'Belirtilen klasör bulunamadı.');
    }
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) throw new ProjectError('NOT_A_DIRECTORY', 'Belirtilen yol bir klasör değil.');

    const existing = this.db.prepare('SELECT id FROM projects WHERE root_path = ?').get(resolved) as { id: string } | undefined;
    if (existing) {
      this.touch(existing.id);
      return this.get(existing.id);
    }

    const id = asProjectId(nanoid(12));
    const createdAt = nowIso();
    this.db
      .prepare('INSERT INTO projects (id, name, root_path, description, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.name?.trim() || path.basename(resolved), resolved, input.description ?? null, createdAt, createdAt);
    this.audit.log({ module: 'projects', action: 'project.create', detail: resolved, risk: 'low', projectId: id });
    return this.get(id);
  }

  touch(id: string): void {
    this.db.prepare('UPDATE projects SET last_opened_at = ? WHERE id = ?').run(nowIso(), id);
  }

  update(id: string, patch: { name?: string; description?: string; defaultModelId?: string }): ProjectRecord {
    const current = this.get(id);
    this.db
      .prepare('UPDATE projects SET name = ?, description = ?, default_model_id = ? WHERE id = ?')
      .run(patch.name ?? current.name, patch.description ?? current.description ?? null, patch.defaultModelId ?? current.defaultModelId ?? null, id);
    return this.get(id);
  }

  /** Kaydı siler; kullanıcının diskindeki klasöre dokunmaz (şartname §20). */
  remove(id: string): void {
    const project = this.get(id);
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    this.audit.log({ module: 'projects', action: 'project.remove', detail: project.rootPath, risk: 'medium', projectId: id });
  }

  resolveFile(projectId: string, relativePath: string): { root: string; absolute: string; relative: string } {
    const project = this.get(projectId);
    try {
      const absolute = resolveInsideRoot(project.rootPath, relativePath);
      return { root: project.rootPath, absolute, relative: path.relative(project.rootPath, absolute).split(path.sep).join('/') };
    } catch (err) {
      if (err instanceof PathSecurityError) {
        this.audit.log({
          module: 'projects',
          action: 'security.path_blocked',
          detail: `${relativePath} — ${err.code}`,
          risk: 'high',
          projectId,
        });
        throw new ProjectError(err.code, err.message);
      }
      throw err;
    }
  }

  private mapRow(r: Record<string, unknown>): ProjectRecord {
    const id = String(r.id);
    const taskCount = (this.db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE project_id = ?').get(id) as { c: number }).c;
    return {
      id: asProjectId(id),
      name: String(r.name),
      rootPath: String(r.root_path),
      description: (r.description as string) ?? undefined,
      createdAt: String(r.created_at),
      lastOpenedAt: String(r.last_opened_at),
      defaultModelId: (r.default_model_id as string) ?? undefined,
      taskCount,
    };
  }
}

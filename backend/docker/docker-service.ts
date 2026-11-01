/**
 * Docker servisi (şartname §11).
 *
 * Docker'ın kendisi yeniden uygulanmaz; mevcut Docker Engine / Docker Desktop
 * ile konuşur. Docker yoksa uygulama çökmez, modül "kullanılamıyor" durumuna
 * geçer ve arayüzde nedeni gösterilir.
 */
import Docker from 'dockerode';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { DockerContainer, DockerImage, DockerStatus } from '../../shared/types/runtime.js';
import type { ApprovalService } from '../security/approvals.js';
import type { AuditService } from '../security/audit.js';
import type { SettingsService } from '../memory/settings.js';
import type { TerminalService } from '../terminal/terminal-service.js';

export type DockerAction = 'start' | 'stop' | 'restart' | 'remove';

const ACTION_RISK: Record<DockerAction, 'low' | 'medium' | 'high'> = {
  start: 'low',
  stop: 'medium',
  restart: 'medium',
  remove: 'high',
};

export class DockerService {
  private client?: Docker;
  private lastStatus?: DockerStatus;

  constructor(
    private readonly deps: {
      db: Db;
      approvals: ApprovalService;
      audit: AuditService;
      settings: SettingsService;
      terminal: TerminalService;
    },
  ) {}

  private getClient(): Docker {
    if (this.client) return this.client;
    const settings = this.deps.settings.get().docker;
    if (settings.socketPath) {
      this.client = new Docker({ socketPath: settings.socketPath });
    } else if (settings.endpoint) {
      const url = new URL(settings.endpoint);
      this.client = new Docker({ host: url.hostname, port: Number(url.port || 2375), protocol: url.protocol.replace(':', '') as 'http' | 'https' });
    } else {
      this.client = new Docker();
    }
    return this.client;
  }

  async status(): Promise<DockerStatus> {
    const checkedAt = nowIso();
    try {
      const docker = this.getClient();
      const version = await docker.version();
      const containers = await docker.listContainers({ all: true });
      const images = await docker.listImages();
      const running = containers.filter((c) => c.State === 'running').length;
      const status: DockerStatus = {
        available: true,
        version: version.Version,
        apiVersion: version.ApiVersion,
        os: `${version.Os}/${version.Arch}`,
        containers: containers.length,
        running,
        images: images.length,
        message: 'Docker bağlantısı kuruldu.',
        checkedAt,
      };
      this.lastStatus = status;
      return status;
    } catch (err) {
      const status: DockerStatus = {
        available: false,
        containers: 0,
        running: 0,
        images: 0,
        message:
          'Docker bağlantısı kurulamadı. Docker Desktop kurulu ve çalışıyor mu? (Windows için Docker Desktop gereklidir; WSL2 arka ucu önerilir.)',
        checkedAt,
      };
      this.lastStatus = status;
      this.deps.audit.log({ module: 'docker', action: 'status.unavailable', detail: (err as Error).message, risk: 'low', dedupeSeconds: 300 });
      return status;
    }
  }

  async listContainers(): Promise<DockerContainer[]> {
    const docker = this.getClient();
    const list = await docker.listContainers({ all: true });
    return list.map((c) => ({
      id: c.Id.slice(0, 12),
      name: (c.Names?.[0] ?? '').replace(/^\//, ''),
      image: c.Image,
      state: c.State ?? '',
      status: c.Status ?? '',
      ports: (c.Ports ?? []).map((p) => `${p.PublicPort ?? '-'}→${p.PrivatePort}/${p.Type}`),
      createdAt: new Date((c.Created ?? 0) * 1000).toISOString(),
    }));
  }

  async listImages(): Promise<DockerImage[]> {
    const docker = this.getClient();
    const list = await docker.listImages();
    return list.map((i) => ({
      id: i.Id.replace('sha256:', '').slice(0, 12),
      tags: i.RepoTags ?? [],
      size: i.Size,
      createdAt: new Date((i.Created ?? 0) * 1000).toISOString(),
    }));
  }

  async containerAction(containerId: string, action: DockerAction, approvalId?: string): Promise<{ ok: boolean; message: string }> {
    const risk = ACTION_RISK[action];
    if (!approvalId) {
      this.deps.approvals.create({
        kind: 'docker',
        risk,
        title: `Docker: ${action} — ${containerId}`,
        description: action === 'remove' ? 'Container silinecek. Geri alınamaz; veri kaybı olabilir.' : `Container ${action} işlemi uygulanacak.`,
        payload: { containerId, action },
        ttlMinutes: 10,
      });
      return { ok: false, message: 'Bu işlem için onay gerekiyor. Onay penceresini kontrol edin.' };
    }
    this.deps.approvals.assertApproved(approvalId, 'docker');

    const docker = this.getClient();
    const container = docker.getContainer(containerId);
    try {
      if (action === 'start') await container.start();
      else if (action === 'stop') await container.stop({ t: 10 });
      else if (action === 'restart') await container.restart({ t: 10 });
      else if (action === 'remove') await container.remove({ force: true });
      this.deps.db
        .prepare('INSERT INTO docker_actions (id, action, target, risk, approval_id, ok, message, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .run(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action, containerId, risk, approvalId, 'ok', nowIso());
      this.deps.audit.log({ module: 'docker', action: `container.${action}`, detail: containerId, risk });
      return { ok: true, message: `Container ${action} işlemi tamamlandı.` };
    } catch (err) {
      return { ok: false, message: `Docker işlemi başarısız: ${(err as Error).message}` };
    }
  }

  async logs(containerId: string, tail = 200): Promise<string> {
    const docker = this.getClient();
    const buffer = (await docker.getContainer(containerId).logs({ stdout: true, stderr: true, tail })) as unknown as Buffer;
    // Docker multiplexed akış başlıklarını temizle.
    const text = buffer.toString('utf8');
    return text.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(-200_000);
  }

  /** Compose işlemleri, kullanıcının projesinde `docker compose` ile yürütülür. */
  async compose(action: 'up' | 'down' | 'ps' | 'logs', options: { cwd: string; composePath?: string; approvalId?: string }): Promise<{ exitCode: number | null; output: string }> {
    const fileArg = options.composePath ? `-f "${options.composePath}"` : '';
    const command =
      process.platform === 'win32'
        ? `docker compose ${fileArg} ${action}${action === 'up' ? ' -d' : ''}`
        : `docker compose ${fileArg} ${action}${action === 'up' ? ' -d' : ''}`;
    const result = await this.deps.terminal.run({
      command,
      cwd: options.cwd,
      approvalId: options.approvalId,
      proposedBy: 'user',
      timeoutMs: 180_000,
    });
    if (result.requiresApproval) {
      return { exitCode: null, output: 'Compose işlemi için onay gerekiyor.' };
    }
    return { exitCode: result.exitCode, output: `${result.stdout}\n${result.stderr}`.trim() };
  }

  getLastStatus(): DockerStatus | undefined {
    return this.lastStatus;
  }
}

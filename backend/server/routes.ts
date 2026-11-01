/**
 * HTTP rotaları.
 *
 * Sözleşme tek kaynaktan gelir: `shared/types/api.ts`. Buradaki her rota
 * oradaki bir anahtara karşılık gelmek zorundadır (tests/integration/api-contract
 * testi bunu doğrular).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Container } from './container.js';
import { eventBus } from '../orchestration/events.js';
import { redactDeep } from '../security/redaction.js';
import type { ChatMessage } from '../../shared/types/models.js';
import { LIMITS, SPEC_VERSION, SPEC_ID } from '../../shared/constants.js';
import { killBrowserAttach } from './runtimeBridge.js';

const providerCreateSchema = z.object({
  kind: z.enum([
    'openai', 'anthropic', 'google', 'xai', 'deepseek', 'mistral', 'openrouter', 'groq', 'huggingface', 'ollama', 'lmstudio', 'custom-openai',
  ]),
  name: z.string().min(1).max(120),
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(500).optional(),
  offersFreeTier: z.boolean().optional(),
});

const providerPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  offersFreeTier: z.boolean().optional(),
});

const taskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(50_000),
  projectId: z.string().optional(),
  kind: z
    .enum(['analyze-project', 'fix-bugs', 'add-feature', 'run-tests', 'review-code', 'research', 'dockerize', 'custom'])
    .optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  autoStart: z.boolean().optional(),
});

const chatBodySchema = z.object({
  modelId: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.string(),
      toolCallId: z.string().optional(),
      name: z.string().optional(),
    }),
  ),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(200_000).optional(),
  threadId: z.string().optional(),
  noFallback: z.boolean().optional(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown, reply: FastifyReply): T | undefined {
  const result = schema.safeParse(value);
  if (!result.success) {
    reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Gönderilen veri geçersiz.',
      details: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return undefined;
  }
  return result.data;
}

export async function registerRoutes(app: FastifyInstance, c: Container): Promise<void> {
  const send = <T>(reply: FastifyReply, data: T) => reply.send(redactDeep(data));

  /* -------------------------------- Sağlık -------------------------------- */
  app.get('/api/health', async (_req, reply) =>
    send(reply, {
      status: 'ok' as const,
      version: c.version,
      specVersion: SPEC_VERSION,
      specId: SPEC_ID,
      uptimeSec: Math.round((Date.now() - c.startedAt) / 1000),
      platform: process.platform,
      dbPath: c.db.path,
      emergencyStop: c.orchestrator.isEmergencyStopped(),
      modules: {
        providers: { ready: true },
        gateway: { ready: true },
        projects: { ready: true },
        files: { ready: true },
        terminal: { ready: true },
        docker: { ready: (await c.docker.status()).available, message: (await c.docker.status()).message },
        browser: { ready: c.browser.available, message: c.browser.available ? undefined : 'Tarayıcı köprüsü yalnızca masaüstü uygulamasında etkin.' },
        tests: { ready: true },
        orchestrator: { ready: true },
      },
    }),
  );

  /* ------------------------------- Sağlayıcılar --------------------------- */
  app.get('/api/providers', async (_req, reply) => send(reply, c.providers.listProviders()));

  app.post('/api/providers', async (req, reply) => {
    const body = parse(providerCreateSchema, req.body, reply);
    if (!body) return;
    return send(reply, c.providers.createProvider(body));
  });

  app.patch('/api/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(providerPatchSchema, req.body, reply);
    if (!body) return;
    return send(reply, c.providers.updateProvider(id, body));
  });

  app.delete('/api/providers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    c.providers.deleteProvider(id);
    return send(reply, { deleted: true as const });
  });

  app.post('/api/providers/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, await c.providers.testConnection(id));
  });

  app.post('/api/providers/:id/sync-models', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, await c.providers.syncModels(id));
  });

  /* --------------------------------- Modeller ----------------------------- */
  app.get('/api/models', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    return send(
      reply,
      c.providers.listModels({ free: q.free, capability: q.capability, providerId: q.providerId, q: q.q, sort: q.sort }),
    );
  });

  app.get('/api/models/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const model = c.providers.getModel(id);
    if (!model) return reply.status(404).send({ error: 'MODEL_NOT_FOUND', message: 'Model bulunamadı.' });
    return send(reply, model);
  });

  app.post('/api/models/refresh', async (_req, reply) => {
    let updated = 0;
    for (const provider of c.providers.listProviders().filter((p) => p.enabled)) {
      try {
        const result = await c.providers.syncModels(provider.id);
        updated += result.added + result.updated;
      } catch {
        // Sağlayıcı çevrimdışıysa diğerleri etkilenmez.
      }
    }
    return send(reply, { updated });
  });

  /* ---------------------------------- Sohbet ------------------------------ */
  app.get('/api/threads', async (_req, reply) => send(reply, c.chat.listThreads()));
  app.post('/api/threads', async (req, reply) => {
    const body = (req.body ?? {}) as { title?: string; projectId?: string; modelId?: string };
    return send(reply, c.chat.createThread(body));
  });
  app.get('/api/threads/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, c.chat.messages(id));
  });
  app.delete('/api/threads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    c.chat.deleteThread(id);
    return send(reply, { deleted: true as const });
  });

  app.post('/api/chat', async (req, reply) => {
    const body = parse(chatBodySchema, req.body, reply);
    if (!body) return;
    const response = await c.chat.complete({
      modelId: body.modelId,
      messages: body.messages as ChatMessage[],
      temperature: body.temperature,
      maxOutputTokens: body.maxOutputTokens,
      threadId: body.threadId,
      noFallback: body.noFallback,
    });
    return send(reply, response);
  });

  app.post('/api/chat/stream', async (req, reply) => {
    const body = parse(chatBodySchema, req.body, reply);
    if (!body) return;

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const write = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(redactDeep(data))}\n\n`);
    const abort = new AbortController();
    req.raw.on('close', () => abort.abort());
    const keepAlive = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15_000);

    try {
      const response = await c.chat.stream(
        {
          modelId: body.modelId,
          messages: body.messages as ChatMessage[],
          temperature: body.temperature,
          maxOutputTokens: body.maxOutputTokens,
          threadId: body.threadId,
          noFallback: body.noFallback,
          signal: abort.signal,
        },
        (event) => write(event),
      );
      write({ type: 'final', response });
    } catch (err) {
      write({ type: 'error', error: { code: 'CHAT_FAILED', message: (err as Error).message } });
    } finally {
      clearInterval(keepAlive);
      reply.raw.end();
    }
    return reply;
  });

  /* ---------------------------------- Ajanlar ----------------------------- */
  app.get('/api/agents', async (_req, reply) => send(reply, c.profiles.list()));
  app.patch('/api/agents/:role', async (req, reply) => {
    const { role } = req.params as { role: string };
    const valid = ['manager', 'researcher', 'architect', 'coder', 'tester', 'security', 'performance', 'docs', 'browser'];
    if (!valid.includes(role)) return reply.status(400).send({ error: 'INVALID_ROLE', message: 'Geçersiz ajan rolü.' });
    return send(reply, c.profiles.update(role as never, (req.body ?? {}) as never));
  });
  app.get('/api/agent-runs', async (req, reply) => {
    const q = req.query as { taskId?: string; limit?: string };
    return send(reply, c.tasks.listRuns(q.taskId, Number(q.limit ?? 100)));
  });

  /* ---------------------------------- Görevler ---------------------------- */
  app.get('/api/tasks', async (req, reply) => {
    const q = req.query as { status?: string; projectId?: string };
    return send(reply, c.tasks.list(q));
  });

  app.post('/api/tasks', async (req, reply) => {
    const body = parse(taskCreateSchema, req.body, reply);
    if (!body) return;
    const task = c.tasks.create({
      title: body.title,
      description: body.description,
      projectId: body.projectId,
      kind: body.kind,
      priority: body.priority,
    });
    if (body.autoStart !== false) {
      try {
        await c.orchestrator.start(task.id);
      } catch (err) {
        return reply.status(409).send({ error: 'TASK_START_FAILED', message: (err as Error).message, task });
      }
    }
    return send(reply, c.tasks.get(task.id));
  });

  app.get('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const task = c.tasks.get(id);
      return send(reply, { task, steps: c.tasks.getSteps(id), runs: c.tasks.listRuns(id) });
    } catch {
      return reply.status(404).send({ error: 'TASK_NOT_FOUND', message: 'Görev bulunamadı.' });
    }
  });

  app.post('/api/tasks/:id/start', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, await c.orchestrator.start(id));
  });
  app.post('/api/tasks/:id/pause', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, c.orchestrator.pause(id));
  });
  app.post('/api/tasks/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, c.orchestrator.cancel(id));
  });
  app.post('/api/tasks/:id/resume', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, c.orchestrator.resume(id));
  });
  app.get('/api/tasks/:id/report', async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = c.tasks.get(id);
    if (!task.report) return reply.status(404).send({ error: 'REPORT_NOT_READY', message: 'Rapor henüz hazır değil.' });
    return send(reply, task.report);
  });

  /* ---------------------------------- Onaylar ----------------------------- */
  app.get('/api/approvals', async (req, reply) => {
    const q = req.query as { status?: string };
    return send(reply, c.approvals.list(q.status));
  });
  app.post('/api/approvals/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { remember?: boolean };
    const approved = c.approvals.approve(id, body.remember);
    eventBus.publish({ type: 'approval.decided', approvalId: id, status: 'approved' });
    return send(reply, approved);
  });
  app.post('/api/approvals/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { reason?: string };
    const rejected = c.approvals.reject(id, body.reason);
    eventBus.publish({ type: 'approval.decided', approvalId: id, status: 'rejected' });
    return send(reply, rejected);
  });

  /* -------------------------------- Projeler ------------------------------ */
  app.get('/api/projects', async (_req, reply) => send(reply, c.projects.list()));
  app.post('/api/projects', async (req, reply) => {
    const body = req.body as { rootPath?: string; name?: string; description?: string };
    if (!body?.rootPath) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'rootPath zorunlu.' });
    return send(reply, c.projects.create({ rootPath: body.rootPath, name: body.name, description: body.description }));
  });
  app.delete('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    c.projects.remove(id);
    return send(reply, { deleted: true as const });
  });
  app.get('/api/projects/:id/tree', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { depth?: string };
    return send(reply, c.files.tree(id, Number(q.depth ?? 3)));
  });
  app.get('/api/projects/:id/file', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { path?: string };
    if (!q.path) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'path zorunlu.' });
    return send(reply, c.files.read(id, q.path));
  });
  app.put('/api/projects/:id/file', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { path?: string; content?: string; createBackup?: boolean; approvalId?: string };
    if (!body?.path || body.content === undefined) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'path ve content zorunlu.' });
    }
    // Doğrudan dosya yazma da onay kapısından geçer (şartname §8.4).
    if (!body.approvalId) {
      const approval = c.approvals.create({
        kind: 'file-write',
        risk: 'medium',
        title: `Dosya yazılacak: ${body.path}`,
        description: `${body.content.length} karakter yazılacak. Önceki içerik yedeklenecek.`,
        payload: { projectId: id, path: body.path },
      });
      return reply.status(428).send({
        error: 'APPROVAL_REQUIRED',
        message: 'Bu dosya yazımı için onay gerekiyor.',
        approvalId: approval.id,
      });
    }
    c.approvals.assertApproved(body.approvalId, 'file-write');
    return send(reply, c.files.write({ projectId: id, relativePath: body.path, content: body.content, createBackup: body.createBackup }));
  });
  app.post('/api/projects/:id/search', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { query?: string; maxResults?: number };
    return send(reply, c.files.search(id, body?.query ?? '', Math.min(body?.maxResults ?? LIMITS.maxSearchResults, LIMITS.maxSearchResults)));
  });
  app.get('/api/projects/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { path?: string };
    if (!q.path) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'path zorunlu.' });
    return send(reply, c.files.diff(id, q.path));
  });
  app.get('/api/projects/:id/backups', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { path?: string };
    return send(reply, c.files.listBackups(id, q.path));
  });
  app.post('/api/projects/:id/backups/:backupId/restore', async (req, reply) => {
    const { id, backupId } = req.params as { id: string; backupId: string };
    return send(reply, c.files.restoreBackup(id, backupId));
  });

  app.get('/api/changes', async (req, reply) => {
    const q = req.query as { projectId?: string; status?: string };
    return send(reply, c.files.listChanges(q.projectId, q.status));
  });
  app.post('/api/changes/:id/apply', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, c.files.applyChange(id));
  });
  app.post('/api/changes/request-approval', async (req, reply) => {
    const body = req.body as { changeIds?: string[] };
    if (!Array.isArray(body?.changeIds) || body.changeIds.length === 0) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'changeIds zorunlu.' });
    }
    const result = c.files.requestChangeApproval(body.changeIds);
    if (!result) return reply.status(400).send({ error: 'NO_CHANGES', message: 'Onaya sunulacak bekleyen değişiklik yok.' });
    return reply.send(result);
  });
  app.post('/api/changes/:id/revert', async (req, reply) => {
    const { id } = req.params as { id: string };
    return send(reply, c.files.revertChange(id));
  });

  /* --------------------------------- Terminal ----------------------------- */
  app.get('/api/terminal/sessions', async (_req, reply) => send(reply, c.terminal.listSessions()));
  app.post('/api/terminal/sessions', async (req, reply) => {
    const body = req.body as { shell?: string; cwd?: string };
    return send(reply, c.terminal.createSession({ shell: body?.shell as never, cwd: body?.cwd ?? process.cwd() }));
  });
  app.delete('/api/terminal/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    c.terminal.closeSession(id);
    return send(reply, { closed: true as const });
  });
  app.post('/api/terminal/analyze', async (req, reply) => {
    const body = req.body as { command?: string };
    return send(reply, c.terminal.analyze(body?.command ?? ''));
  });
  app.post('/api/terminal/run', async (req, reply) => {
    const body = req.body as { sessionId?: string; command?: string; cwd?: string; timeoutMs?: number; approvalId?: string };
    if (!body?.command || !body.cwd) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'command ve cwd zorunlu.' });
    return send(
      reply,
      await c.terminal.run({ sessionId: body.sessionId, command: body.command, cwd: body.cwd, timeoutMs: body.timeoutMs, approvalId: body.approvalId, proposedBy: 'user' }),
    );
  });

  /* ---------------------------------- Docker ------------------------------ */
  app.get('/api/docker/status', async (_req, reply) => send(reply, await c.docker.status()));
  app.get('/api/docker/containers', async (_req, reply) => {
    try {
      return send(reply, await c.docker.listContainers());
    } catch (err) {
      return reply.status(503).send({ error: 'DOCKER_UNAVAILABLE', message: `Docker'a ulaşılamadı: ${(err as Error).message}` });
    }
  });
  app.get('/api/docker/images', async (_req, reply) => {
    try {
      return send(reply, await c.docker.listImages());
    } catch (err) {
      return reply.status(503).send({ error: 'DOCKER_UNAVAILABLE', message: `Docker'a ulaşılamadı: ${(err as Error).message}` });
    }
  });
  app.post('/api/docker/containers/:id/:action', async (req, reply) => {
    const { id, action } = req.params as { id: string; action: string };
    const allowed = ['start', 'stop', 'restart', 'remove'];
    if (!allowed.includes(action)) return reply.status(400).send({ error: 'INVALID_ACTION', message: 'Geçersiz Docker işlemi.' });
    const body = (req.body ?? {}) as { approvalId?: string };
    return send(reply, await c.docker.containerAction(id, action as never, body.approvalId));
  });
  app.get('/api/docker/containers/:id/logs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { tail?: string };
    try {
      return send(reply, { logs: await c.docker.logs(id, Number(q.tail ?? 200)) });
    } catch (err) {
      return reply.status(503).send({ error: 'DOCKER_UNAVAILABLE', message: (err as Error).message });
    }
  });
  app.post('/api/docker/compose/:action', async (req, reply) => {
    const { action } = req.params as { action: string };
    const allowed = ['up', 'down', 'ps', 'logs'];
    if (!allowed.includes(action)) return reply.status(400).send({ error: 'INVALID_ACTION', message: 'Geçersiz Compose işlemi.' });
    const body = (req.body ?? {}) as { projectId?: string; composePath?: string; approvalId?: string };
    const cwd = body.projectId ? c.projects.get(body.projectId).rootPath : process.cwd();
    const result = await c.docker.compose(action as never, { cwd, composePath: body.composePath, approvalId: body.approvalId });
    return send(reply, {
      commandId: '',
      exitCode: result.exitCode,
      stdout: result.output,
      stderr: '',
      durationMs: 0,
      truncated: false,
      cancelled: false,
    });
  });

  /* --------------------------------- Tarayıcı ----------------------------- */
  app.get('/api/browser/tabs', async (_req, reply) => send(reply, await c.browser.listTabs()));
  app.post('/api/browser/tabs', async (req, reply) => {
    const body = (req.body ?? {}) as { url?: string };
    try {
      return send(reply, await c.browser.createTab(body.url ?? 'about:blank'));
    } catch (err) {
      return reply.status(503).send({ error: 'BROWSER_UNAVAILABLE', message: (err as Error).message });
    }
  });
  app.delete('/api/browser/tabs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await c.browser.closeTab(id);
    return send(reply, { closed: true as const });
  });
  app.post('/api/browser/action', async (req, reply) => {
    const body = req.body as { tabId?: string; action?: { type?: string } };
    if (!body?.tabId || !body.action?.type) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'tabId ve action zorunlu.' });
    return send(reply, await c.browser.execute(body as never));
  });

  /* ------------------------------- Test merkezi --------------------------- */
  app.post('/api/tests/run', async (req, reply) => {
    const body = req.body as { projectId?: string; kinds?: string[] };
    return send(reply, await c.tests.run(body?.projectId, body?.kinds, 'user'));
  });
  app.get('/api/tests/runs', async (req, reply) => {
    const q = req.query as { limit?: string };
    return send(reply, c.tests.listRuns(Number(q.limit ?? 20)));
  });

  /* ---------------------------------- Ayarlar ----------------------------- */
  app.get('/api/settings', async (_req, reply) => send(reply, c.settings.get()));
  app.patch('/api/settings', async (req, reply) => send(reply, c.settings.update((req.body ?? {}) as never)));

  app.get('/api/notifications', async (_req, reply) => send(reply, c.notifications.list()));
  app.post('/api/notifications/read', async (req, reply) => {
    c.notifications.markRead((req.body ?? {}) as { all?: boolean; id?: string });
    return send(reply, { ok: true as const });
  });

  app.get('/api/audit', async (req, reply) => {
    const q = req.query as { limit?: string };
    const limit = Number(q.limit ?? 200);
    const { items, total } = c.audit.list(limit, 0);
    return send(reply, { items, total, offset: 0, limit });
  });

  app.get('/api/stats', async (_req, reply) => {
    const db = c.db.db;
    const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { c: number }).c;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsage = db
      .prepare('SELECT COALESCE(SUM(input_tokens),0) a, COALESCE(SUM(output_tokens),0) b, COALESCE(SUM(cost_usd),0) c FROM usage_events WHERE at >= ?')
      .get(today.toISOString()) as { a: number; b: number; c: number };
    const allUsage = db
      .prepare('SELECT COALESCE(SUM(input_tokens),0) a, COALESCE(SUM(output_tokens),0) b, COALESCE(SUM(cost_usd),0) c FROM usage_events')
      .get() as { a: number; b: number; c: number };
    const models = c.providers.listModels({});
    return send(reply, {
      tasks: {
        total: count('SELECT COUNT(*) AS c FROM tasks'),
        running: count("SELECT COUNT(*) AS c FROM tasks WHERE status IN ('running','planning')"),
        completed: count("SELECT COUNT(*) AS c FROM tasks WHERE status = 'completed'"),
        failed: count("SELECT COUNT(*) AS c FROM tasks WHERE status = 'failed'"),
      },
      models: {
        total: models.length,
        free: models.filter((m) => m.freeStatus === 'free' || m.freeStatus === 'free-tier').length,
        available: models.filter((m) => m.availability === 'available').length,
      },
      providers: {
        total: c.providers.listProviders().length,
        healthy: c.providers.listProviders().filter((p) => p.lastTestOk).length,
      },
      tokens: {
        today: { inputTokens: todayUsage.a, outputTokens: todayUsage.b, costUsd: todayUsage.c },
        allTime: { inputTokens: allUsage.a, outputTokens: allUsage.b, costUsd: allUsage.c },
      },
      storage: {
        dbBytes: (() => {
          try {
            return fs.statSync(c.db.path).size;
          } catch {
            return 0;
          }
        })(),
        backups: count('SELECT COUNT(*) AS c FROM file_backups'),
        uptimeSec: Math.round((Date.now() - c.startedAt) / 1000),
      },
      emergencyStop: c.orchestrator.isEmergencyStopped(),
    });
  });

  app.post('/api/emergency-stop', async (_req, reply) => {
    const result = c.orchestrator.emergencyStop();
    // Sohbet/model akışları da durur: iptal edilen yanıtlar 'cancelled' işaretlenir.
    const abortedStreams = c.gateway.abortAll('emergency-stop');
    c.audit.log({ module: 'security', action: 'emergency.stop.streams', detail: `${abortedStreams} model akışı iptal edildi`, risk: 'critical' });
    send(reply, { ...result, abortedStreams });
  });
  app.post('/api/emergency-resume', async (_req, reply) => {
    const result = c.orchestrator.resumeEmergency();
    c.gateway.resume();
    send(reply, result);
  });

  /* --------------------------------- Yedekleme ---------------------------- */
  app.post('/api/backup/export', async (req, reply) => {
    const body = (req.body ?? {}) as { includeSecrets?: boolean };
    return send(reply, await exportBackup(c, Boolean(body.includeSecrets)));
  });
  app.post('/api/backup/import', async (req, reply) => {
    const body = (req.body ?? {}) as { path?: string };
    if (!body.path) return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'path zorunlu.' });
    return send(reply, await importBackup(c, body.path));
  });

  app.get('/api/terminal/history', async (req, reply) => {
    const q = req.query as { limit?: string };
    return send(reply, c.terminal.history(Number(q.limit ?? 100)));
  });

  app.patch('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { name?: string; description?: string; defaultModelId?: string };
    return send(reply, c.projects.update(id, body));
  });

  /* ----------------------------- Canlı olay akışı -------------------------- */
  app.get('/api/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (event: unknown) => reply.raw.write(`data: ${JSON.stringify(redactDeep(event))}\n\n`);
    send({ type: 'system', message: 'Bağlantı kuruldu.' });
    const unsubscribe = eventBus.subscribe((event) => send(event));
    const keepAlive = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15_000);
    req.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  /* --------------------------------- Kapanış ------------------------------ */
  app.addHook('onClose', async () => {
    killBrowserAttach();
  });
}

async function exportBackup(c: Container, includeSecrets: boolean): Promise<{ path: string; bytes: number; checksum: string }> {
  const dir = path.join(c.dataDir, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `ai-workstation-backup-${stamp}.json`);

  const tables = [
    'projects', 'providers', 'models', 'agent_profiles', 'tasks', 'task_steps', 'agent_runs', 'conversations', 'messages',
    'file_changes', 'file_backups', 'terminal_commands', 'terminal_sessions', 'test_runs', 'audit_logs', 'settings', 'usage_events', 'notifications',
  ];
  const payload: Record<string, unknown> = {
    version: c.version,
    exportedAt: new Date().toISOString(),
    tables: {},
    secrets: includeSecrets ? undefined : 'NOT_INCLUDED',
  };
  for (const table of tables) {
    const exists = c.db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) continue;
    (payload.tables as Record<string, unknown>)[table] = c.db.db.prepare(`SELECT * FROM ${table}`).all();
  }
  const content = JSON.stringify(payload, null, 2);
  fs.writeFileSync(target, content, 'utf8');
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  c.audit.log({ module: 'backup', action: 'export', detail: `${target} (${Buffer.byteLength(content)} bayt)`, risk: 'low' });
  return { path: target, bytes: Buffer.byteLength(content), checksum };
}

async function importBackup(c: Container, filePath: string): Promise<{ restored: true; tables: number }> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(raw) as { tables: Record<string, Array<Record<string, unknown>>> };
  let restored = 0;
  const tx = c.db.db.transaction(() => {
    for (const [table, rows] of Object.entries(payload.tables ?? {})) {
      const exists = c.db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) continue;
      c.db.db.prepare(`DELETE FROM ${table}`).run();
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(',');
        c.db.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`).run(...columns.map((k) => row[k]));
      }
      restored += 1;
    }
  });
  tx();
  c.audit.log({ module: 'backup', action: 'import', detail: `${filePath} — ${restored} tablo`, risk: 'high' });
  return { restored: true, tables: restored };
}

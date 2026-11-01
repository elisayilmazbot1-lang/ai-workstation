/** Test yardımcıları: bellek içi sistem kurulumu ve sahte sağlayıcı. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createContainer, type Container } from '../backend/server/container.js';
import { buildApp } from '../backend/server/app.js';
import type { FastifyInstance } from 'fastify';

export function makeTempDir(prefix = 'aw-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeProjectFixture(): string {
  const dir = makeTempDir('aw-proj-');
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { test: 'vitest run', build: 'tsc' }, dependencies: { react: '^18.0.0' } }, null, 2),
  );
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export function topla(a: number, b: number) { return a + b; }\n');
  fs.writeFileSync(path.join(dir, 'src', 'index.test.ts'), "import { topla } from './index';\nconsole.log(topla(1,2));\n");
  fs.writeFileSync(path.join(dir, '.env'), 'OPENAI_API_KEY=sk-should-never-be-sent\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# Fixture proje\n');
  fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', 'x.js'), 'ignored');
  return dir;
}

export interface TestHarness {
  container: Container;
  app: FastifyInstance;
  dataDir: string;
  call: (method: string, url: string, payload?: unknown, headers?: Record<string, string>) => Promise<{ status: number; body: any }>;
  close: () => Promise<void>;
}

export async function makeHarness(): Promise<TestHarness> {
  const dataDir = makeTempDir();
  const container = createContainer({ dataDir, inMemoryDb: true });
  const app = await buildApp(container);
  await app.ready();
  const call: TestHarness['call'] = async (method, url, payload, headers) => {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as never, headers });
    let body: unknown = res.body;
    try {
      body = res.body ? JSON.parse(res.body) : null;
    } catch {
      body = res.body;
    }
    return { status: res.statusCode, body };
  };
  return {
    container,
    app,
    dataDir,
    call,
    close: async () => {
      await app.close();
      container.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/**
 * Sahte OpenAI uyumlu sunucu: gerçek HTTP üzerinden gateway'i test etmek için.
 * Abonelik/anahtar olmadan sağlayıcı adaptörlerini uçtan uca doğrular.
 */
export async function startFakeOpenAiServer(): Promise<{
  url: string;
  close: () => Promise<void>;
  calls: Array<{ body: any }>;
}> {
  const http = await import('node:http');
  const calls: Array<{ body: any }> = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: any = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            data: [
              { id: 'fake-chat', context_length: 32000 },
              { id: 'fake-vision', context_length: 128000 },
            ],
          }),
        );
        return;
      }
      if (req.url === '/v1/chat/completions') {
        calls.push({ body });
        const wantsJson = Boolean(body?.messages?.some((m: any) => String(m.content).includes('JSON plan')));
        if (body.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          const parts = ['Merhaba', ', ', 'dünya', '!'];
          for (const p of parts) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 4 } })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        const content = wantsJson
          ? JSON.stringify({
              plan: [
                { role: 'architect', title: 'Analiz', instruction: 'Projeyi analiz et', dependsOn: [] },
                { role: 'coder', title: 'Kod', instruction: 'Dosya üret', dependsOn: [0] },
              ],
              risks: [],
              needsApproval: true,
            })
          : '```file:src/yeni.ts\nexport const selam = "merhaba";\n```\n\nÖZET: Basit dosya eklendi.';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'chatcmpl-fake',
            model: body.model,
            choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 120, completion_tokens: 40 },
          }),
        );
        return;
      }
      if (req.url === '/v1/messages') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'anthropic-ok' }], usage: { input_tokens: 5, output_tokens: 2 } }));
        return;
      }
      res.writeHead(404).end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

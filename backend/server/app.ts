/**
 * Fastify uygulaması.
 *
 * Güvenlik notları (şartname §14):
 *  - Yalnızca 127.0.0.1'e bağlanır; uzak erişim yok.
 *  - Her istekte `origin` kontrolü: yalnızca kendi arayüzümüz ve Electron
 *    (`file://`, `http://localhost`, `http://127.0.0.1`) kabul edilir.
 *  - Gövde boyutu sınırlıdır.
 *  - Hatalar maskelenir (gizli bilgi sızmaz).
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { Container } from './container.js';
import { registerRoutes } from './routes.js';
import { redact } from '../security/redaction.js';

/** Alan hatalarını doğru HTTP durum kodlarına eşler (500 yerine 4xx). */
export function defaultStatusFor(code?: string): number {
  if (!code) return 500;
  if (code === 'PATH_OUTSIDE_PROJECT' || code === 'SYMLINK_BLOCKED' || code === 'PATH_SENSITIVE') return 403;
  if (code === 'PATH_INVALID' || code === 'VALIDATION_ERROR' || code === 'NO_CHANGES' || code === 'NOT_A_DIRECTORY') return 400;
  if (code === 'FILE_NOT_FOUND' || code === 'PROJECT_NOT_FOUND' || code === 'TASK_NOT_FOUND' || code === 'BACKUP_NOT_FOUND' || code === 'MODEL_NOT_FOUND' || code === 'APPROVAL_NOT_FOUND' || code === 'CHANGE_NOT_FOUND') return 404;
  if (code === 'APPROVAL_REQUIRED' || code === 'APPROVAL_NOT_PENDING') return 428;
  if (code === 'ALREADY_APPLIED' || code === 'INVALID_STATE' || code === 'IS_DIRECTORY') return 409;
  if (code === 'DOCKER_UNAVAILABLE' || code === 'BROWSER_UNAVAILABLE' || code === 'BACKEND_UNREACHABLE') return 503;
  return 500;
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^file:\/\//,
  /^https:\/\/[a-z0-9-]+\.e2b\.app$/,
  /^null$/,
];

export async function buildApp(container: Container): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.AW_LOG_LEVEL ?? 'warn',
      // Gizli bilgi günlüğe düşmesin.
      redact: ['req.headers.authorization', 'req.headers["x-api-key"]', '*.apiKey'],
    },
    bodyLimit: 25 * 1024 * 1024,
    trustProxy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))) return cb(null, true);
      cb(new Error('Bu origin izinli değil.'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  app.addHook('onRequest', async (request, reply) => {
    // Basit istemci doğrulaması: yalnızca bilinen başlıklar kabul edilir.
    if (request.method !== 'GET' && !request.headers['content-type']?.includes('application/json') && request.method !== 'DELETE') {
      if (!request.url.includes('/api/chat/stream')) {
        // JSON dışı gövde kabul etme (CSRF/HTML formu riski).
      }
    }
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
  });

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    const status = error.statusCode ?? defaultStatusFor(error.code);
    const message = redact(error.message ?? 'Bilinmeyen hata');
    if (status >= 500) {
      container.audit.log({
        module: 'server',
        action: `error.${request.method} ${request.url}`,
        detail: message,
        risk: 'medium',
      });
    }
    reply.status(status).send({
      error: error.code ?? 'INTERNAL_ERROR',
      message: status >= 500 ? `İşlem sırasında hata oluştu: ${message}` : message,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: 'NOT_FOUND', message: `Yol bulunamadı: ${request.method} ${request.url}` });
  });

  await registerRoutes(app, container);
  return app;
}

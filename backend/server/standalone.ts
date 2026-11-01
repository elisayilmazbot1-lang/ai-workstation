/**
 * Yerel servisi tek başına çalıştırır (masaüstü olmadan geliştirme/önizleme).
 *
 *   npm run dev:backend
 *
 * Yalnızca 127.0.0.1'e bağlanır. Varsayılan port 47110'dur.
 */
import { createContainer } from './container.js';
import { buildApp } from './app.js';
import { DEFAULT_BACKEND_PORT } from '../../shared/constants.js';

const port = Number(process.env.AW_BACKEND_PORT ?? DEFAULT_BACKEND_PORT);
const host = '127.0.0.1';

const container = createContainer();
const app = await buildApp(container);

try {
  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(`AI Workstation yerel servisi hazır → http://${host}:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Veri dizini: ${container.dataDir}`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Servis başlatılamadı:', (err as Error).message);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} alındı, kapatılıyor…`);
  try {
    await app.close();
  } finally {
    container.close();
    process.exit(0);
  }
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

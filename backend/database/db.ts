/**
 * Veritabanı bağlantısı ve migrasyon yönetimi.
 *
 * Tek bir bağlantı (WAL modu) tüm servisler tarafından paylaşılır.
 * Servis kapanırken `close()` çağrılmalıdır.
 */
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.js';

export type Db = DB;

export interface DbHandle {
  db: Db;
  path: string;
  close(): void;
  version(): number;
}

export function openDatabase(dbPath: string): DbHandle {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
    version: number;
  }>;
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    const run = db.transaction(() => {
      // PRAGMA ifadeleri transaction içinde çalışmaz; şema ifadeleri çalışır.
      // Idempotans: "duplicate column name" hatası (kolon zaten varsa) yutulur.
      for (const stmt of migration.sql.split(';')) {
        const sql = stmt.trim();
        if (!sql) continue;
        try {
          db.exec(`${sql};`);
        } catch (err) {
          if (!/duplicate column name/i.test((err as Error).message)) throw err;
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
    run();
  }

  const handle: DbHandle = {
    db,
    path: dbPath,
    close: () => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        /* yoksay */
      }
      db.close();
    },
    version: () => SCHEMA_VERSION,
  };
  return handle;
}

/** SQLite satırlarını güvenli biçimde boole çevirir. */
export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function fromBool(value: boolean | undefined, fallback = false): number {
  return (value ?? fallback) ? 1 : 0;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

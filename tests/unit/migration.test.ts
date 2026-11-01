/**
 * v1 → v2 şema yükseltmesi (E-48).
 * Eski kurulumlardaki messages tablosu status/cancel_reason kolonlarını
 * kaybetmeden yükseltilmeli; eski satırlar 'complete' kabul edilmeli.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS, SCHEMA_VERSION } from '../../backend/database/schema.js';
import { openDatabase } from '../../backend/database/db.js';
import { makeTempDir } from '../helpers.js';

describe('şema yükseltmesi', () => {
  it('v1 veritabanı v2 kolonlarıyla sorunsuz açılır', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'old.sqlite');

    // 1) v1 kurulumunu taklit et.
    const raw = new Database(file);
    raw.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);`);
    raw.exec(MIGRATIONS[0]!.sql.replace(/PRAGMA[^;]+;/g, ''));
    raw.prepare('INSERT INTO schema_migrations VALUES (1, ?, ?)').run('initial_schema', new Date().toISOString());
    raw.prepare(
      `INSERT INTO conversations (id, title, created_at, updated_at) VALUES ('t1','eski', '2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,
    ).run();
    raw.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES ('m1','t1','assistant','eski mesaj','2026-01-01T00:00:00Z')`,
    ).run();
    raw.close();

    // 2) Yeni sürüm açsın.
    const handle = openDatabase(file);
    const cols = (handle.db.prepare('PRAGMA table_info(messages)').all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('status');
    expect(cols).toContain('cancel_reason');

    const row = handle.db.prepare('SELECT content, status FROM messages WHERE id = ?').get('m1') as {
      content: string;
      status: string;
    };
    expect(row.content).toBe('eski mesaj');
    expect(row.status).toBe('complete');

    const applied = handle.db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number };
    expect(applied.v).toBe(SCHEMA_VERSION);
    handle.close();
  });

  it('şema sürümü migration sayısıyla eşleşir', () => {
    expect(SCHEMA_VERSION).toBe(2);
    expect(fs.existsSync('backend/database/schema.ts')).toBe(true);
  });
});

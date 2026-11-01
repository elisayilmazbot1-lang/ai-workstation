import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../backend/database/db.js';
import { SCHEMA_VERSION } from '../../backend/database/schema.js';

describe('Veritabanı', () => {
  it('şemayı oluşturur ve sürümü yazar', () => {
    const db = openDatabase(':memory:');
    const row = db.db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number };
    expect(row.v).toBe(SCHEMA_VERSION);
    expect(db.version()).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('şartnamede istenen tüm tabloları içerir', () => {
    const db = openDatabase(':memory:');
    const tables = (db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((t) => t.name);
    const required = [
      'projects', 'project_files', 'providers', 'models', 'agent_profiles', 'agent_runs', 'tasks', 'task_steps',
      'conversations', 'messages', 'file_changes', 'file_backups', 'browser_sessions', 'browser_actions',
      'terminal_sessions', 'terminal_commands', 'docker_actions', 'test_runs', 'audit_logs', 'settings', 'notifications', 'approvals',
    ];
    for (const table of required) expect(tables, `eksik tablo: ${table}`).toContain(table);
    db.close();
  });

  it('yabancı anahtar kısıtını uygular', () => {
    const db = openDatabase(':memory:');
    expect(() =>
      db.db.prepare("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES ('m1','yok','user','x','2024')").run(),
    ).toThrow();
    db.close();
  });

  it('yeniden açıldığında veriyi korur', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-db-'));
    const file = path.join(dir, 'x.db');
    const db1 = openDatabase(file);
    db1.db.prepare("INSERT INTO kv_store (key, value) VALUES ('a','b')").run();
    db1.close();
    const db2 = openDatabase(file);
    const row = db2.db.prepare("SELECT value FROM kv_store WHERE key='a'").get() as { value: string };
    expect(row.value).toBe('b');
    db2.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

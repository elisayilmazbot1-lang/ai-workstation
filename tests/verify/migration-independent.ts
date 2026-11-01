// BAĞIMSIZ DOĞRULAMA: v1 veritabanı kur → gerçek ürün koduyla aç → veri kaybı?
import Database from 'better-sqlite3';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { MIGRATIONS, SCHEMA_VERSION } from '../../backend/database/schema.js';
import { openDatabase } from '../../backend/database/db.js';

const dir = path.join(os.tmpdir(), 'migverify');
// Dizinin varlığına güvenilmez: temiz bir ortamda (CI/konteyner) /tmp boş olabilir.
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'v1.sqlite');
fs.rmSync(file, { force: true });

const raw = new Database(file);
raw.pragma('foreign_keys = ON');
raw.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);`);
raw.exec(MIGRATIONS[0]!.sql.replace(/PRAGMA[^;]+;/g, ''));
raw.prepare('INSERT INTO schema_migrations VALUES (1,?,?)').run('initial_schema', '2026-01-01T00:00:00Z');
raw.prepare(`INSERT INTO projects (id, name, root_path, description, created_at, last_opened_at) VALUES ('p1','Eski Proje','/tmp/x','açıklama','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`).run();
raw.prepare(`INSERT INTO conversations (id, title, project_id, model_id, created_at, updated_at) VALUES ('c1','Eski sohbet','p1','gpt-4o-mini','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`).run();
for (const [id, role, content] of [['m1','user','eski soru'],['m2','assistant','eski cevap'],['m3','assistant','']] as const) {
  raw.prepare(`INSERT INTO messages (id, conversation_id, role, content, usage_input, usage_output, usage_cost, created_at)
               VALUES (?, 'c1', ?, ?, 5, 7, 0.001, '2026-01-01T00:00:01Z')`).run(id, role, content);
}
raw.prepare(`INSERT INTO usage_events (id, at, provider_id, model_id, input_tokens, output_tokens, cost_usd, purpose) VALUES ('u1','2026-01-01T00:00:01Z','prov','gpt-4o-mini',5,7,0.001,'chat')`).run();
raw.prepare(`INSERT INTO audit_logs (id, at, module, action, detail, risk) VALUES ('a1','2026-01-01T00:00:01Z','chat','chat.send','eski olay','low')`).run();
const before = {
  count: (raw.prepare('SELECT COUNT(*) c FROM messages').get() as any).c,
  hash: crypto.createHash('sha256').update((raw.prepare("SELECT group_concat(id||'|'||role||'|'||content,'#') g FROM (SELECT * FROM messages ORDER BY id)").get() as any).g).digest('hex'),
  cols: (raw.prepare('PRAGMA table_info(messages)').all() as any[]).map(c => c.name),
};
raw.close();
console.log('V1 ÖNCESİ  → mesaj:', before.count, '| içerik sha256:', before.hash.slice(0, 16));
console.log('V1 kolonlar:', before.cols.join(','));

// Ürünün GERÇEK açılış yolu
const h = openDatabase(file);
const after = {
  count: (h.db.prepare('SELECT COUNT(*) c FROM messages').get() as any).c,
  hash: crypto.createHash('sha256').update((h.db.prepare("SELECT group_concat(id||'|'||role||'|'||content,'#') g FROM (SELECT * FROM messages ORDER BY id)").get() as any).g).digest('hex'),
  cols: (h.db.prepare('PRAGMA table_info(messages)').all() as any[]).map(c => c.name),
  statuses: h.db.prepare('SELECT id, status, cancel_reason FROM messages ORDER BY id').all(),
  version: (h.db.prepare('SELECT MAX(version) v FROM schema_migrations').get() as any).v,
  usage: (h.db.prepare('SELECT COUNT(*) c FROM usage_events').get() as any).c,
  audit: (h.db.prepare('SELECT COUNT(*) c FROM audit_logs').get() as any).c,
  project: (h.db.prepare('SELECT name FROM projects WHERE id=?').get('p1') as any).name,
  integrity: (h.db.pragma('integrity_check') as any[])[0].integrity_check,
  fk: (h.db.pragma('foreign_key_check') as any[]).length,
};
h.close();

console.log('V2 SONRASI → mesaj:', after.count, '| içerik sha256:', after.hash.slice(0, 16));
console.log('V2 kolonlar:', after.cols.join(','));
console.log('Eski satırların status değeri:', JSON.stringify(after.statuses));
console.log('şema sürümü:', after.version, '| usage_events:', after.usage, '| audit_logs:', after.audit, '| proje adı:', after.project);

// İKİNCİ AÇILIŞ: migration tekrar uygulanmamalı (idempotans)
const h2 = openDatabase(file);
const again = (h2.db.prepare('SELECT COUNT(*) c FROM schema_migrations WHERE version=2').get() as any).c;
const stillOk = (h2.db.prepare('SELECT COUNT(*) c FROM messages').get() as any).c;
h2.close();
console.log('ikinci açılışta v2 migration kaydı:', again, '(1 olmalı) | mesaj:', stillOk);
console.log('integrity_check:', after.integrity, '| foreign_key ihlali:', after.fk);

const ok = before.count === after.count && before.hash === after.hash && after.version === SCHEMA_VERSION
  && after.cols.includes('status') && after.cols.includes('cancel_reason')
  && after.statuses.every((r: any) => r.status === 'complete' && r.cancel_reason === null)
  && after.integrity === 'ok' && after.fk === 0
  && after.usage === 1 && after.audit === 1 && again === 1 && stillOk === 3;
console.log(ok ? '\n✔ KAYIPSIZ YÜKSELTME DOĞRULANDI' : '\n✖ VERİ KAYBI VEYA ŞEMA HATASI');
process.exit(ok ? 0 : 1);

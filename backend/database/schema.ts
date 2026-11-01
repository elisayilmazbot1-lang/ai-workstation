/**
 * Veritabanı şeması (SQLite).
 *
 * Şartname §13'teki tüm tablolar + onay, kullanım ölçümü ve migrasyon
 * tabloları. Şema sürümlenir; her değişiklik MIGRATIONS dizisinde yeni
 * bir adım olarak eklenir, mevcut adım asla değiştirilmez.
 */

export const SCHEMA_V1 = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  description TEXT,
  default_model_id TEXT,
  created_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  language TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  modified_at TEXT,
  content_hash TEXT,
  UNIQUE (project_id, path)
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  offers_free_tier INTEGER NOT NULL DEFAULT 0,
  auth_kind TEXT NOT NULL DEFAULT 'api-key',
  credential_ref TEXT,
  last_test_at TEXT,
  last_test_ok INTEGER,
  last_test_message TEXT,
  last_test_latency_ms INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  context_length INTEGER,
  max_output_tokens INTEGER,
  capabilities TEXT NOT NULL DEFAULT '[]',
  supports_vision INTEGER NOT NULL DEFAULT 0,
  supports_tools INTEGER NOT NULL DEFAULT 0,
  supports_files INTEGER NOT NULL DEFAULT 0,
  streaming INTEGER NOT NULL DEFAULT 1,
  pricing_input REAL NOT NULL DEFAULT 0,
  pricing_output REAL NOT NULL DEFAULT 0,
  pricing_note TEXT,
  free_status TEXT NOT NULL DEFAULT 'unknown',
  free_status_source TEXT,
  link_type TEXT NOT NULL DEFAULT 'key-required',
  availability TEXT NOT NULL DEFAULT 'unknown',
  deprecated INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'bundled',
  last_checked_at TEXT,
  UNIQUE (provider_id, model_key)
);

CREATE TABLE IF NOT EXISTS model_measurements (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  score REAL NOT NULL,
  samples INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (model_id, capability)
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  role TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  model_id TEXT,
  fallback_model_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  max_parallel_runs INTEGER NOT NULL DEFAULT 1,
  temperature REAL NOT NULL DEFAULT 0.2,
  allowed_tools TEXT NOT NULL DEFAULT '[]',
  can_write_files INTEGER NOT NULL DEFAULT 0,
  can_propose_commands INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  test_status TEXT,
  report_json TEXT,
  emergency_stopped INTEGER NOT NULL DEFAULT 0,
  usage_input INTEGER NOT NULL DEFAULT 0,
  usage_output INTEGER NOT NULL DEFAULT 0,
  usage_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  source_message_id TEXT
);

CREATE TABLE IF NOT EXISTS task_steps (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  agent_run_id TEXT,
  depends_on TEXT NOT NULL DEFAULT '[]',
  file_locks TEXT NOT NULL DEFAULT '[]',
  output TEXT,
  error TEXT,
  verification_json TEXT,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_id TEXT,
  role TEXT NOT NULL,
  model_id TEXT,
  provider_id TEXT,
  status TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  output_summary TEXT,
  duration_ms INTEGER,
  usage_input INTEGER NOT NULL DEFAULT 0,
  usage_output INTEGER NOT NULL DEFAULT 0,
  usage_cost REAL NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  model_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_id TEXT,
  provider_id TEXT,
  agent_role TEXT,
  task_id TEXT,
  usage_input INTEGER NOT NULL DEFAULT 0,
  usage_output INTEGER NOT NULL DEFAULT 0,
  usage_cost REAL NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_changes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT,
  agent_role TEXT,
  path TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT,
  diff TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  backup_id TEXT,
  created_at TEXT NOT NULL,
  applied_at TEXT,
  reverted_at TEXT
);

CREATE TABLE IF NOT EXISTS file_backups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  base_url TEXT
);

CREATE TABLE IF NOT EXISTS browser_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  action TEXT NOT NULL,
  payload TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  approval_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,
  shell TEXT NOT NULL,
  cwd TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS terminal_commands (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  command TEXT NOT NULL,
  cwd TEXT NOT NULL,
  risk TEXT NOT NULL,
  proposed_by TEXT NOT NULL DEFAULT 'user',
  approval_id TEXT,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  truncated INTEGER NOT NULL DEFAULT 0,
  cancelled INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS docker_actions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target TEXT,
  risk TEXT NOT NULL DEFAULT 'low',
  approval_id TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  overall TEXT NOT NULL,
  report_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  risk TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  task_id TEXT,
  step_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  decided_at TEXT,
  decided_by TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  risk TEXT,
  task_id TEXT,
  project_id TEXT,
  detail TEXT,
  redacted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  task_id TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  task_id TEXT,
  agent_role TEXT,
  provider_id TEXT,
  model_id TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  purpose TEXT
);

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_steps_task ON task_steps(task_id, idx);
CREATE INDEX IF NOT EXISTS idx_runs_task ON agent_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_changes_project ON file_changes(project_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at);
CREATE INDEX IF NOT EXISTS idx_usage_at ON usage_events(at);
CREATE INDEX IF NOT EXISTS idx_commands_session ON terminal_commands(session_id, started_at);
`;

export const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = [
  { version: 1, name: 'initial_schema', sql: SCHEMA_V1 },
  /**
   * v2 — Mesaj iptal işaretlemesi (şartname §15.3, §32 U10 / E-48).
   * `status`: 'complete' | 'cancelled' | 'failed' | 'streaming'.
   * İptal edilen yanıt, sohbet geçmişinde "İptal edildi" olarak görünür ve
   * hiçbir zaman "tamamlandı" sayılmaz.
   */
  {
    version: 2,
    name: 'message_status_cancel_reason',
    sql: `
      ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'complete';
      ALTER TABLE messages ADD COLUMN cancel_reason TEXT;
    `,
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

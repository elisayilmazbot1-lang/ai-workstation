/** Geçmiş: sohbet, görev, ajan çalışması ve denetim günlüğü bir arada. */
import React, { useEffect, useState } from 'react';
import { History, ScrollText } from 'lucide-react';
import { api } from '../services/api';
import { Badge, Panel, formatDateTime } from '../components/ui';
import type { AuditLogEntry, ChatThread } from '@shared/types/app';
import type { AgentRun, TaskRecord } from '@shared/types/agents';
import { AGENT_ROLE_LABELS, TASK_STATUS_LABELS } from '@shared/types/agents';

export function HistoryPage() {
  const [tab, setTab] = useState<'threads' | 'tasks' | 'runs' | 'audit'>('audit');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    void api('GET /api/threads').then(setThreads);
    void api('GET /api/tasks').then(setTasks);
    void api('GET /api/agent-runs', { query: { limit: '100' } }).then(setRuns);
    void api('GET /api/audit', { query: { limit: '200' } }).then((r) => setAudit(r.items));
  }, []);

  return (
    <Panel
      title={<span className="flex items-center gap-1.5"><History size={13} /> Geçmiş</span>}
      actions={
        <div className="flex overflow-hidden rounded-md border border-white/10">
          {([['audit', 'Denetim günlüğü'], ['tasks', 'Görevler'], ['runs', 'Ajan çalışmaları'], ['threads', 'Sohbetler']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-2 py-1 text-[10px] ${tab === id ? 'bg-accent/20 text-accent-soft' : 'text-slate-400'}`}>{label}</button>
          ))}
        </div>
      }
      className="h-full"
    >
      {tab === 'audit' && (
        <div className="space-y-1">
          {audit.length === 0 && <p className="text-[11px] text-slate-500">Kayıt yok.</p>}
          {audit.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-white/5 px-2 py-1 text-[10.5px]">
              <span className="mono text-slate-500">{formatDateTime(a.at)}</span>
              <Badge tone="info">{a.module}</Badge>
              <span className="text-slate-300">{a.action}</span>
              {a.risk && <Badge tone={a.risk === 'critical' || a.risk === 'high' ? 'danger' : a.risk === 'medium' ? 'warn' : 'neutral'}>{a.risk}</Badge>}
              {a.detail && <span className="mono min-w-0 flex-1 truncate text-slate-500">{a.detail}</span>}
            </div>
          ))}
        </div>
      )}
      {tab === 'tasks' && (
        <div className="space-y-1">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded border border-white/5 px-2 py-1 text-[10.5px]">
              <Badge tone={t.status === 'completed' ? 'ok' : t.status === 'failed' ? 'danger' : 'info'}>{TASK_STATUS_LABELS[t.status]}</Badge>
              <span className="min-w-0 flex-1 truncate text-slate-300">{t.title}</span>
              <span className="mono text-slate-500">{formatDateTime(t.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      {tab === 'runs' && (
        <div className="space-y-1">
          {runs.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded border border-white/5 px-2 py-1 text-[10.5px]">
              <Badge tone={r.status === 'completed' ? 'ok' : r.status === 'failed' ? 'danger' : 'info'}>{r.status}</Badge>
              <span className="text-slate-300">{AGENT_ROLE_LABELS[r.role]}</span>
              <span className="mono truncate text-slate-500">{r.modelId ?? '—'}</span>
              <span className="ml-auto mono text-slate-500">{r.usage.inputTokens + r.usage.outputTokens} token</span>
            </div>
          ))}
        </div>
      )}
      {tab === 'threads' && (
        <div className="space-y-1">
          {threads.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded border border-white/5 px-2 py-1 text-[10.5px]">
              <ScrollText size={11} className="text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-slate-300">{t.title}</span>
              <span className="text-slate-500">{t.messageCount} mesaj</span>
              <span className="mono text-slate-500">{formatDateTime(t.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

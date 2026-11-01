/** Görevler: canlı ilerleme, adım adım ajan çalışması, rapor ve doğrulama. */
import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, CircleDashed, Clock, FileCode2, Loader2, Play, RotateCcw, Square, XCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api, subscribeEvents } from '../services/api';
import { Badge, Button, EmptyState, Panel, ProgressBar, formatDateTime, formatTime } from '../components/ui';
import { AGENT_ROLE_LABELS, TASK_STATUS_LABELS, type AgentRun, type TaskRecord, type TaskStep } from '@shared/types/agents';
import clsx from 'clsx';

const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'info'> = {
  queued: 'neutral', planning: 'info', running: 'info', awaiting_approval: 'warn', paused: 'warn',
  completed: 'ok', failed: 'danger', cancelled: 'neutral',
};

export function TasksPage() {
  const { tasks, refreshTasks, activeProjectId, setPage, toast } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [detail, setDetail] = useState<{ task: TaskRecord; steps: TaskStep[]; runs: AgentRun[] } | null>(null);

  useEffect(() => {
    void refreshTasks();
    return subscribeEvents((raw) => {
      const e = raw as { type: string; taskId?: string };
      if (e.type.startsWith('task.') || e.type === 'agent.run') {
        void refreshTasks();
        if (e.taskId && e.taskId === selectedId) void load(e.taskId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const load = async (id: string) => {
    try {
      const data = await api('GET /api/tasks/:id', { params: { id } });
      setDetail(data);
    } catch {
      setDetail(null);
    }
  };

  useEffect(() => {
    if (!selectedId && tasks[0]) {
      setSelectedId(tasks[0].id);
      void load(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const startTask = async () => {
    const description = window.prompt('Görev tanımı (proje üzerinde çalışır):', 'Bu projeyi incele ve eksikleri düzelt.');
    if (!description) return;
    try {
      const task = await api('POST /api/tasks', {
        body: { title: description.slice(0, 80), description, projectId: activeProjectId, autoStart: true },
      });
      setSelectedId(task.id);
      await refreshTasks();
      toast('info', 'Görev başlatıldı', task.title);
    } catch (err) {
      toast('error', 'Görev başlatılamadı', (err as Error).message);
    }
  };

  const action = async (id: string, kind: 'start' | 'pause' | 'cancel' | 'resume') => {
    await api(`POST /api/tasks/:id/${kind}` as never, { params: { id } });
    await refreshTasks();
    await load(id);
  };

  const grouped = useMemo(() => {
    const running = tasks.filter((t) => ['running', 'planning', 'awaiting_approval'].includes(t.status));
    const rest = tasks.filter((t) => !['running', 'planning', 'awaiting_approval'].includes(t.status));
    return { running, rest };
  }, [tasks]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[340px_1fr]">
      <Panel
        title={<span className="flex items-center gap-1.5"><Boxes size={13} /> Görevler ({tasks.length})</span>}
        actions={<Button variant="primary" onClick={() => void startTask()}><Play size={12} /> Yeni görev</Button>}
        className="min-h-0"
      >
        {tasks.length === 0 ? (
          <EmptyState icon={<Boxes size={20} />} title="Henüz görev yok" description="Sohbette /görev yazarak veya buradan yeni görev başlatabilirsiniz." />
        ) : (
          <div className="space-y-3">
            {grouped.running.length > 0 && <SectionTitle>Çalışan</SectionTitle>}
            {grouped.running.map((t) => <TaskRow key={t.id} task={t} active={t.id === selectedId} onClick={() => { setSelectedId(t.id); void load(t.id); }} />)}
            {grouped.rest.length > 0 && <SectionTitle>Geçmiş</SectionTitle>}
            {grouped.rest.map((t) => <TaskRow key={t.id} task={t} active={t.id === selectedId} onClick={() => { setSelectedId(t.id); void load(t.id); }} />)}
          </div>
        )}
      </Panel>

      <Panel
        title={detail ? detail.task.title : 'Görev detayı'}
        actions={
          detail && (
            <div className="flex gap-1">
              {['running', 'planning'].includes(detail.task.status) ? (
                <>
                  <Button onClick={() => void action(detail.task.id, 'pause')}><Clock size={11} /> Duraklat</Button>
                  <Button variant="danger" onClick={() => void action(detail.task.id, 'cancel')}><Square size={11} /> İptal</Button>
                </>
              ) : detail.task.status === 'paused' ? (
                <Button variant="primary" onClick={() => void action(detail.task.id, 'resume')}><Play size={11} /> Devam</Button>
              ) : (
                <Button onClick={() => void action(detail.task.id, 'start')}><RotateCcw size={11} /> Yeniden çalıştır</Button>
              )}
            </div>
          )
        }
        className="min-h-0"
      >
        {!detail ? (
          <EmptyState title="Görev seçilmedi" description="Soldan bir görev seçin." />
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[detail.task.status] ?? 'neutral'}>{TASK_STATUS_LABELS[detail.task.status]}</Badge>
                <Badge tone="info">{detail.task.kind}</Badge>
                <span className="mono ml-auto text-[10px] text-slate-500">{detail.task.progress}%</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-300">{detail.task.description}</p>
              <div className="mt-2"><ProgressBar value={detail.task.progress} tone={detail.task.status === 'failed' ? 'danger' : detail.task.status === 'completed' ? 'ok' : 'info'} /></div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-500">
                <span>Başlangıç: {formatDateTime(detail.task.startedAt)}</span>
                <span>Bitiş: {formatDateTime(detail.task.finishedAt)}</span>
                <span>Token: {detail.task.totalUsage.inputTokens + detail.task.totalUsage.outputTokens}</span>
                <span>Maliyet: ${detail.task.totalUsage.costUsd.toFixed(4)}</span>
                <span>Test: {detail.task.testStatus ?? 'çalıştırılmadı'}</span>
              </div>
            </div>

            <div>
              <SectionTitle>Adımlar ({detail.steps.length})</SectionTitle>
              <div className="space-y-1.5">
                {detail.steps.map((s) => (
                  <div key={s.id} className={clsx('rounded-lg border p-2', s.status === 'failed' ? 'border-rose/30 bg-rose/[0.05]' : s.status === 'completed' ? 'border-teal/20 bg-teal/[0.03]' : 'border-white/5 bg-white/[0.02]')}>
                    <div className="flex items-center gap-2">
                      <StepIcon status={s.status} />
                      <p className="text-[12px] text-slate-200">{s.index + 1}. {s.title}</p>
                      <Badge tone="info">{AGENT_ROLE_LABELS[s.role]}</Badge>
                      <span className="ml-auto text-[10px] text-slate-500">{s.status}</span>
                    </div>
                    {s.output && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10.5px] text-accent-soft">Çıktıyı göster ({s.output.length} karakter)</summary>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-white/5 bg-base-950/70 p-2 font-mono text-[10.5px] leading-relaxed text-slate-300">{s.output}</pre>
                      </details>
                    )}
                    {s.error && <p className="mt-1 rounded border border-rose/20 bg-rose/5 px-2 py-1 text-[10.5px] text-rose">{s.error}</p>}
                    {s.verification && s.verification.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {s.verification.map((v, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10.5px] text-slate-400">
                            {v.ok ? <CheckCircle2 size={11} className="mt-0.5 text-teal" /> : <XCircle size={11} className="mt-0.5 text-rose" />}
                            <span>{v.summary}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {detail.task.report && (
              <div>
                <SectionTitle>Nihai rapor</SectionTitle>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge tone={detail.task.report.finalResult === 'success' ? 'ok' : detail.task.report.finalResult === 'partial' ? 'warn' : 'danger'}>
                      {detail.task.report.finalResult === 'success' ? 'Başarılı' : detail.task.report.finalResult === 'partial' ? 'Kısmi' : 'Başarısız'}
                    </Badge>
                    <p className="text-[11.5px] text-slate-300">{detail.task.report.summary}</p>
                  </div>
                  {detail.task.report.tests.length > 0 && (
                    <div className="mt-2">
                      <p className="label">Doğrulama</p>
                      <ul className="space-y-0.5">
                        {detail.task.report.tests.map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[10.5px] text-slate-400">
                            {t.ok ? <CheckCircle2 size={11} className="mt-0.5 text-teal" /> : <XCircle size={11} className="mt-0.5 text-rose" />} {t.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(detail.task.report.createdFiles.length > 0 || detail.task.report.changedFiles.length > 0) && (
                    <div className="mt-2">
                      <p className="label">Dosyalar</p>
                      <ul className="space-y-0.5 font-mono text-[10.5px] text-slate-400">
                        {detail.task.report.createdFiles.map((f) => <li key={f} className="text-teal">+ {f}</li>)}
                        {detail.task.report.changedFiles.map((f) => <li key={f} className="text-amber">~ {f}</li>)}
                      </ul>
                      <button className="mt-1 text-[10.5px] text-accent-soft hover:underline" onClick={() => setPage('editor')}><FileCode2 size={11} className="inline" /> Değişiklikleri incele →</button>
                    </div>
                  )}
                  {detail.task.report.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="label">Hatalar / riskler</p>
                      <ul className="space-y-0.5 text-[10.5px] text-rose">{detail.task.report.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {detail.runs.length > 0 && (
              <div>
                <SectionTitle>Ajan çalışmaları ({detail.runs.length})</SectionTitle>
                <div className="overflow-hidden rounded-lg border border-white/5">
                  <table className="w-full text-left text-[10.5px]">
                    <thead className="bg-white/[0.04] text-slate-400">
                      <tr><th className="px-2 py-1">Ajan</th><th className="px-2 py-1">Model</th><th className="px-2 py-1">Durum</th><th className="px-2 py-1">Süre</th><th className="px-2 py-1">Token</th></tr>
                    </thead>
                    <tbody>
                      {detail.runs.map((r) => (
                        <tr key={r.id} className="border-t border-white/5 text-slate-300">
                          <td className="px-2 py-1">{AGENT_ROLE_LABELS[r.role]}</td>
                          <td className="mono px-2 py-1 text-[9.5px]">{r.modelId?.split(':').pop() ?? '—'}</td>
                          <td className="px-2 py-1"><Badge tone={r.status === 'completed' ? 'ok' : r.status === 'failed' ? 'danger' : 'info'}>{r.status}</Badge></td>
                          <td className="mono px-2 py-1">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                          <td className="mono px-2 py-1">{r.usage.inputTokens + r.usage.outputTokens}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

function StepIcon({ status }: { status: string }) {
  if (status === 'running') return <Loader2 size={13} className="animate-spin text-accent" />;
  if (status === 'completed') return <CheckCircle2 size={13} className="text-teal" />;
  if (status === 'failed') return <XCircle size={13} className="text-rose" />;
  return <CircleDashed size={13} className="text-slate-600" />;
}

function TaskRow({ task, active, onClick }: { task: TaskRecord; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx('w-full rounded-lg border px-2 py-1.5 text-left transition', active ? 'border-accent/40 bg-accent/10' : 'border-white/5 bg-white/[0.02] hover:border-white/15')}
    >
      <div className="flex items-center gap-1.5">
        <Badge tone={STATUS_TONE[task.status] ?? 'neutral'}>{TASK_STATUS_LABELS[task.status]}</Badge>
        <span className="ml-auto text-[9.5px] text-slate-500">{formatTime(task.createdAt)}</span>
      </div>
      <p className="mt-0.5 truncate text-[11.5px] text-slate-200">{task.title}</p>
      {['running', 'planning'].includes(task.status) && <div className="mt-1"><ProgressBar value={task.progress} /></div>}
    </button>
  );
}

/**
 * Ajan Merkezi (şartname §6).
 * Uzman ajanlar, model atamaları, izinler, onay kuyruğu ve ajan denetim zinciri.
 */
import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, ChevronRight, ShieldCheck, XCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Field, Panel, Toggle, formatDateTime } from '../components/ui';
import { AGENT_ROLE_LABELS, type AgentProfile, type AgentRole } from '@shared/types/agents';
import clsx from 'clsx';

export function AgentsPage() {
  const { models, approvals, refreshApprovals, toast } = useAppStore();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selected, setSelected] = useState<AgentRole>('manager');

  useEffect(() => {
    void api('GET /api/agents').then(setAgents);
    const t = setInterval(() => void refreshApprovals(), 8000);
    return () => clearInterval(t);
  }, [refreshApprovals]);

  const current = agents.find((a) => a.role === selected);

  const save = async (patch: Partial<AgentProfile>) => {
    if (!current) return;
    const updated = await api('PATCH /api/agents/:role', { params: { role: current.role }, body: patch });
    setAgents((prev) => prev.map((a) => (a.role === updated.role ? updated : a)));
    toast('success', 'Ajan güncellendi', AGENT_ROLE_LABELS[updated.role]);
  };

  const decide = async (id: string, approve: boolean) => {
    await api(approve ? 'POST /api/approvals/:id/approve' : 'POST /api/approvals/:id/reject', { params: { id }, body: {} });
    await refreshApprovals();
    toast(approve ? 'success' : 'info', approve ? 'Onaylandı' : 'Reddedildi');
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[300px_1fr]">
      <Panel title="Uzman ajanlar" className="min-h-0">
        <div className="space-y-1">
          {agents.map((a) => (
            <button
              key={a.role}
              onClick={() => setSelected(a.role)}
              className={clsx('flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition', selected === a.role ? 'border-accent/40 bg-accent/10' : 'border-white/5 bg-white/[0.02] hover:border-white/15')}
            >
              <div className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-md', a.enabled ? 'bg-accent/15 text-accent-soft' : 'bg-white/5 text-slate-600')}>
                <Bot size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-slate-200">{a.displayName}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {a.modelId ? models.find((m) => m.id === a.modelId)?.displayName ?? a.modelId : 'varsayılan model'}
                </p>
              </div>
              <span className={clsx('h-1.5 w-1.5 rounded-full', a.enabled ? 'bg-teal' : 'bg-slate-700')} />
              <ChevronRight size={12} className="text-slate-600" />
            </button>
          ))}
        </div>
      </Panel>

      <div className="flex min-h-0 flex-col gap-2">
        {current && (
          <Panel title={<span className="flex items-center gap-1.5"><ShieldCheck size={13} /> {current.displayName}</span>} className="shrink-0">
            <p className="mb-2 text-[11.5px] leading-relaxed text-slate-400">{current.description}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="Birincil model" hint="Bu ajana özel model ataması. Boşsa ayarlardaki varsayılan kullanılır.">
                <select className="input" value={current.modelId ?? ''} onChange={(e) => void save({ modelId: e.target.value || undefined })}>
                  <option value="">— varsayılan —</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.displayName} ({m.freeStatus === 'paid' ? 'ücretli' : m.freeStatus === 'unknown' ? '?' : 'ücretsiz'})</option>)}
                </select>
              </Field>
              <Field label="Yedek model" hint="Birincil model hata verirse bu model denenir.">
                <select className="input" value={current.fallbackModelId ?? ''} onChange={(e) => void save({ fallbackModelId: e.target.value || undefined })}>
                  <option value="">— yok —</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                </select>
              </Field>
              <Field label="Sıcaklık (yaratıcılık)" hint="Düşük = daha deterministik. Kod ajanları için 0.1–0.2 önerilir.">
                <input
                  type="range" min={0} max={1} step={0.05} value={current.temperature}
                  onChange={(e) => void save({ temperature: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
                <span className="mono text-[10px] text-slate-500">{current.temperature.toFixed(2)}</span>
              </Field>
              <Field label="Paralel çalışma sınırı">
                <input type="number" min={1} max={8} className="input" value={current.maxParallelRuns} onChange={(e) => void save({ maxParallelRuns: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-x-4 md:grid-cols-3">
              <Toggle checked={current.enabled} onChange={(v) => void save({ enabled: v })} label="Ajan etkin" hint="Kapalıysa planlamada atanmaz." />
              <Toggle checked={current.canWriteFiles} onChange={(v) => void save({ canWriteFiles: v })} label="Dosya değişikliği önerebilir" hint="Yazma yine de onay kapısından geçer." />
              <Toggle checked={current.canProposeCommands} onChange={(v) => void save({ canProposeCommands: v })} label="Komut önerebilir" hint="Yüksek riskli komutlar onay bekler." />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="label mb-0 mr-1">İzinli araçlar:</span>
              {current.allowedTools.length === 0 ? <Badge tone="neutral">araç yok</Badge> : current.allowedTools.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
            </div>
          </Panel>
        )}

        <Panel title={<span className="flex items-center gap-1.5"><XCircle size={13} /> Onay kuyruğu ({approvals.length})</span>} className="min-h-0 flex-1">
          {approvals.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={20} />} title="Bekleyen onay yok" description="Yüksek riskli işlemler (dosya yazımı, komut, Docker) burada onayınızı bekler." />
          ) : (
            <div className="space-y-2">
              {approvals.map((a) => (
                <div key={a.id} className="rounded-lg border border-amber/25 bg-amber/[0.04] p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12.5px] font-medium text-amber">{a.title}</p>
                    <Badge tone={a.risk === 'critical' ? 'danger' : a.risk === 'high' ? 'warn' : 'neutral'}>{a.risk}</Badge>
                    <Badge tone="info">{a.kind}</Badge>
                    <span className="ml-auto text-[10px] text-slate-500">{formatDateTime(a.createdAt)}</span>
                  </div>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-white/5 bg-base-950/60 p-2 font-mono text-[10.5px] text-slate-300">{a.description}</pre>
                  <div className="mt-1.5 flex gap-1">
                    <Button variant="primary" onClick={() => void decide(a.id, true)}><CheckCircle2 size={12} /> Onayla</Button>
                    <Button variant="danger" onClick={() => void decide(a.id, false)}><XCircle size={12} /> Reddet</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

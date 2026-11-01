/** Sağ panel: aktif ajanlar, görev durumu, maliyet, onaylar (şartname §4). */
import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Coins, Cpu, ShieldAlert, XCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, ProgressBar, Spinner, formatDateTime } from '../components/ui';
import type { AppStats } from '@shared/types/app';
import { TASK_STATUS_LABELS } from '@shared/types/agents';

export function RightRail() {
  const { liveTask, agentActivity, approvals, refreshApprovals, models, selectedModelId, setPage } = useAppStore();
  const [stats, setStats] = useState<AppStats | null>(null);
  const selectedModel = models.find((m) => m.id === selectedModelId);

  useEffect(() => {
    let alive = true;
    const load = () => api('GET /api/stats').then((s) => alive && setStats(s)).catch(() => undefined);
    void load();
    const timer = setInterval(load, 12_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const decide = async (id: string, approve: boolean) => {
    await api(approve ? 'POST /api/approvals/:id/approve' : 'POST /api/approvals/:id/reject', { params: { id }, body: {} });
    await refreshApprovals();
  };

  return (
    <aside className="flex w-[286px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-white/5 bg-base-900/40 p-2">
      <section className="panel p-2.5">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <Activity size={12} /> Canlı görev
        </h3>
        {liveTask ? (
          <div>
            <p className="truncate text-xs text-slate-200">{liveTask.title}</p>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>{TASK_STATUS_LABELS[liveTask.status as keyof typeof TASK_STATUS_LABELS] ?? liveTask.status}</span>
              <span className="mono">{liveTask.progress}%</span>
            </div>
            <div className="mt-1"><ProgressBar value={liveTask.progress} tone={liveTask.status === 'failed' ? 'danger' : liveTask.status === 'completed' ? 'ok' : 'info'} /></div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Şu anda çalışan görev yok.</p>
        )}
      </section>

      <section className="panel p-2.5">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <Cpu size={12} /> Aktif ajanlar
        </h3>
        {agentActivity.length === 0 ? (
          <p className="text-[11px] text-slate-500">Ajan etkinliği yok.</p>
        ) : (
          <ul className="space-y-1">
            {agentActivity.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1">
                <span className="truncate text-[11px] text-slate-300">{roleLabel(a.role)}</span>
                <Badge tone={a.status === 'running' ? 'info' : a.status === 'completed' ? 'ok' : 'danger'}>{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-2.5">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <ShieldAlert size={12} /> Onay bekleyen ({approvals.length})
        </h3>
        {approvals.length === 0 ? (
          <p className="text-[11px] text-slate-500">Bekleyen onay yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {approvals.slice(0, 4).map((a) => (
              <li key={a.id} className="rounded-md border border-amber/25 bg-amber/5 p-2">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[11px] font-medium text-amber">{a.title}</p>
                  <Badge tone={a.risk === 'critical' ? 'danger' : a.risk === 'high' ? 'warn' : 'neutral'}>{a.risk}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[10px] leading-snug text-slate-400">{a.description}</p>
                <p className="mt-1 text-[9px] text-slate-600">{formatDateTime(a.createdAt)}</p>
                <div className="mt-1.5 flex gap-1">
                  <Button variant="primary" className="flex-1" onClick={() => void decide(a.id, true)}><CheckCircle2 size={11} /> Onayla</Button>
                  <Button variant="danger" className="flex-1" onClick={() => void decide(a.id, false)}><XCircle size={11} /> Reddet</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {approvals.length > 4 && (
          <button className="mt-1.5 text-[10px] text-accent-soft hover:underline" onClick={() => setPage('agents')}>Tümünü gör →</button>
        )}
      </section>

      <section className="panel p-2.5">
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <Coins size={12} /> Kullanım ve maliyet
        </h3>
        {stats ? (
          <dl className="space-y-1 text-[11px]">
            <Row label="Bugün token" value={`${(stats.tokens.today.inputTokens + stats.tokens.today.outputTokens).toLocaleString('tr-TR')}`} />
            <Row label="Bugün maliyet" value={`$${stats.tokens.today.costUsd.toFixed(4)}`} />
            <Row label="Toplam maliyet" value={`$${stats.tokens.allTime.costUsd.toFixed(4)}`} />
            <Row label="Sağlayıcı" value={`${stats.providers.healthy}/${stats.providers.total} sağlıklı`} />
          </dl>
        ) : (
          <Spinner label="Yükleniyor" />
        )}
      </section>

      <section className="panel p-2.5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Seçili model</h3>
        {selectedModel ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-200">{selectedModel.displayName}</p>
            <p className="mono text-[10px] text-slate-500">{selectedModel.modelKey}</p>
            <div className="flex flex-wrap gap-1">
              <Badge tone={selectedModel.freeStatus === 'paid' ? 'warn' : selectedModel.freeStatus === 'unknown' ? 'neutral' : 'ok'}>
                {selectedModel.freeStatus === 'paid' ? 'Ücretli' : selectedModel.freeStatus === 'unknown' ? 'Doğrulanmadı' : 'Ücretsiz'}
              </Badge>
              {selectedModel.capabilities.slice(0, 3).map((cap) => (
                <Badge key={cap} tone="info">{cap}</Badge>
              ))}
            </div>
            {selectedModel.pricing.inputPerMillionUsd > 0 && (
              <p className="text-[10px] text-slate-500">Girdi ${selectedModel.pricing.inputPerMillionUsd}/1M · Çıktı ${selectedModel.pricing.outputPerMillionUsd}/1M</p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Model seçilmedi.</p>
        )}
      </section>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mono text-slate-300">{value}</dd>
    </div>
  );
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    manager: 'Yönetici', researcher: 'Araştırma', architect: 'Mimar', coder: 'Kodlama', tester: 'Test',
    security: 'Güvenlik', performance: 'Performans', docs: 'Dokümantasyon', browser: 'Tarayıcı',
  };
  return map[role] ?? role;
}

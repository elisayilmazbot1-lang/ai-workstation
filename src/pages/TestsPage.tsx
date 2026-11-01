/** Test merkezi: gerçek test çalıştırma, sonuç matrisi (asla "çalıştırılmadı"yı başarı saymaz). */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, FlaskConical, Play, XCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Panel, formatDateTime } from '../components/ui';
import type { TestKind, TestRunReport, TestSuiteResult } from '@shared/types/runtime';

const KIND_TR: Record<string, string> = {
  syntax: 'Sözdizimi', typecheck: 'Tip denetimi', unit: 'Birim testleri', integration: 'Entegrasyon',
  e2e: 'Uçtan uca', security: 'Güvenlik', dependency: 'Bağımlılık', performance: 'Performans', build: 'Derleme', packaging: 'Paketleme',
};
const OUTCOME_TONE: Record<string, 'ok' | 'danger' | 'neutral' | 'warn'> = {
  passed: 'ok', failed: 'danger', error: 'danger', skipped: 'neutral', cancelled: 'warn', 'not-run': 'warn',
};
const OUTCOME_TR: Record<string, string> = {
  passed: 'Geçti', failed: 'Başarısız', error: 'Hata', skipped: 'Atlandı', cancelled: 'İptal edildi', 'not-run': 'Çalıştırılmadı',
};

export function TestsPage() {
  const { activeProjectId, toast } = useAppStore();
  const [report, setReport] = useState<TestRunReport | null>(null);
  const [history, setHistory] = useState<TestRunReport[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState<string[]>(['typecheck', 'unit', 'build']);

  useEffect(() => {
    void api('GET /api/tests/runs', { query: { limit: '20' } }).then(setHistory).catch(() => undefined);
  }, []);

  const run = async () => {
    setRunning(true);
    try {
      const result = await api('POST /api/tests/run', { body: { projectId: activeProjectId, kinds: selectedKinds } });
      setReport(result);
      setHistory((prev) => [result, ...prev]);
      const tone = result.overall === 'passed' ? 'success' : result.overall === 'failed' || result.overall === 'error' ? 'error' : 'warning';
      toast(tone, 'Test tamamlandı', `Genel durum: ${OUTCOME_TR[result.overall] ?? result.overall}`);
    } catch (err) {
      toast('error', 'Test çalıştırılamadı', (err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const toggleKind = (kind: string) => setSelectedKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel
          title={<span className="flex items-center gap-1.5"><FlaskConical size={13} /> Test çalıştır</span>}
          actions={<Button variant="primary" loading={running} onClick={() => void run()}><Play size={12} /> Çalıştır</Button>}
          className="shrink-0"
        >
          <div className="flex flex-wrap gap-1">
            {(['syntax', 'typecheck', 'unit', 'integration', 'e2e', 'security', 'dependency', 'performance', 'build', 'packaging'] as TestKind[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={`rounded-md border px-2 py-1 text-[10.5px] ${selectedKinds.includes(k) ? 'border-accent/40 bg-accent/15 text-accent-soft' : 'border-white/10 text-slate-400 hover:border-white/20'}`}
              >
                {KIND_TR[k]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            Not: projede ilgili test altyapısı yoksa sonuç "Çalıştırılmadı" olarak raporlanır ve asla başarı sayılmaz.
          </p>
        </Panel>

        <Panel title="Sonuçlar" className="min-h-0 flex-1">
          {!report ? (
            <EmptyState icon={<FlaskConical size={20} />} title="Henüz test çalıştırılmadı" description="Testleri seçip çalıştırın; sonuçlar burada ayrıntılı listelenir." />
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2">
                <Badge tone={OUTCOME_TONE[report.overall] ?? 'neutral'}>{OUTCOME_TR[report.overall]}</Badge>
                <span className="text-[10.5px] text-slate-400">{formatDateTime(report.startedAt)}</span>
                <span className="ml-auto text-[10px] text-slate-500">{report.suites.length} paket</span>
              </div>
              {report.suites.map((suite, i) => <SuiteCard key={i} suite={suite} />)}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Geçmiş" className="min-h-0">
        {history.length === 0 ? (
          <p className="text-[11px] text-slate-500">Kayıt yok.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id}>
                <button onClick={() => setReport(h)} className="w-full rounded border border-white/5 px-2 py-1 text-left hover:bg-white/5">
                  <div className="flex items-center gap-1">
                    <Badge tone={OUTCOME_TONE[h.overall] ?? 'neutral'}>{OUTCOME_TR[h.overall]}</Badge>
                    <span className="ml-auto text-[9px] text-slate-500">{formatDateTime(h.startedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{h.suites.filter((s) => s.outcome === 'passed').length}/{h.suites.length} paket geçti</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function SuiteCard({ suite }: { suite: TestSuiteResult }) {
  const Icon =
    suite.outcome === 'passed' ? CheckCircle2
      : suite.outcome === 'failed' || suite.outcome === 'error' ? XCircle
        : suite.outcome === 'not-run' || suite.outcome === 'cancelled' ? AlertTriangle
          : CircleSlash;
  return (
    <div
      className={`rounded-lg border p-2 ${
        suite.outcome === 'failed' || suite.outcome === 'error'
          ? 'border-rose/30 bg-rose/[0.05]'
          : suite.outcome === 'not-run' || suite.outcome === 'cancelled'
            ? 'border-amber/25 bg-amber/[0.04]'
            : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={13}
          className={
            suite.outcome === 'passed' ? 'text-teal' : suite.outcome === 'failed' || suite.outcome === 'error' ? 'text-rose' : 'text-amber'
          }
        />
        <p className="text-[12px] text-slate-200">{KIND_TR[suite.kind] ?? suite.kind}</p>
        <Badge tone={OUTCOME_TONE[suite.outcome] ?? 'neutral'}>{OUTCOME_TR[suite.outcome]}</Badge>
        {suite.total > 0 && <span className="mono text-[10px] text-slate-400">{suite.passed}/{suite.total}</span>}
        {suite.durationMs > 0 && <span className="mono ml-auto text-[9.5px] text-slate-500">{(suite.durationMs / 1000).toFixed(1)}s</span>}
      </div>
      {suite.command && <p className="mono mt-0.5 truncate text-[9.5px] text-slate-500">$ {suite.command}</p>}
      {suite.notRunReason && <p className="mt-0.5 text-[10.5px] text-amber">{suite.notRunReason}</p>}
      {suite.cases.filter((c) => c.outcome === 'failed').slice(0, 8).map((c, i) => (
        <div key={i} className="mt-1 rounded border border-rose/20 bg-rose/[0.04] p-1.5">
          <p className="text-[10.5px] text-rose">{c.name}</p>
          {c.error && <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[9.5px] text-slate-400">{c.error}</pre>}
          {c.suggestion && <p className="mt-0.5 text-[10px] text-amber">Öneri: {c.suggestion}</p>}
        </div>
      ))}
    </div>
  );
}

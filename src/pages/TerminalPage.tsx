/** Terminal: risk analizi, onay kapısı, komut geçmişi. */
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Play, ShieldCheck, TerminalSquare, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Panel, formatTime } from '../components/ui';
import type { CommandAnalysis, TerminalCommandRecord, TerminalRunResult } from '@shared/types/runtime';
import clsx from 'clsx';

const RISK_TONE: Record<string, 'ok' | 'warn' | 'danger'> = { low: 'ok', medium: 'warn', high: 'danger', critical: 'danger' };
const RISK_TR: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', critical: 'Kritik' };

export function TerminalPage() {
  const { activeProjectId, projects, toast } = useAppStore();
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [analysis, setAnalysis] = useState<CommandAnalysis | null>(null);
  const [output, setOutput] = useState<Array<{ command: string; result: TerminalRunResult }>>([]);
  const [history, setHistory] = useState<TerminalCommandRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<{ approvalId: string; analysis: CommandAnalysis; command: string } | null>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const project = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    setCwd((prev) => prev || project?.rootPath || '');
  }, [project]);

  useEffect(() => {
    void api('GET /api/terminal/history', { query: { limit: '40' } }).then(setHistory);
  }, [output.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!command.trim()) {
        setAnalysis(null);
        return;
      }
      void api('POST /api/terminal/analyze', { body: { command } }).then(setAnalysis).catch(() => undefined);
    }, 220);
    return () => clearTimeout(timer);
  }, [command]);

  const run = async (extra?: { approvalId?: string; cmd?: string }) => {
    const cmd = extra?.cmd ?? command;
    if (!cmd.trim() || !cwd.trim()) return;
    setRunning(true);
    try {
      const result = await api('POST /api/terminal/run', {
        body: { command: cmd, cwd, approvalId: extra?.approvalId, timeoutMs: 120_000 },
      });
      if (result.requiresApproval) {
        setPending({ approvalId: result.requiresApproval.approvalId, analysis: result.requiresApproval.analysis, command: cmd });
      } else {
        setOutput((prev) => [...prev, { command: cmd, result }]);
        setPending(null);
        setCommand('');
      }
    } catch (err) {
      toast('error', 'Komut çalıştırılamadı', (err as Error).message);
    } finally {
      setRunning(false);
      setTimeout(() => outRef.current?.scrollTo({ top: outRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  };

  const approveAndRun = async () => {
    if (!pending) return;
    await api('POST /api/approvals/:id/approve', { params: { id: pending.approvalId }, body: {} });
    await run({ approvalId: pending.approvalId, cmd: pending.command });
  };

  const reject = async () => {
    if (!pending) return;
    await api('POST /api/approvals/:id/reject', { params: { id: pending.approvalId }, body: {} });
    setPending(null);
    toast('info', 'Komut reddedildi');
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-base-900/70 px-2 py-1">
            <TerminalSquare size={13} className="text-teal" />
            <input className="input border-0 bg-transparent p-0 focus:ring-0" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Çalışma dizini" />
          </div>
          {analysis && (
            <Badge tone={RISK_TONE[analysis.risk] ?? 'warn'} title={analysis.reasons.join(', ')}>
              {analysis.requiresApproval ? <ShieldCheck size={9} /> : null} {RISK_TR[analysis.risk]} risk
            </Badge>
          )}
        </div>

        <div ref={outRef} className="panel min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed">
          {output.length === 0 && (
            <EmptyState icon={<TerminalSquare size={20} />} title="Komut geçmişi boş" description="Aşağıya bir komut yazın. Orta ve yüksek riskli komutlar onayınızı isteyecek." />
          )}
          {output.map((entry, i) => (
            <div key={i} className="mb-3">
              <p className="text-teal">$ {entry.command}</p>
              {entry.result.stdout && <pre className="whitespace-pre-wrap text-slate-300">{entry.result.stdout}</pre>}
              {entry.result.stderr && <pre className="whitespace-pre-wrap text-rose">{entry.result.stderr}</pre>}
              <p className="mt-0.5 text-[10px] text-slate-600">
                çıkış kodu: {entry.result.exitCode ?? '—'} · {entry.result.durationMs} ms{entry.result.truncated ? ' · çıktı kısaltıldı' : ''}
              </p>
            </div>
          ))}
        </div>

        {pending && (
          <div className="shrink-0 rounded-lg border border-amber/40 bg-amber/[0.07] p-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber" />
              <p className="text-[12px] font-medium text-amber">Bu komut için onay gerekiyor ({RISK_TR[pending.analysis.risk]} risk)</p>
            </div>
            <pre className="mt-1 whitespace-pre-wrap rounded border border-white/10 bg-base-950/70 p-2 font-mono text-[11px] text-slate-200">{pending.command}</pre>
            <p className="mt-1 text-[10.5px] text-slate-400">Neden: {pending.analysis.reasons.join(', ')}</p>
            <div className="mt-1.5 flex gap-1">
              <Button variant="primary" onClick={() => void approveAndRun()}><Play size={11} /> Onayla ve çalıştır</Button>
              <Button variant="danger" onClick={() => void reject()}>Reddet</Button>
            </div>
          </div>
        )}

        <div className="flex shrink-0 gap-1.5">
          <input
            className="input font-mono"
            placeholder="Komut yazın… (Enter ile çalıştır)"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void run()}
          />
          <Button variant="primary" loading={running} onClick={() => void run()}><Play size={12} /> Çalıştır</Button>
          <Button variant="ghost" onClick={() => setOutput([])} title="Ekranı temizle"><Trash2 size={12} /></Button>
        </div>
      </div>

      <Panel title="Komut geçmişi" className="min-h-0">
        {history.length === 0 ? (
          <p className="text-[11px] text-slate-500">Kayıt yok.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="rounded border border-white/5 px-1.5 py-1">
                <div className="flex items-center gap-1">
                  <Badge tone={RISK_TONE[h.risk] ?? 'warn'}>{RISK_TR[h.risk]}</Badge>
                  <span className="ml-auto text-[9px] text-slate-500">{formatTime(h.startedAt)}</span>
                </div>
                <button className="mono mt-0.5 block w-full truncate text-left text-[10px] text-slate-300 hover:text-accent-soft" onClick={() => setCommand(h.command)} title="Komutu yükle">
                  {h.command}
                </button>
                <p className={clsx('text-[9px]', h.exitCode === 0 ? 'text-teal' : 'text-rose')}>çıkış: {h.exitCode ?? '—'} · {h.proposedBy === 'agent' ? 'ajan önerisi' : 'kullanıcı'}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

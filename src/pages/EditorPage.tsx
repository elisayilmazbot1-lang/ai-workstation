/**
 * Kod editörü — Monaco.
 * Değişiklik önerileri (diff) ve onay/geri alma akışı.
 */
import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { configureMonaco } from '../services/monaco';
import { CheckCircle2, FileCode2, GitCompareArrows, Undo2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Panel, formatDateTime } from '../components/ui';
import type { FileChangeRecord } from '@shared/types/agents';
import clsx from 'clsx';

configureMonaco();

export function EditorPage() {
  const { activeProjectId, toast, refreshApprovals } = useAppStore();
  const [changes, setChanges] = useState<FileChangeRecord[]>([]);
  const [selected, setSelected] = useState<FileChangeRecord | null>(null);
  const [tab, setTab] = useState<'diff' | 'content'>('diff');

  const refresh = async () => {
    if (!activeProjectId) return;
    const list = await api('GET /api/changes', { query: { projectId: activeProjectId } });
    setChanges(list);
    if (!selected && list[0]) setSelected(list[0]);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const [requesting, setRequesting] = useState(false);

  /** Onay isteği oluşturur; onay kuyruğundan onaylandıktan sonra uygulanır. */
  const requestApproval = async (id: string) => {
    setRequesting(true);
    try {
      await api('POST /api/changes/request-approval', { body: { changeIds: [id] } });
      toast('info', 'Onay isteği oluşturuldu', 'Sağ raydaki onay kuyruğundan onaylayabilirsiniz.');
      await refreshApprovals();
    } catch (err) {
      toast('error', 'Onay isteği oluşturulamadı', (err as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  /**
   * Uygulama yalnızca onay verilmişse mümkündür. Onay yoksa kullanıcıya
   * onay isteği oluşturulur ve hata dürüstçe gösterilir.
   */
  const apply = async (id: string) => {
    try {
      await api('POST /api/changes/:id/apply', { params: { id } });
      toast('success', 'Değişiklik uygulandı');
      await refresh();
      await refreshApprovals();
    } catch (err) {
      const message = (err as Error).message;
      if (/onay/i.test(message)) {
        await requestApproval(id);
        toast('warning', 'Onay gerekiyor', 'Onay kuyruğundan bu değişikliği onayladıktan sonra Uygula düğmesine basın.');
        return;
      }
      toast('error', 'Uygulanamadı', message);
    }
  };

  const revert = async (id: string) => {
    try {
      await api('POST /api/changes/:id/revert', { params: { id } });
      toast('success', 'Değişiklik geri alındı');
      await refresh();
    } catch (err) {
      toast('error', 'Geri alınamadı', (err as Error).message);
    }
  };

  const language = selected?.path.endsWith('.ts') || selected?.path.endsWith('.tsx') ? 'typescript' : selected?.path.endsWith('.json') ? 'json' : 'plaintext';

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[300px_1fr]">
      <Panel title={<span className="flex items-center gap-1.5"><GitCompareArrows size={13} /> Değişiklikler ({changes.length})</span>} className="min-h-0">
        {changes.length === 0 ? (
          <EmptyState icon={<FileCode2 size={20} />} title="Değişiklik yok" description="Ajanlar dosya değişikliği önerdiğinde burada görünür." />
        ) : (
          <ul className="space-y-1">
            {changes.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c)}
                  className={clsx('w-full rounded-lg border px-2 py-1.5 text-left transition', selected?.id === c.id ? 'border-accent/40 bg-accent/10' : 'border-white/5 bg-white/[0.02] hover:border-white/15')}
                >
                  <div className="flex items-center gap-1">
                    <Badge tone={c.status === 'applied' ? 'ok' : c.status === 'proposed' ? 'warn' : 'neutral'}>{c.status}</Badge>
                    <Badge tone="info">{c.operation}</Badge>
                  </div>
                  <p className="mono mt-0.5 truncate text-[10.5px] text-slate-200">{c.path}</p>
                  <p className="text-[9px] text-slate-500">{formatDateTime(c.createdAt)}{c.agentRole ? ` · ${c.agentRole}` : ''}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={selected ? selected.path : 'Değişiklik'}
        actions={
          selected && (
            <div className="flex gap-1">
              {selected.status === 'proposed' && (
                <>
                  <Button variant="primary" disabled={requesting} onClick={() => void apply(selected.id)}><CheckCircle2 size={11} /> Uygula</Button>
                  <Button disabled={requesting} onClick={() => void requestApproval(selected.id)} title="Onay kuyruğuna ekle">
                    Onaya sun
                  </Button>
                </>
              )}
              {selected.status === 'applied' && (
                <Button variant="danger" onClick={() => void revert(selected.id)}><Undo2 size={11} /> Geri al</Button>
              )}
              <div className="ml-1 flex overflow-hidden rounded-md border border-white/10">
                <button className={clsx('px-2 py-1 text-[10px]', tab === 'diff' ? 'bg-accent/20 text-accent-soft' : 'text-slate-400')} onClick={() => setTab('diff')}>Diff</button>
                <button className={clsx('px-2 py-1 text-[10px]', tab === 'content' ? 'bg-accent/20 text-accent-soft' : 'text-slate-400')} onClick={() => setTab('content')}>Yeni içerik</button>
              </div>
            </div>
          )
        }
        className="min-h-0"
      >
        {!selected ? (
          <EmptyState title="Değişiklik seçilmedi" description="Soldan bir değişiklik seçin." />
        ) : tab === 'diff' ? (
          <div className="h-full min-h-0 overflow-auto rounded-lg border border-white/5 bg-base-950/60 p-2">
            <pre className="font-mono text-[10.5px] leading-relaxed">
              {selected.diff.split('\n').map((line, i) => (
                <div key={i} className={clsx(line.startsWith('+') && !line.startsWith('+++') ? 'bg-teal/10 text-teal' : line.startsWith('-') && !line.startsWith('---') ? 'bg-rose/10 text-rose' : line.startsWith('@@') ? 'text-accent-soft' : 'text-slate-400')}>
                  {line || ' '}
                </div>
              ))}
            </pre>
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={selected.newContent ?? ''}
            theme="vs-dark"
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false, wordWrap: 'on' }}
          />
        )}
      </Panel>
    </div>
  );
}

/** Dosyalar: ağaç görünümü, okuma, arama, yedekler, değişiklik geçmişi. */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, File, FilePlus2, Folder, History, RotateCcw, Save, Search } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Panel, formatDateTime, formatBytes } from '../components/ui';
import type { BackupRecord, FileNode, FileReadResult } from '@shared/types/projects';
import type { FileChangeRecord } from '@shared/types/agents';
import clsx from 'clsx';

export function FilesPage() {
  const { activeProjectId, projects, toast, setPage } = useAppStore();
  const [tree, setTree] = useState<FileNode | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [file, setFile] = useState<FileReadResult | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ path: string; line: number; preview: string }>>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [changes, setChanges] = useState<FileChangeRecord[]>([]);

  const project = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!activeProjectId) return;
    void api('GET /api/projects/:id/tree', { params: { id: activeProjectId }, query: { depth: '6' } }).then(setTree);
    void api('GET /api/changes', { query: { projectId: activeProjectId } }).then(setChanges);
  }, [activeProjectId]);

  const openFile = async (path: string) => {
    if (!activeProjectId) return;
    try {
      const data = await api('GET /api/projects/:id/file', { params: { id: activeProjectId }, query: { path } });
      setFile(data);
      setDraft(data.content);
      setSelectedPath(path);
      const b = await api('GET /api/projects/:id/backups', { params: { id: activeProjectId }, query: { path } });
      setBackups(b);
    } catch (err) {
      toast('error', 'Dosya açılamadı', (err as Error).message);
    }
  };

  const save = async () => {
    if (!activeProjectId || !file) return;
    try {
      // Yazma onay ister: sunucu 428 döndürürse onay oluşturulur.
      const attempt = await api('PUT /api/projects/:id/file', { params: { id: activeProjectId }, body: { path: file.path, content: draft } });
      toast('success', 'Kaydedildi', attempt.change.path);
      await openFile(file.path);
      void api('GET /api/changes', { query: { projectId: activeProjectId } }).then(setChanges);
    } catch (err) {
      const e = err as { status?: number; approvalId?: string; message: string };
      if (e.status === 428 && e.approvalId) {
        const confirmed = window.confirm(`${file.path} dosyasına yazmak için onay gerekiyor.\n\nŞimdi onaylıyor musunuz?`);
        if (!confirmed) {
          await api('POST /api/approvals/:id/reject', { params: { id: e.approvalId }, body: {} });
          return;
        }
        await api('POST /api/approvals/:id/approve', { params: { id: e.approvalId }, body: {} });
        const done = await api('PUT /api/projects/:id/file', { params: { id: activeProjectId }, body: { path: file.path, content: draft, approvalId: e.approvalId } });
        toast('success', 'Kaydedildi', done.change.path);
        await openFile(file.path);
        void api('GET /api/changes', { query: { projectId: activeProjectId } }).then(setChanges);
      } else {
        toast('error', 'Kaydedilemedi', e.message);
      }
    }
  };

  const doSearch = async () => {
    if (!activeProjectId || search.trim().length < 2) return;
    const found = await api('POST /api/projects/:id/search', { params: { id: activeProjectId }, body: { query: search.trim() } });
    setResults(found);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[260px_1fr_300px]">
      <Panel title={project ? project.name : 'Proje seçilmedi'} className="min-h-0">
        {!tree ? (
          <EmptyState title="Proje seçin" description="Üst çubuktan veya Projeler sayfasından bir proje seçin." action={<Button onClick={() => setPage('projects')}>Projelere git</Button>} />
        ) : (
          <div className="text-[11.5px]">
            <TreeNode node={tree} onOpen={(p) => void openFile(p)} selected={selectedPath} depth={0} />
          </div>
        )}
      </Panel>

      <Panel
        title={file ? file.path : 'Dosya'}
        actions={
          file && (
            <div className="flex items-center gap-1">
              <Badge tone="info">{file.language}</Badge>
              <span className="text-[10px] text-slate-500">{formatBytes(file.size)}</span>
              <Button variant="primary" onClick={() => void save()} disabled={draft === file.content}><Save size={11} /> Kaydet</Button>
            </div>
          )
        }
        className="min-h-0"
      >
        {!file ? (
          <EmptyState title="Dosya açılmadı" description="Soldaki ağaçtan bir dosya seçin." />
        ) : file.encoding === 'binary' ? (
          <EmptyState title="İkili dosya" description="Bu dosya metin olarak görüntülenemez." />
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-1">
            {file.truncated && <p className="rounded border border-amber/30 bg-amber/10 px-2 py-1 text-[10.5px] text-amber">Dosya çok büyük; ilk bölümü gösteriliyor.</p>}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none rounded-lg border border-white/10 bg-base-950/70 p-2 font-mono text-[11.5px] leading-relaxed text-slate-200 outline-none focus:border-accent/40"
            />
          </div>
        )}
      </Panel>

      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Ara" className="shrink-0">
          <div className="flex gap-1">
            <input className="input" placeholder="Proje içinde ara…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void doSearch()} />
            <Button onClick={() => void doSearch()}><Search size={12} /></Button>
          </div>
          <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
            {results.map((r, i) => (
              <button key={i} onClick={() => void openFile(r.path)} className="block w-full rounded border border-white/5 px-1.5 py-1 text-left hover:bg-white/5">
                <p className="mono truncate text-[10px] text-accent-soft">{r.path}:{r.line}</p>
                <p className="truncate text-[10px] text-slate-400">{r.preview}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={<span className="flex items-center gap-1.5"><History size={12} /> Yedekler</span>} className="min-h-0 flex-1">
          {backups.length === 0 ? (
            <p className="text-[11px] text-slate-500">Bu dosya için yedek yok.</p>
          ) : (
            <ul className="space-y-1">
              {backups.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-1 rounded border border-white/5 px-1.5 py-1">
                  <div className="min-w-0">
                    <p className="text-[10.5px] text-slate-300">{formatDateTime(b.createdAt)}</p>
                    <p className="text-[9.5px] text-slate-500">{b.reason} · {formatBytes(b.size)}</p>
                  </div>
                  <Button variant="ghost" title="Bu yedeğe dön" onClick={() => void api('POST /api/projects/:id/backups/:backupId/restore', { params: { id: activeProjectId!, backupId: b.id } }).then(() => { void openFile(b.path); toast('success', 'Yedek geri yüklendi'); })}>
                    <RotateCcw size={11} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Değişiklik geçmişi" className="min-h-0 flex-1">
          {changes.length === 0 ? (
            <p className="text-[11px] text-slate-500">Değişiklik kaydı yok.</p>
          ) : (
            <ul className="space-y-1">
              {changes.slice(0, 30).map((c) => (
                <li key={c.id} className="rounded border border-white/5 px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <Badge tone={c.status === 'applied' ? 'ok' : c.status === 'proposed' ? 'warn' : c.status === 'reverted' ? 'neutral' : 'info'}>{c.status}</Badge>
                    <span className="mono truncate text-[9.5px] text-slate-400">{c.path}</span>
                  </div>
                  <p className="mt-0.5 text-[9.5px] text-slate-500">{formatDateTime(c.createdAt)} · {c.operation}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function TreeNode({ node, onOpen, selected, depth }: { node: FileNode; onOpen: (path: string) => void; selected?: string; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  if (node.type === 'file') {
    return (
      <button
        onClick={() => onOpen(node.path)}
        className={clsx('flex w-full items-center gap-1 rounded px-1 py-[3px] text-left hover:bg-white/5', selected === node.path && 'bg-accent/15 text-accent-soft')}
        style={{ paddingLeft: depth * 10 + 4 }}
      >
        <File size={11} className="shrink-0 opacity-60" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={clsx('flex w-full items-center gap-1 rounded px-1 py-[3px] text-left hover:bg-white/5', node.ignored && 'opacity-40')}
        style={{ paddingLeft: depth * 10 + 4 }}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Folder size={11} className="opacity-70" />
        <span className="truncate">{node.name}</span>
        {node.ignored && <span className="ml-1 text-[9px]">(hariç)</span>}
      </button>
      {expanded && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} onOpen={onOpen} selected={selected} depth={depth + 1} />
      ))}
    </div>
  );
}

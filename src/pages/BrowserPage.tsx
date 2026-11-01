/**
 * Tarayıcı paneli (şartname §9).
 * Masaüstünde Electron webContents görünümü kullanılır; bu panel onu
 * yönetir ve sayfa okuma/ekran görüntüsü sonuçlarını gösterir.
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Globe, Lock, MousePointerClick, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Panel } from '../components/ui';
import type { BrowserPageSnapshot, BrowserTabInfo } from '@shared/types/runtime';
import { isDesktop } from '../services/api';

export function BrowserPage() {
  const { toast } = useAppStore();
  const [tabs, setTabs] = useState<BrowserTabInfo[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>();
  const [url, setUrl] = useState('https://example.com');
  const [snapshot, setSnapshot] = useState<BrowserPageSnapshot | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{ id: string; message: string } | null>(null);

  const refresh = async () => {
    try {
      const list = await api('GET /api/browser/tabs');
      setTabs(list);
      if (!activeTab && list[0]) setActiveTab(list[0].id);
    } catch {
      setTabs([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const run = async (action: Record<string, unknown>, approvalId?: string) => {
    if (!activeTab) return;
    try {
      const result = await api('POST /api/browser/action', { body: { tabId: activeTab, action, approvalId } as never });
      if (result.snapshot) setSnapshot(result.snapshot);
      if (!result.ok) {
        const match = result.message.match(/\(([^)]+)\)/);
        if (match?.[1] && result.message.includes('onay')) setPendingApproval({ id: match[1], message: result.message });
        else toast('warning', 'Tarayıcı', result.message);
      }
    } catch (err) {
      toast('error', 'Tarayıcı hatası', (err as Error).message);
    }
  };

  if (!isDesktop) {
    return (
      <Panel title="Tarayıcı" className="h-full">
        <EmptyState
          icon={<Globe size={22} />}
          title="Tarayıcı masaüstü uygulamasında etkin"
          description="Gömülü tarayıcı görünümü Electron ana sürecinde çalışır. Bu web önizlemesinde güvenlik gereği tarayıcı otomasyonu devre dışıdır. Windows uygulamasında tam işlevseldir."
        />
      </Panel>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[1fr_340px]">
      <Panel title={<span className="flex items-center gap-1.5"><Globe size={13} /> Tarayıcı</span>} className="min-h-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={() => void run({ type: 'go-back' })}><ArrowLeft size={12} /></Button>
            <Button variant="ghost" onClick={() => void run({ type: 'go-forward' })}><ArrowRight size={12} /></Button>
            <Button variant="ghost" onClick={() => void run({ type: 'reload' })}><RefreshCw size={12} /></Button>
            <input className="input flex-1 font-mono" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void run({ type: 'navigate', url })} />
            <Button onClick={() => void run({ type: 'navigate', url })}>Git</Button>
            <Button variant="ghost" onClick={() => void run({ type: 'screenshot' })} title="Ekran görüntüsü"><Camera size={12} /></Button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-white/10 bg-base-950/60 p-3">
            {snapshot?.screenshot ? (
              <img src={snapshot.screenshot} alt="sayfa görüntüsü" className="max-h-[60vh] w-auto rounded border border-white/10" />
            ) : (
              <div className="text-center text-[11.5px] text-slate-500">
                <Lock size={18} className="mx-auto mb-1 opacity-50" />
                Gömülü tarayıcı görünümü ayrı pencerede çalışır.<br />Bu panel gezinme ve sayfa analizi denetimlerini gösterir.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button onClick={() => void run({ type: 'read-page' })}><ShieldAlert size={11} /> Sayfayı oku ve analiz et</Button>
            {snapshot?.interactiveElements.slice(0, 3).map((el) => (
              <Button key={el.selector} variant="ghost" onClick={() => void run({ type: 'click', selector: el.selector })} title={el.selector}>
                <MousePointerClick size={11} /> {el.text.slice(0, 18) || el.tag}
              </Button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Sekmeler" className="max-h-40 shrink-0">
          {tabs.length === 0 ? <p className="text-[11px] text-slate-500">Sekme yok.</p> : (
            <ul className="space-y-1">
              {tabs.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setActiveTab(t.id)} className={`w-full truncate rounded border px-2 py-1 text-left text-[11px] ${t.id === activeTab ? 'border-accent/40 bg-accent/10 text-accent-soft' : 'border-white/5 text-slate-300'}`}>
                    {t.title || t.url}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {pendingApproval && (
          <Panel title="Onay gerekli" className="shrink-0">
            <p className="text-[11px] text-amber">{pendingApproval.message}</p>
            <div className="mt-1.5 flex gap-1">
              <Button variant="primary" onClick={() => void api('POST /api/approvals/:id/approve', { params: { id: pendingApproval.id }, body: {} }).then(() => setPendingApproval(null))}>Onayla</Button>
              <Button variant="danger" onClick={() => void api('POST /api/approvals/:id/reject', { params: { id: pendingApproval.id }, body: {} }).then(() => setPendingApproval(null))}>Reddet</Button>
            </div>
          </Panel>
        )}

        <Panel title="Sayfa analizi" className="min-h-0 flex-1">
          {!snapshot ? (
            <p className="text-[11px] text-slate-500">Sayfayı okumak için yukarıdaki düğmeyi kullanın.</p>
          ) : (
            <div className="space-y-2 text-[11px]">
              <div>
                <p className="label">Başlık</p>
                <p className="text-slate-200">{snapshot.title || '—'}</p>
                <p className="mono truncate text-[9.5px] text-slate-500">{snapshot.url}</p>
              </div>
              <div>
                <p className="label">Etkileşimli öğeler ({snapshot.interactiveElements.length})</p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                  {snapshot.interactiveElements.slice(0, 30).map((el, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <Badge tone="neutral">{el.tag}</Badge>
                      <span className="truncate text-slate-300">{el.text || el.selector}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="label">Metin önizlemesi</p>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[10.5px] text-slate-400">{snapshot.text.slice(0, 2000)}</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

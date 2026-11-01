/** Üst alan: proje seçimi, model seçimi, arama, bildirim, acil durdurma. */
import React, { useEffect, useState } from 'react';
import { AlertOctagon, Bell, ChevronDown, Cpu, FolderOpen, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Badge, Button } from '../components/ui';
import clsx from 'clsx';
import { api } from '../services/api';

export function TitleBar() {
  const { projects, activeProjectId, setActiveProject, models, selectedModelId, setSelectedModel, setPage, notifications, health } = useAppStore();
  const [openModel, setOpenModel] = useState(false);
  const [openProject, setOpenProject] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const emergency = Boolean(health?.emergencyStop);

  useEffect(() => {
    const close = () => {
      setOpenModel(false);
      setOpenProject(false);
      setOpenNotif(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-white/5 bg-base-900/80 px-3 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-accent/20 text-accent-soft shadow-glow">
          <Sparkles size={14} />
        </div>
        <div className="leading-none">
          <p className="text-[12px] font-semibold tracking-wide text-slate-100">AI WORKSTATION</p>
          <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">Yapay zekâ geliştirme istasyonu</p>
        </div>
      </div>

      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* Proje seçimi */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-ghost h-7 gap-1.5 px-2 text-[11px]" onClick={() => setOpenProject((v) => !v)}>
          <FolderOpen size={13} className="text-slate-400" />
          <span className="max-w-[160px] truncate">{activeProject?.name ?? 'Proje seçilmedi'}</span>
          <ChevronDown size={12} className="text-slate-500" />
        </button>
        {openProject && (
          <div className="absolute left-0 top-8 z-30 w-72 animate-slide-in rounded-lg border border-white/10 bg-base-850 p-1 shadow-panel">
            {projects.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Henüz proje eklenmedi. Projeler sayfasından klasör seçin.</p>}
            {projects.map((p) => (
              <button
                key={p.id}
                className={clsx('flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-white/5', p.id === activeProjectId && 'bg-accent/10')}
                onClick={() => {
                  setActiveProject(p.id);
                  setOpenProject(false);
                }}
              >
                <span className="text-xs text-slate-200">{p.name}</span>
                <span className="mono w-full truncate text-[10px] text-slate-500">{p.rootPath}</span>
              </button>
            ))}
            <button className="mt-1 w-full rounded-md border border-white/10 px-2 py-1.5 text-left text-[11px] text-accent-soft hover:bg-white/5" onClick={() => { setPage('projects'); setOpenProject(false); }}>
              + Yeni proje ekle
            </button>
          </div>
        )}
      </div>

      {/* Model seçimi */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-ghost h-7 gap-1.5 px-2 text-[11px]" onClick={() => setOpenModel((v) => !v)}>
          <Cpu size={13} className="text-slate-400" />
          <span className="max-w-[180px] truncate">{selectedModel?.displayName ?? 'Model seçin'}</span>
          {selectedModel && <Badge tone={selectedModel.freeStatus === 'paid' ? 'warn' : 'ok'}>{selectedModel.freeStatus === 'paid' ? 'Ücretli' : selectedModel.freeStatus === 'unknown' ? 'Doğrulanmadı' : 'Ücretsiz'}</Badge>}
          <ChevronDown size={12} className="text-slate-500" />
        </button>
        {openModel && (
          <div className="absolute left-0 top-8 z-30 max-h-80 w-80 animate-slide-in overflow-auto rounded-lg border border-white/10 bg-base-850 p-1 shadow-panel">
            {models.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Model yok. Model Merkezi'nden sağlayıcı ekleyin.</p>}
            {models.slice(0, 60).map((m) => (
              <button
                key={m.id}
                className={clsx('flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5', m.id === selectedModelId && 'bg-accent/10')}
                onClick={() => {
                  setSelectedModel(m.id);
                  setOpenModel(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs text-slate-200">{m.displayName}</span>
                  <span className="mono block truncate text-[10px] text-slate-500">{m.providerId} · {m.contextLength ? `${Math.round(m.contextLength / 1000)}k bağlam` : 'bağlam bilinmiyor'}</span>
                </span>
                <Badge tone={m.freeStatus === 'paid' ? 'warn' : m.freeStatus === 'unknown' ? 'neutral' : 'ok'}>
                  {m.freeStatus === 'paid' ? 'Ücretli' : m.freeStatus === 'unknown' ? '?' : 'Ücretsiz'}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {emergency ? (
          <Button variant="danger" onClick={() => void useAppStore.getState().emergencyResume()}>
            <ShieldCheck size={13} /> Acil durdurmayı kaldır
          </Button>
        ) : (
          <Button variant="danger" onClick={() => void useAppStore.getState().emergencyStop()}>
            <AlertOctagon size={13} /> ACİL DURDUR
          </Button>
        )}

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost relative h-7 px-2" onClick={() => setOpenNotif((v) => !v)}>
            <Bell size={14} />
            {unread > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose" />}
          </button>
          {openNotif && (
            <div className="absolute right-0 top-8 z-30 max-h-96 w-80 animate-slide-in overflow-auto rounded-lg border border-white/10 bg-base-850 p-1 shadow-panel">
              {notifications.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Bildirim yok.</p>}
              {notifications.slice(0, 30).map((n) => (
                <div key={n.id} className="rounded-md px-2 py-1.5 hover:bg-white/5">
                  <p className="text-[11px] font-medium text-slate-200">{n.title}</p>
                  <p className="text-[10px] leading-snug text-slate-400">{n.message}</p>
                </div>
              ))}
              {notifications.length > 0 && (
                <button
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[11px] text-accent-soft hover:bg-white/5"
                  onClick={() => void api('POST /api/notifications/read', { body: { all: true } }).then(() => useAppStore.getState().refreshNotifications())}
                >
                  Tümünü okundu işaretle
                </button>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-ghost h-7 px-2" onClick={() => setPage('settings')} title="Ayarlar">
          <Settings2 size={14} />
        </button>
      </div>
    </header>
  );
}

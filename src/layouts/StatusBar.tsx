/** Alt panel: aktif proje, model, işlem durumu, çalışan görev, bağlantı. */
import React from 'react';
import { CircleDot, FolderOpen, Radio, Server, WifiOff, Zap } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import clsx from 'clsx';

export function StatusBar() {
  const { projects, activeProjectId, models, selectedModelId, tasks, health, ready } = useAppStore();
  const project = projects.find((p) => p.id === activeProjectId);
  const model = models.find((m) => m.id === selectedModelId);
  const running = tasks.filter((t) => t.status === 'running' || t.status === 'planning').length;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-white/5 bg-base-900/80 px-3 text-[10.5px] text-slate-500">
      <span className="flex min-w-0 items-center gap-1"><FolderOpen size={11} /> <span className="truncate">{project ? project.rootPath : 'Proje yok'}</span></span>
      <span className="h-3 w-px bg-white/10" />
      <span className="flex min-w-0 items-center gap-1"><Zap size={11} /> <span className="truncate">{model?.displayName ?? 'Model seçilmedi'}</span></span>
      <span className="h-3 w-px bg-white/10" />
      <span className="flex items-center gap-1"><CircleDot size={11} className={running ? 'text-accent' : 'text-slate-600'} /> {running ? `${running} görev çalışıyor` : 'Boşta'}</span>
      <span className="ml-auto flex items-center gap-3">
        {health?.emergencyStop && <span className="flex items-center gap-1 text-rose"><WifiOff size={11} /> Acil durdurma etkin</span>}
        <span className={clsx('flex items-center gap-1', ready ? 'text-teal' : 'text-amber')}>
          <span className={clsx('h-1.5 w-1.5 rounded-full', ready ? 'bg-teal' : 'bg-amber animate-pulse-soft')} />
          {ready ? 'Yerel servis bağlı' : 'Bağlanıyor…'}
        </span>
        <span className="flex items-center gap-1"><Server size={11} /> {health?.platform ?? '—'}</span>
        <span className="flex items-center gap-1" title={`Uygulama v${health?.version ?? '—'} · Şartname ${health?.specVersion ?? '—'}`}>
          <Radio size={11} /> v{health?.version ?? '—'} · şartname {health?.specVersion ?? '—'}
        </span>
      </span>
    </footer>
  );
}

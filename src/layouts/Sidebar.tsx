/** Sol menü — şartname §4'teki 14 bölüm. */
import React from 'react';
import {
  Bot, Boxes, BrainCircuit, Clock, Code2, Container, FileText, FolderTree, FlaskConical, Globe, History,
  MessageSquare, HelpCircle, Settings, TerminalSquare, LayoutGrid,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore, type PageId } from '../stores/useAppStore';

const ITEMS: Array<{ id: PageId; label: string; icon: React.ElementType }> = [
  { id: 'chat', label: 'Sohbet', icon: MessageSquare },
  { id: 'projects', label: 'Projeler', icon: LayoutGrid },
  { id: 'files', label: 'Dosyalar', icon: FolderTree },
  { id: 'models', label: 'Yapay Zekâ Modelleri', icon: BrainCircuit },
  { id: 'agents', label: 'Ajan Merkezi', icon: Bot },
  { id: 'tasks', label: 'Görevler', icon: Boxes },
  { id: 'browser', label: 'Tarayıcı', icon: Globe },
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
  { id: 'docker', label: 'Docker', icon: Container },
  { id: 'editor', label: 'Kod Editörü', icon: Code2 },
  { id: 'tests', label: 'Test Merkezi', icon: FlaskConical },
  { id: 'history', label: 'Geçmiş', icon: History },
  { id: 'settings', label: 'Ayarlar', icon: Settings },
  { id: 'help', label: 'Yardım', icon: HelpCircle },
];

export function Sidebar() {
  const { page, setPage, approvals, tasks, health } = useAppStore();
  const runningTasks = tasks.filter((t) => t.status === 'running' || t.status === 'planning').length;

  return (
    <nav className="flex w-[212px] shrink-0 flex-col border-r border-white/5 bg-base-900/60">
      <div className="flex-1 overflow-y-auto p-2">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPage(id)} className={clsx('nav-item', page === id && 'nav-item-active')}>
            <Icon size={15} className="shrink-0 opacity-90" />
            <span className="truncate">{label}</span>
            {id === 'agents' && approvals.length > 0 && (
              <span className="ml-auto rounded-full bg-amber/20 px-1.5 text-[10px] font-semibold text-amber">{approvals.length}</span>
            )}
            {id === 'tasks' && runningTasks > 0 && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-accent/20 px-1.5 text-[10px] font-semibold text-accent-soft">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
                {runningTasks}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-white/5 p-2.5">
        <div className="rounded-lg border border-white/5 bg-base-950/50 p-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            <FileText size={11} /> Sistem
          </p>
          <div className="mt-1.5 space-y-1 text-[10px] text-slate-400">
            <p className="flex justify-between"><span>Durum</span><span className={health?.emergencyStop ? 'text-rose' : 'text-teal'}>{health?.emergencyStop ? 'Durduruldu' : 'Hazır'}</span></p>
            <p className="flex justify-between"><span>Uygulama</span><span className="mono">v{health?.version ?? '—'}</span></p>
            <p className="flex justify-between"><span>Şartname</span><span className="mono">{health?.specVersion ?? '—'}</span></p>
            <p className="flex justify-between"><span>Modeller</span><span className="mono">{useAppStore.getState().models.length}</span></p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-600">
          <Clock size={10} /> Tüm veriler bu bilgisayarda saklanır.
        </p>
      </div>
    </nav>
  );
}

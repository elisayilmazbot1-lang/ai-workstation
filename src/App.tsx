/** Uygulama kabuğu: sayfa yönlendirme, olay akışı, bildirimler. */
import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { TitleBar } from './layouts/TitleBar';
import { Sidebar } from './layouts/Sidebar';
import { RightRail } from './layouts/RightRail';
import { StatusBar } from './layouts/StatusBar';
import { useAppStore } from './stores/useAppStore';
import { subscribeEvents } from './services/api';
import { ChatPage } from './pages/ChatPage';
import { ModelsPage } from './pages/ModelsPage';
import { AgentsPage } from './pages/AgentsPage';
import { TasksPage } from './pages/TasksPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { FilesPage } from './pages/FilesPage';
import { TerminalPage } from './pages/TerminalPage';
import { DockerPage } from './pages/DockerPage';
import { BrowserPage } from './pages/BrowserPage';
import { EditorPage } from './pages/EditorPage';
import { TestsPage } from './pages/TestsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { HelpPage } from './pages/HelpPage';
import type { AppEventBusPayload } from './types';

export default function App() {
  const { page, init, ready, error, handleEvent, toasts, dismissToast } = useAppStore();

  useEffect(() => {
    void init();
    const unsubscribe = subscribeEvents((event) => handleEvent(event as AppEventBusPayload));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acil durdurma kısayolu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'Escape' || e.key === 'Esc')) {
        e.preventDefault();
        void useAppStore.getState().emergencyStop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderPage = () => {
    switch (page) {
      case 'chat': return <ChatPage />;
      case 'models': return <ModelsPage />;
      case 'agents': return <AgentsPage />;
      case 'tasks': return <TasksPage />;
      case 'projects': return <ProjectsPage />;
      case 'files': return <FilesPage />;
      case 'terminal': return <TerminalPage />;
      case 'docker': return <DockerPage />;
      case 'browser': return <BrowserPage />;
      case 'editor': return <EditorPage />;
      case 'tests': return <TestsPage />;
      case 'settings': return <SettingsPage />;
      case 'history': return <HistoryPage />;
      case 'help': return <HelpPage />;
      default: return <ChatPage />;
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden text-slate-200">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden p-2">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-rose/30 bg-rose/[0.05] p-6 text-center">
              <XCircle size={26} className="text-rose" />
              <p className="text-sm font-medium text-rose">Yerel servise bağlanılamadı</p>
              <p className="max-w-lg text-xs leading-relaxed text-slate-400">{error}</p>
              <p className="max-w-lg text-[11px] leading-relaxed text-slate-500">
                Uygulama normalde yerel servisi kendisi başlatır. Geliştirme ortamında <span className="kbd">npm run dev</span> komutunun çalıştığından emin olun.
              </p>
            </div>
          ) : !ready ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 animate-pulse-soft rounded-full bg-accent" /> Yerel servise bağlanılıyor…
              </div>
            </div>
          ) : (
            <div className="h-full animate-slide-in">{renderPage()}</div>
          )}
        </main>
        <RightRail />
      </div>
      <StatusBar />

      {/* Bildirimler */}
      <div className="pointer-events-none fixed bottom-9 right-4 z-50 flex w-80 flex-col gap-1.5">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-slide-in items-start gap-2 rounded-lg border border-white/10 bg-base-850/95 p-2.5 shadow-panel backdrop-blur">
            {t.kind === 'success' ? <CheckCircle2 size={14} className="mt-0.5 text-teal" />
              : t.kind === 'error' ? <XCircle size={14} className="mt-0.5 text-rose" />
              : t.kind === 'warning' ? <AlertTriangle size={14} className="mt-0.5 text-amber" />
              : <Info size={14} className="mt-0.5 text-accent-soft" />}
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium text-slate-200">{t.title}</p>
              {t.message && <p className="text-[10.5px] leading-snug text-slate-400">{t.message}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

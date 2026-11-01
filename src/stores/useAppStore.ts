/** Uygulama genel durumu (Zustand). */
import { create } from 'zustand';
import { api } from '../services/api';
import type { AppSettings } from '@shared/types/app';
import type { ModelRecord, ProviderRecord } from '@shared/types/models';
import type { ProjectRecord } from '@shared/types/projects';
import type { ApprovalRequest, TaskRecord } from '@shared/types/agents';
import type { AppNotification } from '@shared/types/app';
import type { AppEventBusPayload } from '../types';

export type PageId =
  | 'chat'
  | 'projects'
  | 'files'
  | 'models'
  | 'agents'
  | 'tasks'
  | 'browser'
  | 'terminal'
  | 'docker'
  | 'editor'
  | 'tests'
  | 'history'
  | 'settings'
  | 'help';

interface AppState {
  page: PageId;
  ready: boolean;
  error?: string;
  health?: { version: string; specVersion: string; platform: string; emergencyStop: boolean; modules: Record<string, { ready: boolean; message?: string }>; uptimeSec: number };
  providers: ProviderRecord[];
  models: ModelRecord[];
  projects: ProjectRecord[];
  activeProjectId?: string;
  tasks: TaskRecord[];
  approvals: ApprovalRequest[];
  notifications: AppNotification[];
  settings?: AppSettings;
  selectedModelId?: string;
  activeThreadId?: string;
  toasts: Array<{ id: string; kind: 'info' | 'success' | 'warning' | 'error'; title: string; message?: string }>;
  liveTask?: { taskId: string; status: string; progress: number; title: string };
  agentActivity: Array<{ id: string; role: string; status: string; model?: string; taskId: string; at: number }>;

  init: () => Promise<void>;
  setPage: (page: PageId) => void;
  setActiveProject: (id?: string) => void;
  setSelectedModel: (id?: string) => void;
  setActiveThread: (id?: string) => void;
  refreshProviders: () => Promise<void>;
  refreshModels: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshApprovals: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  toast: (kind: 'info' | 'success' | 'warning' | 'error', title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  handleEvent: (event: AppEventBusPayload) => void;
  emergencyStop: () => Promise<void>;
  emergencyResume: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  page: 'chat',
  ready: false,
  providers: [],
  models: [],
  projects: [],
  tasks: [],
  approvals: [],
  notifications: [],
  toasts: [],
  agentActivity: [],

  init: async () => {
    try {
      const health = await api('GET /api/health');
      set({ health, ready: true, error: undefined });
      await Promise.all([get().refreshProviders(), get().refreshModels(), get().refreshProjects(), get().refreshTasks(), get().refreshApprovals(), get().refreshNotifications()]);
      const settings = await api('GET /api/settings');
      set({ settings, selectedModelId: settings.ai.defaultModelId ?? get().models[0]?.id });
    } catch (err) {
      set({ ready: false, error: (err as Error).message });
    }
  },

  setPage: (page) => set({ page }),
  setActiveProject: (id) => set({ activeProjectId: id }),
  setSelectedModel: (id) => set({ selectedModelId: id }),
  setActiveThread: (id) => set({ activeThreadId: id }),

  refreshProviders: async () => set({ providers: await api('GET /api/providers') }),
  refreshModels: async () => set({ models: await api('GET /api/models') }),
  refreshProjects: async () => {
    const projects = await api('GET /api/projects');
    set({ projects, activeProjectId: get().activeProjectId ?? projects[0]?.id });
  },
  refreshTasks: async () => set({ tasks: await api('GET /api/tasks') }),
  refreshApprovals: async () => set({ approvals: await api('GET /api/approvals', { query: { status: 'pending' } }) }),
  refreshNotifications: async () => set({ notifications: await api('GET /api/notifications') }),

  saveSettings: async (patch) => {
    const settings = await api('PATCH /api/settings', { body: patch });
    set({ settings });
    get().toast('success', 'Ayarlar kaydedildi');
  },

  toast: (kind, title, message) => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, kind, title, message }] });
    setTimeout(() => get().dismissToast(id), 6000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  handleEvent: (event) => {
    const anyEvent = event as { type?: string };
    if (anyEvent.type === 'task.updated') {
      const e = event as Extract<AppEventBusPayload, { type: 'task.updated' }>;
      set({ liveTask: { taskId: e.taskId, status: e.status, progress: e.progress, title: e.title } });
      void get().refreshTasks();
    } else if (anyEvent.type === 'approval.created' || anyEvent.type === 'approval.decided') {
      void get().refreshApprovals();
      if (anyEvent.type === 'approval.created') {
        const e = event as Extract<AppEventBusPayload, { type: 'approval.created' }>;
        get().toast('warning', 'Onay bekliyor', e.title);
      }
    } else if (anyEvent.type === 'notification') {
      const e = event as Extract<AppEventBusPayload, { type: 'notification' }>;
      get().toast(e.kind as 'info', e.title, e.message);
      void get().refreshNotifications();
    } else if (anyEvent.type === 'agent.run') {
      const e = event as Extract<AppEventBusPayload, { type: 'agent.run' }>;
      set({
        agentActivity: [
          { id: `${e.runId}-${Date.now()}`, role: e.role, status: e.status, model: e.model, taskId: e.taskId, at: Date.now() },
          ...get().agentActivity,
        ].slice(0, 40),
      });
    } else if (anyEvent.type === 'emergency') {
      const e = event as Extract<AppEventBusPayload, { type: 'emergency' }>;
      void (async () => {
        const health = await api('GET /api/health');
        set({ health });
        get().toast(e.stopped ? 'warning' : 'success', e.stopped ? 'Acil durdurma etkin' : 'Sistem yeniden çalışıyor');
      })();
    }
  },

  emergencyStop: async () => {
    const result = await api('POST /api/emergency-stop');
    const health = await api('GET /api/health');
    set({ health });
    get().toast('warning', 'Acil durdurma', `${result.affected} görev durduruldu.`);
  },

  emergencyResume: async () => {
    await api('POST /api/emergency-resume');
    const health = await api('GET /api/health');
    set({ health });
    get().toast('success', 'Acil durdurma kaldırıldı');
  },
}));

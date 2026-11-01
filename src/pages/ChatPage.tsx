/**
 * Sohbet sayfası — tek ekrandan tüm sistemin yönetimi (şartname §2.2).
 *
 * Mesaj başında "/görev" yazılırsa ajan orkestratörü çalışır ve canlı
 * ilerleme aynı akışta gösterilir. Aksi hâlde seçili modelle doğrudan sohbet.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUp, Bot, CheckCircle2, Circle, Loader2, MessageSquarePlus, Mic, MicOff, Paperclip, Square, Sparkles, Trash2, User, Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api, streamChat, subscribeEvents } from '../services/api';
import { Badge, Button, EmptyState, Spinner, formatTime } from '../components/ui';
import { useVoice } from '../hooks/useVoice';
import type { ChatThread, ChatThreadMessage } from '@shared/types/app';
import { AGENT_ROLE_LABELS, TASK_STATUS_LABELS, type AgentRole } from '@shared/types/agents';
import clsx from 'clsx';

interface StreamState {
  active: boolean;
  text: string;
  error?: string;
  controller?: AbortController;
}

export function ChatPage() {
  const { selectedModelId, models, activeProjectId, setPage, settings } = useAppStore();
  const voice = useVoice({
    enabled: Boolean(settings?.voice.enabled),
    language: settings?.voice.language ?? 'tr-TR',
  });
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [input, setInput] = useState('');
  const [stream, setStream] = useState<StreamState>({ active: false, text: '' });
  const [liveTask, setLiveTask] = useState<{ taskId: string; status: string; progress: number; messages: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const model = models.find((m) => m.id === selectedModelId);

  const loadThreads = async () => {
    const list = await api('GET /api/threads');
    setThreads(list);
    if (!activeThreadId && list[0]) setActiveThreadId(list[0].id);
  };

  useEffect(() => {
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    void api('GET /api/threads/:id/messages', { params: { id: activeThreadId } }).then(setMessages);
  }, [activeThreadId]);

  // Canlı görev olaylarını dinle.
  useEffect(() => {
    return subscribeEvents((raw) => {
      const event = raw as { type: string; [k: string]: unknown };
      if (event.type === 'task.updated') {
        setLiveTask((prev) => ({
          taskId: String(event.taskId),
          status: String(event.status),
          progress: Number(event.progress),
          messages: prev && prev.taskId === event.taskId ? prev.messages : [],
        }));
      } else if (event.type === 'task.log') {
        setLiveTask((prev) => ({
          taskId: String(event.taskId),
          status: prev?.status ?? 'running',
          progress: prev?.progress ?? 0,
          messages: [...(prev?.messages ?? []), String(event.message)].slice(-40),
        }));
      } else if (event.type === 'task.step') {
        setLiveTask((prev) => ({
          taskId: String(event.taskId),
          status: prev?.status ?? 'running',
          progress: prev?.progress ?? 0,
          messages: [...(prev?.messages ?? []), `[${AGENT_ROLE_LABELS[event.role as AgentRole] ?? event.role}] ${event.title} → ${event.status}`].slice(-40),
        }));
      }
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, stream.text, liveTask?.messages.length]);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const ensureThread = async (): Promise<string> => {
    if (activeThreadId) return activeThreadId;
    const thread = await api('POST /api/threads', { body: { projectId: activeProjectId, modelId: selectedModelId } });
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    return thread.id;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!selectedModelId) {
      useAppStore.getState().toast('warning', 'Model seçilmedi', 'Üst çubuktan bir model seçin veya Model Merkezi\'nden sağlayıcı ekleyin.');
      return;
    }
    setInput('');
    setBusy(true);

    // ---- Görev modu ----
    const isTaskCommand = /^\/(görev|gorev|task)\b/i.test(text) || /^\/(analiz|test)\b/i.test(text);
    if (isTaskCommand) {
      const description = text.replace(/^\/[a-zğüşıöç]+\s*/i, '').trim() || text;
      const kind = /^\/test\b/i.test(text) ? 'run-tests' : /^\/analiz\b/i.test(text) ? 'analyze-project' : undefined;
      const threadId = await ensureThread();
      const task = await api('POST /api/tasks', {
        body: {
          title: description.slice(0, 80),
          description,
          projectId: activeProjectId,
          kind: kind as never,
          autoStart: true,
        },
      });
      setLiveTask({ taskId: task.id, status: task.status, progress: 0, messages: [] });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, threadId, role: 'user', content: text, createdAt: new Date().toISOString() },
      ]);
      useAppStore.getState().toast('info', 'Görev başlatıldı', task.title);
      setBusy(false);
      return;
    }

    // ---- Sohbet modu ----
    const threadId = await ensureThread();
    const userMessage: ChatThreadMessage = {
      id: `local-${Date.now()}`,
      threadId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const controller = new AbortController();
    setStream({ active: true, text: '', controller });

    try {
      await streamChat(
        { modelId: selectedModelId, messages: [...history, { role: 'user', content: text }], threadId, temperature: 0.2 },
        (event) => {
          if (event.type === 'delta') setStream((s) => ({ ...s, text: s.text + String(event.text ?? '') }));
          if (event.type === 'final') {
            void api('GET /api/threads/:id/messages', { params: { id: threadId } }).then(setMessages);
          }
          if (event.type === 'error') {
            setStream((s) => ({ ...s, error: String((event.error as { message?: string })?.message ?? 'Akış hatası') }));
          }
        },
        controller.signal,
      );
    } catch (err) {
      setStream((s) => ({ ...s, error: (err as Error).message }));
    } finally {
      setStream({ active: false, text: '' });
      setBusy(false);
      void loadThreads();
    }
  };

  const newThread = async () => {
    const thread = await api('POST /api/threads', { body: { projectId: activeProjectId, modelId: selectedModelId } });
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setMessages([]);
  };

  const deleteThread = async (id: string) => {
    await api('DELETE /api/threads/:id', { params: { id } });
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(undefined);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-full min-h-0 gap-2">
      {/* Sohbet listesi */}
      <div className="panel flex w-[220px] shrink-0 flex-col">
        <div className="panel-header">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Sohbetler</h2>
          <Button variant="ghost" onClick={() => void newThread()} title="Yeni sohbet"><MessageSquarePlus size={14} /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {threads.map((t) => (
            <div key={t.id} className={clsx('group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/5', t.id === activeThreadId && 'bg-accent/10')}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setActiveThreadId(t.id)}>
                <p className="truncate text-[11.5px] text-slate-200">{t.title}</p>
                <p className="text-[9.5px] text-slate-500">{t.messageCount} mesaj · {formatTime(t.updatedAt)}</p>
              </button>
              <button className="opacity-0 transition group-hover:opacity-100" onClick={() => void deleteThread(t.id)} title="Sil">
                <Trash2 size={12} className="text-slate-500 hover:text-rose" />
              </button>
            </div>
          ))}
          {threads.length === 0 && <p className="px-2 py-3 text-[11px] text-slate-500">Henüz sohbet yok.</p>}
        </div>
      </div>

      {/* Ana sohbet */}
      <div className="panel flex min-w-0 flex-1 flex-col">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-accent-soft" />
            <h2 className="text-[12px] font-semibold text-slate-200">Sohbet</h2>
            {model ? <Badge tone={model.freeStatus === 'paid' ? 'warn' : 'info'}>{model.displayName}</Badge> : <Badge tone="warn">Model seçilmedi</Badge>}
          </div>
          <p className="text-[10px] text-slate-500">Görev için: <span className="kbd">/görev …</span></p>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 && !liveTask && (
            <EmptyState
              icon={<Sparkles size={22} />}
              title="Ne yapmak istersiniz?"
              description='Örnek: "Bu projeyi baştan sona analiz et", "/görev Bu uygulamaya yeni bir özellik ekle", "Dosyalardaki bütün hataları bul".'
            />
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onSpeak={() => voice.speak(m.content)} speaking={voice.speaking} />
          ))}
          {stream.active && (
            <div className="flex gap-2">
              <Avatar role="assistant" />
              <div className="min-w-0 flex-1 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-200">
                  {stream.text || <span className="animate-pulse-soft text-slate-500">model yanıt hazırlıyor…</span>}
                </p>
              </div>
            </div>
          )}
          {stream.error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/10 p-2.5 text-[11.5px] text-rose">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{stream.error}</span>
            </div>
          )}
          {liveTask && <LiveTaskCard liveTask={liveTask} onOpenTasks={() => setPage('tasks')} />}
        </div>

        <div className="border-t border-white/5 p-2">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={selectedModelId ? 'Mesajınızı yazın… (Enter ile gönder, Shift+Enter yeni satır)' : 'Önce bir model seçin'}
              className="input max-h-40 min-h-[44px] resize-none text-[12.5px]"
            />
            <div className="flex flex-col gap-1">
              {stream.active ? (
                <Button variant="danger" onClick={() => stream.controller?.abort()}><Square size={12} /> Durdur</Button>
              ) : (
                <Button variant="primary" onClick={() => void send()} disabled={busy || !input.trim()}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />} Gönder
                </Button>
              )}
              <div className="flex gap-1">
                <Button
                  variant={voice.listening ? 'danger' : 'default'}
                  title={settings?.voice.enabled ? 'Sesli mesaj (mikrofon)' : 'Sesli iletişim kapalı — Ayarlar → Ses'}
                  disabled={!settings?.voice.enabled}
                  onClick={() => (voice.listening ? voice.stop() : voice.start((text) => setInput((prev) => `${prev}${prev ? ' ' : ''}${text}`)))}
                >
                  {voice.listening ? <MicOff size={13} /> : <Mic size={13} />}
                </Button>
                <Button variant="ghost" title="Dosya ekleme yakında" disabled><Paperclip size={13} /></Button>
              </div>
            </div>
          </div>
          {(voice.interim || voice.error) && (
            <p className={clsx('mt-1 text-[10px]', voice.error ? 'text-rose' : 'text-accent-soft')}>
              {voice.error ?? `Dinleniyor: ${voice.interim}`}
            </p>
          )}
          <p className="mt-1 text-[9.5px] text-slate-600">
            Yanıtlar doğrulanmamış olabilir. Kod değişiklikleri ve komutlar onayınız olmadan uygulanmaz.
          </p>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  return (
    <div className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-md', role === 'user' ? 'bg-white/10 text-slate-300' : 'bg-accent/20 text-accent-soft')}>
      {role === 'user' ? <User size={13} /> : <Bot size={13} />}
    </div>
  );
}

function MessageBubble({ message, onSpeak, speaking }: { message: ChatThreadMessage; onSpeak: () => void; speaking: boolean }) {
  const isUser = message.role === 'user';
  return (
    <div className="flex animate-slide-in gap-2">
      <Avatar role={isUser ? 'user' : 'assistant'} />
      <div className={clsx('min-w-0 flex-1 rounded-lg border px-3 py-2', isUser ? 'border-white/10 bg-white/[0.06]' : 'border-white/5 bg-white/[0.03]')}>
        <div className="mb-1 flex items-center gap-2 text-[9.5px] text-slate-500">
          <span>{isUser ? 'Siz' : 'Asistan'}</span>
          {message.modelId && <span className="mono">{message.modelId}</span>}
          {message.status === 'cancelled' && (
            <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[9px] font-medium text-amber" title="Bu yanıt iptal edildi">
              İptal edildi
            </span>
          )}
          {message.status === 'failed' && !message.error && (
            <span className="rounded bg-rose/15 px-1.5 py-0.5 text-[9px] font-medium text-rose">Hata</span>
          )}
          <button className="ml-auto mr-1 text-slate-600 hover:text-accent-soft" onClick={onSpeak} title="Sesli oku">
            {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        {message.status === 'cancelled' ? (
          <>
            {message.content && (
              <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-400">{message.content}</p>
            )}
            <p className="mt-1 text-[11px] italic text-amber">
              Yanıt iptal edildi{message.cancelReason === 'emergency-stop' ? ' (acil durdurma)' : ''} — tamamlanmadı.
            </p>
          </>
        ) : message.error ? (
          <p className="text-[12px] text-rose">{message.error}</p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-200">{message.content}</p>
        )}
        {message.usage && (message.usage.inputTokens > 0 || message.usage.outputTokens > 0) && (
          <p className="mono mt-1 text-[9.5px] text-slate-600">
            {message.usage.inputTokens}↓ {message.usage.outputTokens}↑ · ${message.usage.costUsd.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}

function LiveTaskCard({ liveTask, onOpenTasks }: { liveTask: { taskId: string; status: string; progress: number; messages: string[] }; onOpenTasks: () => void }) {
  const done = ['completed', 'failed', 'cancelled'].includes(liveTask.status);
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.06] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        {done ? <CheckCircle2 size={14} className={liveTask.status === 'completed' ? 'text-teal' : 'text-rose'} /> : <Spinner label="" />}
        <p className="text-[12px] font-medium text-slate-200">Ajan görevi</p>
        <Badge tone={liveTask.status === 'completed' ? 'ok' : liveTask.status === 'failed' ? 'danger' : 'info'}>
          {TASK_STATUS_LABELS[liveTask.status as keyof typeof TASK_STATUS_LABELS] ?? liveTask.status}
        </Badge>
        <span className="mono ml-auto text-[10px] text-slate-400">{liveTask.progress}%</span>
      </div>
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent transition-all" style={{ width: `${liveTask.progress}%` }} />
      </div>
      <ul className="max-h-32 space-y-0.5 overflow-y-auto">
        {liveTask.messages.map((m, i) => (
          <li key={i} className="flex gap-1.5 text-[10.5px] text-slate-400">
            <Circle size={5} className="mt-1.5 shrink-0 fill-current opacity-60" />
            <span>{m}</span>
          </li>
        ))}
      </ul>
      <button className="mt-1.5 text-[10.5px] text-accent-soft hover:underline" onClick={onOpenTasks}>Görev detayını aç →</button>
    </div>
  );
}

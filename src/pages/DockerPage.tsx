/** Docker: durum, container ve image listeleri, loglar, compose. */
import React, { useEffect, useState } from 'react';
import { Boxes, Container, Play, RefreshCw, ScrollText, Square, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Panel, formatBytes, formatDateTime } from '../components/ui';
import type { DockerContainer, DockerImage, DockerStatus } from '@shared/types/runtime';

export function DockerPage() {
  const { activeProjectId, projects, toast } = useAppStore();
  const [status, setStatus] = useState<DockerStatus | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [composeOutput, setComposeOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const project = projects.find((p) => p.id === activeProjectId);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await api('GET /api/docker/status');
      setStatus(s);
      if (s.available) {
        setContainers(await api('GET /api/docker/containers'));
        setImages(await api('GET /api/docker/images'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const action = async (id: string, act: 'start' | 'stop' | 'restart' | 'remove') => {
    const result = await api('POST /api/docker/containers/:id/:action', { params: { id, action: act }, body: {} });
    if (!result.ok) {
      toast('warning', 'Onay gerekiyor', result.message);
    } else {
      toast('success', 'Tamamlandı', result.message);
    }
    await refresh();
  };

  const showLogs = async (id: string) => {
    try {
      const data = await api('GET /api/docker/containers/:id/logs', { params: { id }, query: { tail: '200' } });
      setLogs(`--- ${id} ---\n${data.logs}`);
    } catch (err) {
      toast('error', 'Log alınamadı', (err as Error).message);
    }
  };

  const compose = async (act: 'up' | 'down' | 'ps') => {
    if (!activeProjectId) {
      toast('warning', 'Proje seçilmedi', 'Compose komutları proje kökünde çalıştırılır.');
      return;
    }
    const result = await api('POST /api/docker/compose/:action', { params: { action: act }, body: { projectId: activeProjectId } });
    setComposeOutput(`${act}: çıkış ${result.exitCode ?? '—'}\n${result.stdout}\n${result.stderr}`);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[1fr_360px]">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel
          title={<span className="flex items-center gap-1.5"><Container size={13} /> Docker durumu</span>}
          actions={<Button loading={loading} onClick={() => void refresh()}><RefreshCw size={12} /> Yenile</Button>}
          className="shrink-0"
        >
          {status ? (
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              <Badge tone={status.available ? 'ok' : 'danger'}>{status.available ? 'Bağlı' : 'Bağlantı yok'}</Badge>
              {status.version && <span className="mono text-slate-400">Motor v{status.version} · API {status.apiVersion}</span>}
              {status.os && <span className="text-slate-500">{status.os}</span>}
              {status.available && (
                <>
                  <Badge tone="info">{status.containers} container</Badge>
                  <Badge tone="info">{status.running} çalışıyor</Badge>
                  <Badge tone="info">{status.images} image</Badge>
                </>
              )}
              <span className="ml-auto text-[10px] text-slate-500">{formatDateTime(status.checkedAt)}</span>
              <p className="w-full text-[10.5px] text-slate-500">{status.message}</p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">Docker durumu alınıyor…</p>
          )}
        </Panel>

        <Panel title={`Container'lar (${containers.length})`} className="min-h-0 flex-1">
          {!status?.available ? (
            <EmptyState
              icon={<Container size={20} />}
              title="Docker kullanılamıyor"
              description="Docker ayrı bir yazılım olarak kurulmalıdır. AI Workstation Docker'ı yeniden uygulamaz; Docker Desktop (WSL2 arka ucu önerilir) kurulup çalıştığında bu bölüm otomatik etkinleşir."
            />
          ) : containers.length === 0 ? (
            <EmptyState title="Container yok" description="Docker çalışıyor ancak kayıtlı container bulunmuyor." />
          ) : (
            <div className="space-y-1.5">
              {containers.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-slate-200">{c.name}</p>
                    <p className="mono truncate text-[9.5px] text-slate-500">{c.image} · {c.id} {c.ports.length ? `· ${c.ports.join(' ')}` : ''}</p>
                  </div>
                  <Badge tone={c.state === 'running' ? 'ok' : c.state === 'exited' ? 'neutral' : 'warn'}>{c.state}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" title="Loglar" onClick={() => void showLogs(c.id)}><ScrollText size={11} /></Button>
                    {c.state !== 'running' ? (
                      <Button variant="ghost" title="Başlat" onClick={() => void action(c.id, 'start')}><Play size={11} /></Button>
                    ) : (
                      <Button variant="ghost" title="Durdur" onClick={() => void action(c.id, 'stop')}><Square size={11} /></Button>
                    )}
                    <Button variant="ghost" title="Yeniden başlat" onClick={() => void action(c.id, 'restart')}><RefreshCw size={11} /></Button>
                    <Button variant="ghost" title="Sil" onClick={() => void action(c.id, 'remove')}><Trash2 size={11} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Image'lar" className="max-h-48 min-h-0 shrink-0">
          {images.length === 0 ? (
            <p className="text-[11px] text-slate-500">Image yok veya Docker kapalı.</p>
          ) : (
            <div className="space-y-1">
              {images.slice(0, 40).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 rounded border border-white/5 px-2 py-1 text-[10.5px]">
                  <span className="mono truncate text-slate-300">{i.tags[0] ?? `<${i.id}>`}</span>
                  <span className="text-slate-500">{formatBytes(i.size)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Docker Compose" className="shrink-0">
          <p className="mb-1.5 text-[10.5px] text-slate-500">Komutlar {project ? project.name : 'proje seçilmedi'} kökünde çalışır.</p>
          <div className="flex flex-wrap gap-1">
            <Button onClick={() => void compose('up')}><Play size={11} /> up -d</Button>
            <Button onClick={() => void compose('down')}><Square size={11} /> down</Button>
            <Button onClick={() => void compose('ps')}><Boxes size={11} /> ps</Button>
          </div>
          {composeOutput && <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-white/5 bg-base-950/70 p-2 font-mono text-[10px] text-slate-300">{composeOutput}</pre>}
        </Panel>

        <Panel title="Loglar" className="min-h-0 flex-1">
          {logs ? (
            <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-300">{logs}</pre>
          ) : (
            <p className="text-[11px] text-slate-500">Container seçip log simgesine basın.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

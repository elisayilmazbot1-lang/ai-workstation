/** Projeler: klasör ekleme, son projeler, proje bazlı istatistik. */
import React, { useState } from 'react';
import { FolderPlus, FolderOpen, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Button, EmptyState, Field, Panel, formatDateTime } from '../components/ui';

export function ProjectsPage() {
  const { projects, refreshProjects, activeProjectId, setActiveProject, setPage, toast } = useAppStore();
  const [path, setPath] = useState('');
  const [name, setName] = useState('');

  const add = async () => {
    if (!path.trim()) return;
    try {
      const project = await api('POST /api/projects', { body: { rootPath: path.trim(), name: name.trim() || undefined } });
      await refreshProjects();
      setActiveProject(project.id);
      setPath('');
      setName('');
      toast('success', 'Proje eklendi', project.name);
    } catch (err) {
      toast('error', 'Proje eklenemedi', (err as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Projeyi listeden kaldırmak istiyor musunuz? Disk üzerindeki dosyalar silinmez.')) return;
    await api('DELETE /api/projects/:id', { params: { id } });
    await refreshProjects();
    toast('info', 'Proje listeden kaldırıldı');
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 xl:grid-cols-[1fr_360px]">
      <Panel title={<span className="flex items-center gap-1.5"><FolderOpen size={13} /> Projeler ({projects.length})</span>} className="min-h-0">
        {projects.length === 0 ? (
          <EmptyState icon={<FolderPlus size={22} />} title="Henüz proje yok" description="Sağdaki alandan bilgisayarınızdaki bir proje klasörünün yolunu girerek başlayın." />
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id} className={`rounded-lg border p-2.5 ${p.id === activeProjectId ? 'border-accent/40 bg-accent/[0.06]' : 'border-white/5 bg-white/[0.02]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-100">{p.name}</p>
                    <p className="mono truncate text-[10px] text-slate-500">{p.rootPath}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {p.taskCount} görev · eklendi {formatDateTime(p.createdAt)} · son açılış {formatDateTime(p.lastOpenedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant={p.id === activeProjectId ? 'primary' : 'default'} onClick={() => { setActiveProject(p.id); toast('success', 'Aktif proje', p.name); }}>
                      {p.id === activeProjectId ? 'Aktif' : 'Seç'}
                    </Button>
                    <Button variant="ghost" onClick={() => { setActiveProject(p.id); setPage('files'); }} title="Dosyalar"><FolderOpen size={12} /></Button>
                    <Button variant="ghost" onClick={() => void remove(p.id)} title="Kaldır"><Trash2 size={12} /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Yeni proje ekle" className="min-h-0">
        <div className="space-y-2">
          <Field label="Proje klasörü (tam yol)" hint="Örnek: C:\\Projeler\\benim-uygulamam veya /home/kullanici/projeler/uygulama">
            <input className="input" placeholder="C:\\Projeler\\…" value={path} onChange={(e) => setPath(e.target.value)} />
          </Field>
          <Field label="Görünen ad (opsiyonel)">
            <input className="input" placeholder="Klasör adı kullanılır" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button variant="primary" onClick={() => void add()} disabled={!path.trim()}><FolderPlus size={12} /> Projeyi ekle</Button>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 text-[10.5px] leading-relaxed text-slate-500">
            <p className="mb-1 font-medium text-slate-400">Güvenlik notu</p>
            Ajanlar yalnızca bu klasörün içinde çalışır. Proje dışına erişim denemeleri engellenir ve denetim günlüğüne yazılır.
            Dosyalarınız asla dışarıya yüklenmez; yalnızca seçtiğiniz model sağlayıcısına bağlam gönderilir ve gizli dosyalar (.env, anahtarlar) bağlamdan çıkarılır.
          </div>
        </div>
      </Panel>
    </div>
  );
}

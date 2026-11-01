/** Küçük, tekrar kullanılabilir arayüz bileşenleri. */
import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { FREE_STATUS_LABEL_TR, LINK_TYPE_LABEL_TR } from '@shared/constants';
import type { ModelRecord } from '@shared/types/models';

export function Panel({ title, actions, children, className, bodyClassName }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={clsx('panel flex min-h-0 flex-col', className)}>
      {title !== undefined && (
        <header className="panel-header">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
          {actions}
        </header>
      )}
      <div className={clsx('min-h-0 flex-1 overflow-auto p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Button({
  children,
  variant = 'default',
  size = 'sm',
  loading,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx('btn', variant === 'primary' && 'btn-primary', variant === 'danger' && 'btn-danger', variant === 'ghost' && 'btn-ghost', size === 'md' && 'px-3 py-2 text-[13px]', className)}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'violet'; children: React.ReactNode; title?: string }) {
  const tones: Record<string, string> = {
    neutral: 'border-white/15 bg-white/5 text-slate-300',
    ok: 'border-teal/40 bg-teal/10 text-teal',
    warn: 'border-amber/40 bg-amber/10 text-amber',
    danger: 'border-rose/40 bg-rose/10 text-rose',
    info: 'border-accent/40 bg-accent/10 text-accent-soft',
    violet: 'border-violet/40 bg-violet/10 text-violet',
  };
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium', tones[tone])}>
      {children}
    </span>
  );
}

/**
 * Ücretsiz/ücretli etiketi (şartname §5.4).
 * Doğrulanmamış hiçbir model "ücretsiz" gösterilmez.
 */
export function FreeBadge({ model }: { model: Pick<ModelRecord, 'freeStatus' | 'linkType'> }) {
  if (model.freeStatus === 'free') return <Badge tone="ok" title={LINK_TYPE_LABEL_TR[model.linkType]}>Ücretsiz</Badge>;
  if (model.freeStatus === 'free-tier') return <Badge tone="ok" title={model.linkType === 'free-api' ? LINK_TYPE_LABEL_TR[model.linkType] : 'Sağlayıcı ücretsiz kota sunuyor'}>Ücretsiz kota</Badge>;
  if (model.freeStatus === 'paid') return <Badge tone="warn">Ücretli</Badge>;
  return <Badge tone="neutral" title="Ücretsiz olduğu doğrulanmadı">Doğrulanmadı</Badge>;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 p-6 text-center">
      {icon && <div className="text-slate-500">{icon}</div>}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="max-w-md text-xs leading-relaxed text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div>
        <p className="text-xs text-slate-200">{label}</p>
        {hint && <p className="text-[10px] leading-snug text-slate-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-5 w-9 shrink-0 rounded-full border transition', checked ? 'border-accent/50 bg-accent/40' : 'border-white/10 bg-base-800')}
      >
        <span className={clsx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', checked ? 'left-[19px]' : 'left-[2px]')} />
      </button>
    </div>
  );
}

export function ProgressBar({ value, tone = 'info' }: { value: number; tone?: 'info' | 'ok' | 'danger' | 'warn' }) {
  const colors: Record<string, string> = { info: 'bg-accent', ok: 'bg-teal', danger: 'bg-rose', warn: 'bg-amber' };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={clsx('h-full rounded-full transition-all duration-300', colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function freeLabel(status: string): string {
  return FREE_STATUS_LABEL_TR[status] ?? status;
}

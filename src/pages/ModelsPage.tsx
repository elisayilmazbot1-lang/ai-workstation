/**
 * Model Merkezi (şartname §5 ve §2-A).
 * Sağlayıcı ekleme, bağlantı testi, katalog senkronizasyonu, filtreleme,
 * ücretsiz/ücretli ayrımı ve maliyet şeffaflığı.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Check, Cpu, KeyRound, Plus, RefreshCw, Search, Trash2, Wifi, WifiOff, X, Zap } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Badge, Button, EmptyState, Field, FreeBadge, Panel, Spinner, formatDateTime } from '../components/ui';
import { LINK_TYPE_LABEL_TR } from '@shared/constants';
import type { ModelRecord, ProviderHealth, ProviderRecord } from '@shared/types/models';
import type { ProviderKind } from '@shared/types/models';
import clsx from 'clsx';

const PROVIDER_KINDS: Array<{ kind: ProviderKind; label: string; hint: string }> = [
  { kind: 'google', label: 'Google Gemini', hint: 'AI Studio anahtarı — ücretsiz kota sunar' },
  { kind: 'openrouter', label: 'OpenRouter', hint: 'Çoklu model yönlendirici — ":free" modeller ücretsiz' },
  { kind: 'groq', label: 'Groq', hint: 'Ücretsiz katman, çok hızlı yanıt' },
  { kind: 'mistral', label: 'Mistral', hint: 'Bazı modellerde ücretsiz deneme katmanı' },
  { kind: 'huggingface', label: 'Hugging Face', hint: 'Inference Providers — ücretsiz kotalı' },
  { kind: 'openai', label: 'OpenAI', hint: 'Ücretli (kullanım başına)' },
  { kind: 'anthropic', label: 'Anthropic', hint: 'Ücretli (kullanım başına)' },
  { kind: 'xai', label: 'xAI (Grok)', hint: 'Ücretli' },
  { kind: 'deepseek', label: 'DeepSeek', hint: 'Düşük maliyetli' },
  { kind: 'ollama', label: 'Ollama (yerel)', hint: 'Yerel çalışır, donanım kullanır' },
  { kind: 'lmstudio', label: 'LM Studio (yerel)', hint: 'Yerel çalışır, donanım kullanır' },
  { kind: 'custom-openai', label: 'Özel OpenAI uyumlu', hint: 'Kendi uç noktanız' },
];

const CAPABILITIES = ['coding', 'reasoning', 'research', 'vision', 'tools', 'long-context', 'fast', 'general'];
const CAPABILITY_TR: Record<string, string> = {
  coding: 'Kodlama', reasoning: 'Akıl yürütme', research: 'Araştırma', vision: 'Görsel', tools: 'Araç kullanımı',
  'long-context': 'Uzun bağlam', fast: 'Hızlı yanıt', general: 'Genel',
};

export function ModelsPage() {
  const { providers, models, refreshProviders, refreshModels, selectedModelId, setSelectedModel, toast } = useAppStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [capability, setCapability] = useState<string | undefined>();
  const [sort, setSort] = useState<'name' | 'cost' | 'context'>('name');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ kind: ProviderKind; name: string; apiKey: string; baseUrl: string }>({ kind: 'google', name: 'Google Gemini', apiKey: '', baseUrl: '' });
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [testing, setTesting] = useState<string | undefined>();
  const [syncing, setSyncing] = useState<string | undefined>();

  const filtered = useMemo(() => {
    let list = [...models];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.displayName.toLowerCase().includes(q) || m.modelKey.toLowerCase().includes(q) || m.providerId.includes(q));
    }
    if (filter === 'free') list = list.filter((m) => m.freeStatus === 'free' || m.freeStatus === 'free-tier');
    if (filter === 'paid') list = list.filter((m) => m.freeStatus === 'paid');
    if (capability) list = list.filter((m) => m.capabilities.includes(capability as never));
    if (sort === 'cost') list.sort((a, b) => a.pricing.inputPerMillionUsd - b.pricing.inputPerMillionUsd);
    else if (sort === 'context') list.sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0));
    else list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    return list;
  }, [models, search, filter, capability, sort]);

  const addProvider = async () => {
    try {
      await api('POST /api/providers', {
        body: { kind: form.kind, name: form.name || form.kind, apiKey: form.apiKey || undefined, baseUrl: form.baseUrl || undefined },
      });
      await refreshProviders();
      await refreshModels();
      setAdding(false);
      setForm({ kind: 'google', name: 'Google Gemini', apiKey: '', baseUrl: '' });
      toast('success', 'Sağlayıcı eklendi', 'Bağlantıyı test edip model kataloğunu güncelleyin.');
    } catch (err) {
      toast('error', 'Sağlayıcı eklenemedi', (err as Error).message);
    }
  };

  const testProvider = async (id: string) => {
    setTesting(id);
    try {
      const result = await api('POST /api/providers/:id/test', { params: { id } });
      setHealth((prev) => ({ ...prev, [id]: result }));
      toast(result.availability === 'available' ? 'success' : 'error', result.availability === 'available' ? 'Bağlantı başarılı' : 'Bağlantı başarısız', result.message);
    } finally {
      setTesting(undefined);
      await refreshProviders();
    }
  };

  const syncProvider = async (id: string) => {
    setSyncing(id);
    try {
      const result = await api('POST /api/providers/:id/sync-models', { params: { id } });
      await refreshModels();
      toast('success', 'Katalog güncellendi', `${result.added} yeni, ${result.updated} güncellendi.`);
    } catch (err) {
      toast('error', 'Katalog alınamadı', (err as Error).message);
    } finally {
      setSyncing(undefined);
    }
  };

  const deleteProvider = async (id: string) => {
    await api('DELETE /api/providers/:id', { params: { id } });
    await refreshProviders();
    await refreshModels();
    toast('info', 'Sağlayıcı silindi');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Panel
        title={<span className="flex items-center gap-1.5"><BrainCircuit size={13} /> Sağlayıcılar ({providers.length})</span>}
        actions={
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => void api('POST /api/models/refresh').then(async (r) => { await refreshModels(); toast('success', 'Katalog yenilendi', `${r.updated} kayıt güncellendi.`); })}>
              <RefreshCw size={12} /> Tümünü yenile
            </Button>
            <Button variant="primary" onClick={() => setAdding((v) => !v)}><Plus size={12} /> Sağlayıcı ekle</Button>
          </div>
        }
        className="max-h-[46%] shrink-0"
      >
        {adding && (
          <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-accent/25 bg-accent/5 p-2.5 md:grid-cols-4">
            <Field label="Sağlayıcı">
              <select className="input" value={form.kind} onChange={(e) => {
                const kind = e.target.value as ProviderKind;
                const preset = PROVIDER_KINDS.find((p) => p.kind === kind);
                setForm((f) => ({ ...f, kind, name: preset?.label ?? kind }));
              }}>
                {PROVIDER_KINDS.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Görünen ad"><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="API anahtarı (opsiyonel)" hint="Anahtar yalnızca şifreli kasada saklanır, arayüze geri gönderilmez.">
              <input className="input" type="password" autoComplete="off" placeholder="sk-… veya AIza…" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
            </Field>
            <Field label="Uç nokta (opsiyonel)">
              <input className="input" placeholder="https://…" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} />
            </Field>
            <div className="col-span-full flex items-center justify-between">
              <p className="text-[10px] text-slate-500">{PROVIDER_KINDS.find((p) => p.kind === form.kind)?.hint}</p>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setAdding(false)}>Vazgeç</Button>
                <Button variant="primary" onClick={() => void addProvider()}><Check size={12} /> Ekle</Button>
              </div>
            </div>
          </div>
        )}

        {providers.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={20} />}
            title="Henüz sağlayıcı eklenmedi"
            description="Başlamak için ücretsiz katman sunan bir sağlayıcı seçin (Google Gemini, OpenRouter, Groq). API anahtarı yalnızca cihazınızda şifreli saklanır."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                health={health[p.id]}
                testing={testing === p.id}
                syncing={syncing === p.id}
                onTest={() => void testProvider(p.id)}
                onSync={() => void syncProvider(p.id)}
                onDelete={() => void deleteProvider(p.id)}
                onAddKey={async (key) => {
                  await api('PATCH /api/providers/:id', { params: { id: p.id }, body: { apiKey: key } });
                  await refreshProviders();
                  toast('success', 'Anahtar kaydedildi');
                }}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={<span className="flex items-center gap-1.5"><Cpu size={13} /> Model kataloğu ({filtered.length}/{models.length})</span>}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-2 text-slate-500" />
              <input className="input w-44 pl-6" placeholder="Model ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">Tümü</option>
              <option value="free">Ücretsiz</option>
              <option value="paid">Ücretli</option>
            </select>
            <select className="input w-auto" value={capability ?? ''} onChange={(e) => setCapability(e.target.value || undefined)}>
              <option value="">Tüm yetenekler</option>
              {CAPABILITIES.map((c) => <option key={c} value={c}>{CAPABILITY_TR[c]}</option>)}
            </select>
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="name">Ada göre</option>
              <option value="cost">Maliyete göre</option>
              <option value="context">Bağlama göre</option>
            </select>
          </div>
        }
        className="min-h-0 flex-1"
      >
        {filtered.length === 0 ? (
          <EmptyState icon={<Zap size={20} />} title="Kriterlere uyan model yok" description="Filtreleri değiştirin veya sağlayıcı kataloğunu yenileyin." />
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((m) => <ModelCard key={m.id} model={m} selected={m.id === selectedModelId} onSelect={() => { setSelectedModel(m.id); toast('success', 'Model seçildi', m.displayName); }} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ProviderCard({
  provider, health, testing, syncing, onTest, onSync, onDelete, onAddKey,
}: {
  provider: ProviderRecord; health?: ProviderHealth; testing: boolean; syncing: boolean;
  onTest: () => void; onSync: () => void; onDelete: () => void; onAddKey: (key: string) => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const ok = health?.availability === 'available' || provider.lastTestOk;
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-slate-100">
            <span className="truncate">{provider.name}</span>
            {provider.offersFreeTier && <Badge tone="ok">ücretsiz katman</Badge>}
          </p>
          <p className="mono truncate text-[10px] text-slate-500">{provider.kind} · {provider.baseUrl ?? 'varsayılan uç nokta'}</p>
        </div>
        <div className="flex items-center gap-1">
          {provider.lastTestOk === undefined ? <Badge tone="neutral">test edilmedi</Badge> : ok ? <Badge tone="ok"><Wifi size={9} /> bağlı</Badge> : <Badge tone="danger"><WifiOff size={9} /> hata</Badge>}
          <button className="text-slate-500 hover:text-rose" onClick={onDelete} title="Sil"><Trash2 size={12} /></button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge tone={provider.hasCredential ? 'ok' : provider.authKind === 'none-local' ? 'info' : 'warn'}>
          <KeyRound size={9} /> {provider.hasCredential ? 'anahtar kayıtlı' : provider.authKind === 'none-local' ? 'anahtar gerekmez' : 'anahtar yok'}
        </Badge>
        {provider.lastTestAt && <span className="text-[9.5px] text-slate-500">son test: {formatDateTime(provider.lastTestAt)}</span>}
        {provider.lastTestLatencyMs !== undefined && <span className="mono text-[9.5px] text-slate-500">{provider.lastTestLatencyMs} ms</span>}
      </div>

      {provider.lastTestMessage && !ok && <p className="mt-1 rounded border border-rose/20 bg-rose/5 px-1.5 py-1 text-[10px] text-rose">{provider.lastTestMessage}</p>}

      {!provider.hasCredential && provider.authKind !== 'none-local' && (
        <div className="mt-1.5 flex gap-1">
          <input
            className="input flex-1 py-1 text-[11px]"
            type={showKey ? 'text' : 'password'}
            placeholder="API anahtarı"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <Button variant="ghost" onClick={() => setShowKey((v) => !v)} title="Göster/gizle">{showKey ? <X size={12} /> : <KeyRound size={12} />}</Button>
          <Button variant="primary" disabled={!key.trim()} onClick={() => void onAddKey(key).then(() => setKey(''))}>Kaydet</Button>
        </div>
      )}

      <div className="mt-2 flex gap-1">
        <Button className="flex-1" loading={testing} onClick={onTest}><Wifi size={11} /> Bağlantıyı test et</Button>
        <Button className="flex-1" loading={syncing} onClick={onSync}><RefreshCw size={11} /> Kataloğu çek</Button>
      </div>
    </div>
  );
}

function ModelCard({ model, selected, onSelect }: { model: ModelRecord; selected: boolean; onSelect: () => void }) {
  return (
    <div className={clsx('rounded-lg border p-2.5 transition', selected ? 'border-accent/50 bg-accent/[0.07]' : 'border-white/5 bg-white/[0.03] hover:border-white/15')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-slate-100">{model.displayName}</p>
          <p className="mono truncate text-[10px] text-slate-500">{model.modelKey}</p>
        </div>
        <FreeBadge model={model} />
      </div>
      {model.description && <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-slate-400">{model.description}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {model.contextLength && <span className="chip">{Math.round(model.contextLength / 1000)}k bağlam</span>}
        {model.capabilities.filter((c) => c !== 'vision').slice(0, 4).map((c) => <span key={c} className="chip">{CAPABILITY_TR[c] ?? c}</span>)}
        {model.supportsVision && <span className="chip">Görsel</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="mono text-[10px] text-slate-500">
            {model.pricing.inputPerMillionUsd === 0 && model.pricing.outputPerMillionUsd === 0
              ? 'Ücretsiz katman'
              : `$${model.pricing.inputPerMillionUsd} girdi / $${model.pricing.outputPerMillionUsd} çıktı · 1M token`}
          </p>
          <p className="text-[9px] text-slate-600">{LINK_TYPE_LABEL_TR[model.linkType]}{model.freeStatus === 'unknown' ? ' · ücretsizliği doğrulanmadı' : ''}</p>
        </div>
        <Button variant={selected ? 'primary' : 'default'} onClick={onSelect}>{selected ? 'Seçili' : 'Seç'}</Button>
      </div>
    </div>
  );
}

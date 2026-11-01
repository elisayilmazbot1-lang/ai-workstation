/** Ayarlar — şartname §24'teki tüm bölümler. */
import React, { useEffect, useState } from 'react';
import { Download, Save, Shield, Upload, Volume2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { api } from '../services/api';
import { Button, Field, Panel, Toggle } from '../components/ui';
import type { AppSettings } from '@shared/types/app';

export function SettingsPage() {
  const { settings, saveSettings, models, toast } = useAppStore();
  const [draft, setDraft] = useState<AppSettings | undefined>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!draft) return <Panel title="Ayarlar"><p className="text-xs text-slate-400">Yükleniyor…</p></Panel>;

  const patch = <K extends keyof AppSettings>(section: K, value: Partial<AppSettings[K]>) =>
    setDraft({ ...draft, [section]: { ...draft[section], ...value } });

  const save = async () => {
    await saveSettings(draft);
  };

  const exportBackup = async () => {
    const result = await api('POST /api/backup/export', { body: { includeSecrets: false } });
    toast('success', 'Yedek oluşturuldu', `${result.path} (${result.bytes} bayt, sha256: ${result.checksum.slice(0, 12)}…)`);
  };

  const importBackup = async () => {
    const path = window.prompt('Yedek dosyasının tam yolu:');
    if (!path) return;
    try {
      const result = await api('POST /api/backup/import', { body: { path } });
      toast('success', 'Yedek geri yüklendi', `${result.tables} tablo`);
    } catch (err) {
      toast('error', 'Geri yüklenemedi', (err as Error).message);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-200">Ayarlar</h2>
        <div className="flex gap-1">
          <Button onClick={() => void exportBackup()}><Download size={12} /> Yedek al</Button>
          <Button onClick={() => void importBackup()}><Upload size={12} /> Yedeği geri yükle</Button>
          <Button variant="primary" onClick={() => void save()}><Save size={12} /> Kaydet</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Genel">
          <Field label="Dil"><input className="input" value="Türkçe" disabled /></Field>
          <Field label="Tema">
            <select className="input" value={draft.general.theme} onChange={(e) => patch('general', { theme: e.target.value as AppSettings['general']['theme'] })}>
              <option value="dark">Koyu (önerilen)</option>
              <option value="light">Açık</option>
              <option value="system">Sistem</option>
            </select>
          </Field>
          <Toggle checked={draft.general.notifications} onChange={(v) => patch('general', { notifications: v })} label="Bildirimleri göster" />
          <Toggle checked={draft.general.startMinimized} onChange={(v) => patch('general', { startMinimized: v })} label="Simge durumunda başlat" />
        </Panel>

        <Panel title="Yapay zekâ">
          <Field label="Varsayılan model">
            <select className="input" value={draft.ai.defaultModelId ?? ''} onChange={(e) => patch('ai', { defaultModelId: e.target.value || undefined })}>
              <option value="">— otomatik —</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </Field>
          <Field label="Yedek model" hint="Birincil model hata verdiğinde kullanılır.">
            <select className="input" value={draft.ai.fallbackModelId ?? ''} onChange={(e) => patch('ai', { fallbackModelId: e.target.value || undefined })}>
              <option value="">— yok —</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </Field>
          <Toggle checked={draft.ai.preferFreeModels} onChange={(v) => patch('ai', { preferFreeModels: v })} label="Ücretsiz modelleri öncele" hint="Otomatik seçimde ücretsiz/ücretsiz kotası olan modeller öncelenir." />
          <Field label="İstek zaman aşımı (ms)">
            <input type="number" className="input" value={draft.ai.requestTimeoutMs} onChange={(e) => patch('ai', { requestTimeoutMs: Number(e.target.value) })} />
          </Field>
        </Panel>

        <Panel title="Ajanlar">
          <Field label="Eşzamanlı görev sınırı">
            <input type="number" min={1} max={8} className="input" value={draft.agents.maxParallelTasks} onChange={(e) => patch('agents', { maxParallelTasks: Number(e.target.value) })} />
          </Field>
          <Field label="Otomatik onay" hint="Kritik riskli işlemler her zaman onay ister.">
            <select className="input" value={draft.agents.autoApproveRisk} onChange={(e) => patch('agents', { autoApproveRisk: e.target.value as AppSettings['agents']['autoApproveRisk'] })}>
              <option value="none">Hiçbir risk otomatik onaylanmasın (önerilen)</option>
              <option value="low">Düşük risk otomatik</option>
              <option value="medium">Orta ve düşük risk otomatik</option>
            </select>
          </Field>
        </Panel>

        <Panel title="Dosyalar">
          <Toggle checked={draft.files.backupBeforeWrite} onChange={(v) => patch('files', { backupBeforeWrite: v })} label="Yazma öncesi yedek al" />
          <Field label="Maksimum dosya boyutu (KB)">
            <input type="number" className="input" value={draft.files.maxFileSizeKb} onChange={(e) => patch('files', { maxFileSizeKb: Number(e.target.value) })} />
          </Field>
        </Panel>

        <Panel title="Terminal">
          <Field label="Varsayılan kabuk">
            <select className="input" value={draft.terminal.defaultShell} onChange={(e) => patch('terminal', { defaultShell: e.target.value as AppSettings['terminal']['defaultShell'] })}>
              <option value="powershell">PowerShell</option>
              <option value="cmd">CMD</option>
              <option value="wsl">WSL</option>
              <option value="git-bash">Git Bash</option>
              <option value="bash">Bash</option>
            </select>
          </Field>
          <Field label="Komut zaman aşımı (ms)">
            <input type="number" className="input" value={draft.terminal.commandTimeoutMs} onChange={(e) => patch('terminal', { commandTimeoutMs: Number(e.target.value) })} />
          </Field>
        </Panel>

        <Panel title="Ses">
          <Toggle checked={draft.voice.enabled} onChange={(v) => patch('voice', { enabled: v })} label="Sesli iletişim" hint="Mikrofon yalnızca açık izinle etkinleşir." />
          <Field label="Konuşma tanıma">
            <select className="input" value={draft.voice.sttProvider} onChange={(e) => patch('voice', { sttProvider: e.target.value as AppSettings['voice']['sttProvider'] })}>
              <option value="webspeech">Tarayıcı/Electron motoru (ücretsiz, yerel)</option>
              {/* DÜZELTME (üçüncü denetim): Bu seçenek daha önce AKTİF görünüyordu
                  ama arkasında kod yoktu — `useVoice` yalnızca `enabled` ve
                  `language` ayarlarını okur, `sttProvider` hiçbir yerde tüketilmez.
                  Kullanıcıyı yanıltmamak için seçenek devre dışı bırakıldı ve
                  nedeni yazıldı. Kayıt: spec/eksikler/E-13 (durum: [EKSİK]). */}
              <option value="whisper-api" disabled>Whisper API — henüz uygulanmadı (E-13)</option>
              <option value="off">Kapalı</option>
            </select>
          </Field>
          <Field label="Sesli yanıt">
            <select className="input" value={draft.voice.ttsProvider} onChange={(e) => patch('voice', { ttsProvider: e.target.value as AppSettings['voice']['ttsProvider'] })}>
              <option value="webspeech">Sistem ses motoru (ücretsiz)</option>
              <option value="off">Kapalı</option>
            </select>
          </Field>
          <Button onClick={() => {
            if (!('speechSynthesis' in window)) return toast('error', 'Ses sentezi desteklenmiyor');
            const u = new SpeechSynthesisUtterance('Merhaba, AI Workstation ses testi başarılı.');
            u.lang = draft.voice.language;
            window.speechSynthesis.speak(u);
          }}><Volume2 size={12} /> Ses testi</Button>
        </Panel>

        <Panel title={<span className="flex items-center gap-1.5"><Shield size={12} /> Güvenlik</span>}>
          <Toggle checked={draft.security.autoApproveLowRisk} onChange={(v) => patch('security', { autoApproveLowRisk: v })} label="Düşük riskli işlemleri otomatik onayla" hint="Yalnızca salt okunur komutlar için önerilir." />
          <div className="mt-1 rounded border border-white/5 bg-white/[0.02] p-2 text-[10.5px] leading-relaxed text-slate-400">
            <p className="mb-1 font-medium text-slate-300">Güvenlik özeti</p>
            API anahtarları DPAPI/AES-256 ile şifreli saklanır ve arayüze gönderilmez. Proje dışına erişim engellenir.
            Dosya yazma, komut, Docker ve form gönderimi işlemleri onay ister. Acil durdurma kısayolu: <span className="kbd">Ctrl+Shift+Escape</span> (uygulama içinde).
          </div>
        </Panel>

        <Panel title="Hakkında">
          <p className="text-[11.5px] leading-relaxed text-slate-400">
            <strong className="text-slate-200">AI WORKSTATION</strong> v1.0 — çoklu model ve çoklu ajan destekli masaüstü yapay zekâ geliştirme istasyonu.
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[10.5px] text-slate-500">
            <li>• Arayüz dili: Türkçe · Tema: Koyu</li>
            <li>• Hedef platform: Windows 10/11 x64 (Electron)</li>
            <li>• Çalışma modeli: bulut modelleri + yerel isteğe bağlı</li>
            <li>• Veriler yalnızca bu cihazda (SQLite + şifreli kasa)</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

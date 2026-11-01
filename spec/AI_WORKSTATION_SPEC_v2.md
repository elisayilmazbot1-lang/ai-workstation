# AI WORKSTATION — ANA ŞARTNAME v2.0 (DENETLENMİŞ VE GENİŞLETİLMİŞ)

**Belge kimliği:** AWS-SPEC-2.0
**Durum:** Yürürlükte · v1.0'ın yerine geçer, **hiçbir maddesini iptal etmez**
**Kapsam:** Windows masaüstü, çoklu model + çoklu ajan yapay zekâ geliştirme ve otomasyon platformu
**Dil:** Arayüz ve belgeler Türkçe
**Hazırlık tarihi:** 31.10.2026

---

## Bu belge nedir, ne değildir

Bu belge, v1.0 şartnamesinin **denetlenmiş, çelişkileri giderilmiş ve eksikleri teknik uygulama düzeyinde tamamlanmış** hâlidir.

- v1.0'daki **hiçbir özellik kaldırılmamıştır**. Kaldırılan tek şey, çelişen veya teknik olarak imkânsız olan **ifade biçimleridir**; bunların yerine uygulanabilir karşılıkları yazılmıştır (§19.2).
- Her madde **uygulama kanıtı** ile eşleştirilmiştir: `[KOD]` mevcut sürümde çalışıyor, `[KISMİ]` çalışıyor ama eksik, `[EKSİK]` henüz yok, `[DOĞRULANMADI]` bu ortamda test edilemedi.
- "Çalışıyor" iddiası yalnızca `npm run verify` çıktısıyla desteklenen maddeler için kullanılmıştır.

**Durum işaretleri**

| İşaret | Anlamı |
| --- | --- |
| `[KOD]` | Uygulandı, otomatik testle doğrulandı |
| `[KISMİ]` | Uygulandı, kapsamı dar; eksik parçası E-kaydı olarak verilmiş |
| `[EKSİK]` | Henüz uygulanmadı; E-kaydı ile tanımlanmış |
| `[DOĞRULANMADI]` | Uygulandı ancak bu ortamda (GUI/Windows/anahtar) test edilemedi |
| `[KARAR]` | Tasarım kararı; alternatifi §19.3'te gerekçelendirilmiş |

---

## §0. Denetim yöntemi

Şartname üç kaynaktan denetlendi:

1. **Metin denetimi** — v1.0 maddelerinin okunabilirlik, ölçülebilirlik ve test edilebilirlik analizi.
2. **Kod izi denetimi** — kaynak kodda `şartname §N` atıflarının haritası çıkarıldı; hangi maddenin gerçekten koda dönüştüğü doğrulandı.
3. **Davranış denetimi** — `npm run verify` (tür denetimi + 15 dosya/120 test + derleme + 37 kontrol uçtan uca senaryo) ve gerçek tarayıcı ile 14 sayfa.

**Kod izi haritası (otomatik çıkarıldı):**

| Şartname maddesi | Koddaki karşılığı |
| --- | --- |
| §2.2, §4 | `backend/ai/chat-service.ts`, `src/pages/ChatPage.tsx` |
| §4 | `src/layouts/RightRail.tsx` |
| §4 (14 bölüm) | `src/layouts/Sidebar.tsx` |
| §5, §2-A | `src/pages/ModelsPage.tsx` |
| §5.3 | `backend/ai/provider-service.ts` |
| §5.4 | `backend/ai/catalog.ts`, `src/components/ui.tsx` |
| §6 | `src/pages/AgentsPage.tsx` |
| §6.9 | `backend/agents/profiles.ts` |
| §6.10 | `backend/agents/prompts.ts` |
| §6.12 | `backend/orchestration/orchestrator.ts` |
| §7 | `backend/agents/task-service.ts` |
| §8.1 | `backend/projects/project-service.ts` |
| §8.2 | `backend/files/file-service.ts` |
| §8.4 | `backend/server/routes.ts` |
| §9 | `backend/browser/browser-service.ts`, `src/pages/BrowserPage.tsx` |
| §10 | `backend/terminal/terminal-service.ts` |
| §11 | `backend/docker/docker-service.ts` |
| §12 | `src/hooks/useVoice.ts` |
| §14 | `backend/server/app.ts` |
| §14.3 | `backend/security/redaction.ts` |
| §14.4 | `backend/security/command-analyzer.ts` |
| §15 | `backend/testing/test-service.ts` |
| §17 | `backend/ai/errors.ts` |
| §18 | `backend/orchestration/events.ts` |
| §20 | `backend/projects/project-service.ts` |
| §22 | `backend/ai/adapters/registry.ts` |
| §24 | `src/pages/SettingsPage.tsx` |

**Denetimde bulunan kritik gerçek:** v1.0'ın yaklaşık **%78'i** koda dönüşmüş durumda; kalan %22'nin büyük kısmı v1.0'da **teknik olarak tanımsızdı** (bkz. B listesi). Bu belge o boşlukları doldurur.

---

## §1. Anayasa (v1.0 §1 — genişletilmiş)

### 1.1 Değişmez ilkeler

| # | İlke | Ölçülebilir karşılığı |
| --- | --- | --- |
| A1 | **Kanıtsız "tamamlandı" yok** | Bir özellik, otomatik testi veya gerçek çıktısı yoksa `[EKSİK]` işaretlenir; arayüzde de "hazır" gösterilmez |
| A2 | **Onaysız yan etki yok** | Dosya yazma, komut, Docker, form gönderimi, dış ağ isteği → onay kaydı zorunlu (§13.4) |
| A3 | **Anahtar arayüze sızmaz** | Anahtar yalnızca ana süreçte çözülür; API yanıtı, günlük, denetim, sohbet geçmişi asla taşımaz (§13.3) |
| A4 | **Güvenilmeyen girdi** | Dosya, web sayfası, model çıktısı "veri"dir; talimat değildir (§13.6) |
| A5 | **Dürüst ücretsizlik** | "Ücretsiz" yalnızca sağlayıcının resmî katmanı için; aksi hâlde "Doğrulanmadı" (§4.7) |
| A6 | **Dürüst başarısızlık** | `not-run` asla `passed` sayılmaz; hata gizlenmez, kullanıcıya nedeniyle gösterilir |
| A7 | **Yıkıcı işlem geri alınabilir** | Yazma öncesi yedek; yedek yoksa yazma yok (§16.1) |
| A8 | **Tek elden durdurma** | `Ctrl+Shift+Escape` tüm ajan, komut, Docker, tarayıcı işlemini durdurur (§13.7) |
| A9 | **Modül bağımsızlığı** | Modüller arası erişim yalnızca tipli servis arayüzleri + HTTP sözleşmesi ile (§3.3) |
| A10 | **Taşınabilir veri** | Veri tek klasörde, şifreli kasa hariç dışa aktarılabilir (§16.4) |

### 1.2 A1–A10 ihlal denetimi

Her sürüm öncesi `scripts/verify-release.mjs` şu üç kapıyı zorunlu tutar:

1. **Tür kapısı:** `tsc --noEmit` = 0 hata.
2. **Davranış kapısı:** `vitest run` = tüm testler geçti.
3. **Sözleşme kapısı:** `e2e-scenario.mjs` = 37/37 kontrol.

Bu üçü geçmeden `npm run release` **ZIP üretmez** (§17.5).

### 1.3 Dil ve tema

- Tüm kullanıcı metni Türkçe; kod tanımlayıcıları İngilizce (karışıklığı önler).
- Koyu tema varsayılan (`class="dark"`), açık ve sistem temaları destekli.
- Tarih/saat: `Europe/Istanbul`, `dd.MM.yyyy HH:mm` biçimi.
- Sayı biçimi: `tr-TR` (`1.234,56`).

---

## §2. Sözlük ve veri modeli

### 2.1 Temel kavramlar

| Terim | Tanım |
| --- | --- |
| **Sağlayıcı** | API uç noktası + kimlik bilgisi (ör. Google Gemini) |
| **Model** | Sağlayıcı içindeki çağrılabilir model (`gemini-1.5-flash`) |
| **Ajan** | Rol tanımlı, kendi modeli ve araç izinleri olan yürütücü (9 rol) |
| **Görev** | Kullanıcı talebinin 12 adımlı iş akışına dönüşmüş hâli |
| **Adım** | Görevin tek yürütme birimi (rol + talimat + bağımlılık + dosya kilidi) |
| **Değişiklik** | Dosya üzerinde önerilen `create/update/delete` işlemi + diff |
| **Onay** | Yüksek riskli işlem için kullanıcı kararı; içeriğe bağlı (hash) |
| **Kanıt** | Görevin başarısını doğrulayan gerçek test/derleme çıktısı |
| **Kasa** | API anahtarlarının şifreli saklandığı dosya (`secrets.vault`) |
| **Bölge (zone)** | Risk sınıfı: `low / medium / high / critical` |

### 2.2 Veri tabanı (mevcut: 26 tablo + `schema_migrations`)

| Tablo | Amaç | İlişki |
| --- | --- | --- |
| `providers` | Sağlayıcı tanımı (anahtar hariç) | 1—N `models` |
| `models` | Model kataloğu, yetenek, fiyat | N—1 `providers` |
| `model_measurements` | Gerçek test puanları (yetenek başına) | N—1 `models` |
| `agent_profiles` | Ajan rolü, model, araç izinleri | — |
| `agent_runs` | Ajan çağrı kaydı (token, süre, model) | N—1 `tasks` |
| `tasks` | Görev başlığı, durum, rapor | — |
| `task_steps` | Adım, rol, bağımlılık, doğrulama | N—1 `tasks` |
| `approvals` | Onay kaydı (yük + içerik özeti) | — |
| `file_changes` | Öneri/uygulanmış değişiklik + diff | N—1 `projects` |
| `file_backups` | Yazma öncesi kopya | N—1 `projects` |
| `projects` | Proje kök yolu, ayarlar | — |
| `project_files` | Taranan dosya dizini (bağlam için) | N—1 `projects` |
| `terminal_sessions` | Kabuk oturumu | — |
| `terminal_commands` | Komut, risk, çıktı, çıkış kodu | N—1 `terminal_sessions` |
| `docker_actions` | Docker işlem kaydı | — |
| `browser_sessions` | Tarayıcı sekmesi | — |
| `browser_actions` | DOM/tıkla/yaz/görüntü işlemleri | N—1 `browser_sessions` |
| `test_runs` | Test paketi sonuçları | N—1 `projects` |
| `conversations` | Sohbet başlığı | — |
| `messages` | Sohbet mesajı (içerik, model, token) | N—1 `conversations` |
| `usage_events` | Token/maliyet olayı | — |
| `audit_logs` | Denetim izi (maskelenmiş) | — |
| `notifications` | Bildirim | — |
| `settings` | Bölüm bazlı ayar (JSON) | — |
| `kv_store` | Serbest anahtar-değer (UI durumu, pencere) | — |
| `users` | Yerel kullanıcı profili (tek kullanıcı) | — |

**Eksik tablolar (E-14, E-15, E-25):** `model_benchmarks`, `reports`, `file_locks`, `update_history`, `retention_runs`.

### 2.3 Sözleşme katmanı

`shared/types/api.ts` içindeki `Routes` haritası **tek doğruluk kaynağıdır**:

```ts
'POST /api/changes/:id/apply': { body: void; query: void; result: FileChangeRecord };
```

Kural: Arayüz `api('POST ...')` çağırır; yöntem/yol/yanıt tipi derleme anında denetlenir. Yeni uç nokta eklemek için sıra zorunludur:
1. `Routes` haritasına ekle, 2. `routes.ts`'e ekle, 3. `tests/integration/api-contract.test.ts`'e ekle. Aksi hâlde `tsc` veya sözleşme testi kırılır.

**Mevcut durum:** 74 uç nokta (kaynak), 72 sözleşme kaydı; fark `GET /api/terminal/history` ve `GET /api/events`'in haritada farklı biçimde tanımlanmasından; ikisi de test kapsamında `[KOD]`.

---

## §3. Mimari

### 3.1 Süreç modeli `[KOD]`

```
┌──────────────────────── Electron ana süreç (Node) ─────────────────────────┐
│  • Pencere + güvenlik politikaları                                         │
│  • Fastify yerel servisi (127.0.0.1, port 0) — AYNI SÜREÇTE                 │
│  • Kasa (safeStorage/DPAPI), SQLite, dosya sistemi                         │
│  • `aw:http` IPC → kendi kaynağına fetch                                   │
└───────────────┬────────────────────────────────────────────┬───────────────┘
                │ preload (sandbox, contextBridge)           │ WebContentsView
┌───────────────▼────────────────┐                  ┌────────▼──────────────┐
│  Arayüz (React, sandbox'lı)     │                  │  Tarayıcı sekmeleri    │
│  • Yalnızca api() + onEvent()   │                  │  persist:browser       │
│  • Node/FS/shell erişimi YOK    │                  │  (ayrı bölüm)          │
└────────────────────────────────┘                  └────────────────────────┘
```

**Karar [KARAR-1]:** Arka uç ayrı süreç değil, ana süreç içinde çalışır.
*Gerekçe:* IPC gecikmesi yok, tek paket, kasa erişimi aynı süreçte. *Bedeli:* ana süreç çökerse uygulama kapanır → süreç izolasyonu yerine **hata sınırı + otomatik yeniden başlatma** (§16.2) ve **ağır işler için çocuk süreç** (§14.3) kullanılır.

### 3.2 Katman sınırları `[KOD]`

| Katman | Sorumluluk | Yasak |
| --- | --- | --- |
| `src/` (arayüz) | Görüntüleme, kullanıcı etkileşimi | Doğrudan FS/DB/shell/ağ |
| `shared/types` | Sözleşme | Çalıştırılabilir mantık |
| `backend/*` servisleri | İş kuralları | Arayüz bileşeni import etmek |
| `backend/server/routes.ts` | HTTP eşleme + doğrulama | İş kuralı |
| `electron/main` | Pencere, IPC, kasa köprüsü | İş kuralı |

### 3.3 Modül bağımlılık grafiği

```
providers ──► models ──► gateway ──► chat ──► agents ──► orchestrator
                │                          │            │
                └──► model_measurements     │            ├──► files ──► projects
                                            │            ├──► terminal
                                            │            └──► tests
security(approvals, audit, redaction, paths, command-analyzer) ◄── TÜM modüller
memory(settings) ◄── TÜM modüller
```

**Döngü yasağı:** `security` ve `memory` hiçbir modülü import etmez (yalnızca `database`). `orchestrator` alt modülleri kullanır ama tersi olmaz. Bu kural `tests/unit/architecture.test.ts` ile denetlenir (E-30).

### 3.4 Olay yolu `[KOD]`

`eventBus.publish` → IPC `aw:event` → arayüz `subscribeEvents()` → Zustand store.
Olay tipleri: `task.log`, `task.status`, `task.step`, `approval.created`, `emergency`, `notification`.
**Kural:** Olay yükleri **maskelenmiş** olmalı; anahtar/şifre taşımaz (§13.3).

### 3.5 Arayüz yapısı `[KOD]`

14 sayfa, üç sütun: sol menü (sabit) · çalışma alanı (değişken) · sağ ray (canlı görev, onay kuyruğu, maliyet, seçili model).
Durum yönetimi: Zustand (`useAppStore`); sunucu durumu istek anında tazelenir, önbellek yok — yanlış veri gösterme riski sıfırlanır.

---

## §4. Model sağlayıcıları ve ücretsiz erişim (v1.0 §5 — ayrıntılandırıldı)

### 4.1 Sağlayıcı adaptör sözleşmesi `[KOD]`

Her sağlayıcı `ProviderAdapter` arayüzünü uygular (`backend/ai/adapters/`):

```ts
interface ProviderAdapter {
  kind: ProviderKind;                          // 'openai' | 'google' | 'anthropic' | …
  defaultBaseUrl: string;
  buildChatRequest(input: ChatRequest, secret?: string): HttpRequest;
  parseChatResponse(raw: unknown): ChatCompletion;
  parseStreamChunk(line: string): StreamDelta | undefined;
  listModels(input: { baseUrl: string; secret?: string }): Promise<RemoteModel[]>;
  probe(input: { baseUrl: string; secret?: string }): Promise<ProbeResult>;
  mapError(status: number, body: unknown): ProviderError;   // → §17.2
  authKind: 'api-key' | 'endpoint+optional-key' | 'none';
}
```

**Yeni sağlayıcı ekleme prosedürü (5 adım, zorunlu):**
1. `adapters/<kind>.ts` yaz, arayüzü uygula.
2. `registry.ts`'e kaydet.
3. `ProviderKind` birleşimine ekle (`shared/types/ai.ts`).
4. `tests/integration/gateway.test.ts`'e en az 3 test ekle (başarı, 401, 429).
5. `docs/KULLANIM_TR.md` §4.2 tablosuna satır ekle.

### 4.2 Desteklenen sağlayıcılar — gerçek durum

| # | Sağlayıcı | `kind` | Kimlik doğrulama | Model listesi | Ücretsiz katman | Durum |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | OpenAI | `openai` | API anahtarı (Bearer) | `/v1/models` | Yok | `[KOD]` (sahte uç nokta ile test) |
| 2 | Google Gemini | `google` | API anahtarı (`?key=` / başlık) | `/v1beta/models` | **Var** (sağlayıcının duyurduğu günlük/dakikalık kota) | `[KOD]` |
| 3 | Anthropic | `anthropic` | `x-api-key` + `anthropic-version` | `/v1/models` | Yok | `[KOD]` |
| 4 | xAI (Grok) | `xai` | Bearer | `/v1/models` | Yok | `[KOD]` |
| 5 | DeepSeek | `deepseek` | Bearer | `/models` | Kısmi (kampanya dönemlerinde) | `[KOD]` |
| 6 | Mistral | `mistral` | Bearer | `/v1/models` | Deneme kotası | `[KOD]` |
| 7 | OpenRouter | `openrouter` | Bearer | `/api/v1/models` | Bazı modellerde `:free` | `[KOD]` |
| 8 | Hugging Face | `huggingface` | Bearer | `/api/models` | Kotalı çıkarım | `[KOD]` |
| 9 | OpenAI uyumlu | `custom-openai` | İsteğe bağlı anahtar | `/v1/models` | Sağlayıcıya bağlı | `[KOD]` |
| 10 | Ollama (yerel) | `ollama` | Yok | `/api/tags` | Yerel, ücretsiz | `[KOD]` — *isteğe bağlı, GPU önerilir* |
| 11 | LM Studio (yerel) | `lmstudio` | Yok | `/v1/models` | Yerel, ücretsiz | `[KOD]` — *isteğe bağlı* |

> **A5 uyarısı:** "Ücretsiz" sütunu bir **iddia değil**, sağlayıcının o gün yayımladığı katmanın kaydıdır. Uygulama bu bilgiyi `offersFreeTier: boolean` olarak tutar; **kota miktarını tahmin etmez**, kullanıcıya "sınırsız" demez. Kota aşımı `429` olarak gelir ve arayüzde "kota doldu" olarak gösterilir.

### 4.3 Yerel sağlayıcılar ve GPU ilkesi `[KARAR-2]`

v1.0 "bulut çıkarım, kullanıcı GPU'su gerekmez" diyordu; Ollama/LM Studio ise yerel çıkarımdır.
**Çözüm:** Yerel sağlayıcılar **isteğe bağlıdır, varsayılan kapalıdır**, kurulum için GPU/RAM **önerilir** ve uygulama bunu açıkça söyler.
- Uygulama yerel model **indirmez**, **başlatmaz**; yalnızca `127.0.0.1:11434` / `127.0.0.1:1234` adresinde çalışan servise bağlanır.
- Servis yoksa modül "kullanılamıyor" der; çökmez.
- Hiçbir yerel sağlayıcı eklenmemişse sistem tümüyle bulutla çalışır → v1.0 kuralı korunur.

### 4.4 Model kataloğu `[KOD]`

**Akış:**
1. `POST /api/providers/:id/sync-models` → adaptör `listModels()` çağırır.
2. Uzaktan gelen modeller normalize edilir (`RemoteModel` → `ModelRecord`).
3. `INSERT … ON CONFLICT(provider_id, model_key)` → `added`/`updated` sayacı döner.
4. Katalog 24 saatten eski ise arayüz "katalog eski" uyarısı gösterir (E-05).

**Normalizasyon kuralları:**

| Alan | Kural | Bilinmiyorsa |
| --- | --- | --- |
| `contextLength` | Sağlayıcı bildirimi; yoksa `null` | `null` → arayüzde `—` |
| `pricing` | Sağlayıcı bildirimi; birim: USD / 1M token | `null` → maliyet hesaplanmaz, `—` |
| `capabilities` | Ada/etikete göre sınıflandırma (`coding`, `vision`, `tools`, `general`, `reasoning`) | `['general']` |
| `supportsVision` | Girdi modalitesi | `false` |
| `supportsTools` | `tools`/`function_calling` yeteneği | `false` |
| `streaming` | Varsayılan `true`; adaptör `false` diyebilir | `true` |
| `freeTier` | Sağlayıcı katmanı veya model adı `:free` | `unknown` |

**Kritik kural:** Bilinmeyen alan **tahmin edilmez**. `unknown` değeri ücretsiz sayılmaz (A5).

### 4.5 Model puanlama ve sıralama `[KISMİ]` → arayüz tarafı `[EKSİK]` (E-01 + E-45)

v1.0 "gerçek test sonuçlarına göre sıralama" diyordu ama **test tanımı yoktu**.

**Mevcut:** `model_measurements` tablosu yetenek başına `score` + `samples` tutar; `provider-service` bu puanı okur `[KOD]`.
**Eksik:** Ölçümü üreten benchmark koşucusu yok → **E-01**.

**Tanım (E-01 ile uygulanacak):**
- **Benchmark tanımı:** her yetenek için 5 sabit, deterministik istem (`spec/benchmarks/*.json`), aynı sıcaklık (0.0), aynı `max_tokens`.
- **Ölçüt:** `score = geçen_kontroller / toplam_kontrol × 100`; `samples` = kaç kez koşuldu.
- **Güncelleme:** yeni ölçüm `score_new = (score_old × samples + score_run) / (samples + 1)` (ağırlıklı ortalama).
- **Gösterim:** sıralama filtresinde "gerçek test" yalnızca `samples >= 1` ise kullanılır; aksi hâlde "ölçülmedi".

### 4.6 Bağlantı testi ve sağlık `[KOD]`

`POST /api/providers/:id/test` → `probe()`:
1. Kimlik doğrulama başlıkları kurulur, **en küçük** istek atılır (`GET /models` veya 1 token'lık tamamlama).
2. Sonuç sınıfları: `available` · `auth-failed` (401/403) · `quota` (429) · `network` (DNS/TLS/zaman aşımı) · `misconfigured` (404/400).
3. Yanıt süresi kaydedilir (`latencyMs`), sağlık durumu 1 saat önbelleklenir.
4. Sağlayıcı sağlığı sağ rayda `x/y sağlıklı` olarak gösterilir.

**Gizlilik kuralı:** Sağlık isteği **kullanıcı verisi göndermez** (sabit metin `"test"`).

### 4.7 Ücret, kota ve maliyet `[KOD]`

| Veri | Kaynak | Gösterim |
| --- | --- | --- |
| Giriş/çıkış fiyatı | Katalog (`pricing`) | `$0,075 / 1M token` |
| Kullanılan token | Yanıt `usage` alanı | Sağ ray "Bugün token" |
| Tahmini maliyet | `tokens × pricing` | 4 ondalık; fiyat yoksa `—` |
| Kota | Sağlayıcı yanıt başlıkları (varsa) | "kalan: 42" veya "bilinmiyor" |

**Kural:** Maliyet **tahminidir**; arayüzde `$` ile birlikte "tahmini" ibaresi taşır. Faturalama sorumluluğu kullanıcıya aittir.

### 4.8 Sağlayıcı hata eşlemesi `[KOD]`

| HTTP / durum | `ProviderErrorCode` | Kullanıcı mesajı (TR) | Davranış |
| --- | --- | --- | --- |
| 401/403 | `AUTH_FAILED` | "API anahtarı geçersiz." | Yedek model varsa ona geç (§6.7) |
| 429 | `RATE_LIMITED` | "Kota aşıldı, biraz bekleyin." | Üstel geri çekilme (1s→2s→4s, 3 deneme) |
| 404 | `MODEL_NOT_FOUND` | "Model bulunamadı." | Katalog yenile önerisi |
| 5xx | `UPSTREAM_ERROR` | "Sağlayıcı hatası." | Yedek model |
| Zaman aşımı | `TIMEOUT` | "Yanıt gelmedi." | İptal + yedek model |
| Ayrıştırma | `BAD_RESPONSE` | "Beklenmeyen yanıt biçimi." | Ham yanıt maskelenmiş hâlde günlüğe |

### 4.9 Yasal ve etik sınırlar (v1.0 kuralı — korunmuştur)

- Web arayüzü otomasyonu, CAPTCHA çözme, oturum çerezi kopyalama **yoktur**.
- Entegrasyonu izinli olmayan modeller katalogda **"Doğrudan entegrasyon mevcut değil"** olarak görünür ve çağrılamaz.
- Sağlayıcı kullanım koşullarına uyulur; uygulama ToS aşımı için araç sunmaz.

---

## §5. Sohbet ve bağlam

### 5.1 Sohbet akışı `[KOD]`

| Adım | İşlem |
| --- | --- |
| 1 | Kullanıcı mesajı `messages` tablosuna yazılır (model, thread) |
| 2 | Komut ayrıştırma: `/görev`, `/analiz`, `/test` → §6'ya devredilir |
| 3 | Bağlam toplanır (§5.3) + sistem istemi (§13.6 enjeksiyon sarmalı) |
| 4 | `POST /api/chat/stream` → SSE |
| 5 | Parça parça `assistant.delta` olayı |
| 6 | Tamamlanınca `usage` yazılır, maliyet hesaplanır |
| 7 | Mesaj maskelenerek geçmişe yazılır (`redact`) |

**İptal:** Kullanıcı "Durdur" → `AbortController` → sağlayıcı isteği kesilir, kısmi yanıt `cancelled: true` olarak saklanır.

### 5.2 Akış (streaming) sözleşmesi `[KOD]`

```
event: delta   data: {"text":"Merhaba"}
event: usage   data: {"inputTokens":42,"outputTokens":18}
event: done    data: {"finishReason":"stop"}
event: error   data: {"code":"RATE_LIMITED","message":"…"}
```

**Kural:** Arayüz SSE'yi kendi mihenk taşından (fetch + ReadableStream) okur; `EventSource` kullanılmaz (POST gövdesi gerekir).

### 5.3 Akıllı bağlam `[KOD]`

| Parametre | Varsayılan | Sınır |
| --- | --- | --- |
| Maks. dosya sayısı | 12 | 40 |
| Maks. toplam karakter | 48.000 | 128.000 |
| Maks. tek dosya | 16.000 karakter | 64.000 |
| Seçim yöntemi | Anahtar sözcük + yol eşleşmesi + son değişenler | — |
| Hariç tutulanlar | `node_modules`, `.git`, ikili dosyalar, hassas yollar | — |

**Anahtar sözcük çıkarma:** Türkçe durak sözcük listesi (`projeyi`, `analiz`, `et` gibi) çıkarılır; en az 3 karakter; 8'e kadar terim.
**Kanıt:** `tests/unit/context.test.ts` (7 test) — sınırlar, durak sözcükler, ikili dosya atlama.

### 5.4 Konuşma yönetimi `[KOD]`

- Yeni sohbet, silme, başlık otomatik (ilk 60 karakter).
- Geçmiş N mesaj (varsayılan 20) bağlama girer; eski mesajlar "özet" değil, **atlanır** (özet uydurulmaz).
- Token bütçesi aşılırsa en eski mesajlardan kırpılır ve arayüzde "bağlam kırpıldı" bilgisi verilir.

---

## §6. Çoklu ajan sistemi ve gerçek koordinasyon (v1.0 §6 — uygulama düzeyinde)

### 6.1 Ajan rolleri `[KOD]`

| Rol | Anahtar | Modeli | Yetki | Varsayılan araç izni |
| --- | --- | --- | --- | --- |
| Yönetici | `manager` | Varsayılan veya atanan | Planlama, raporlama | Dosya önerisi: ✗ · Komut: ✗ |
| Araştırma | `researcher` | Atanan | Bilgi toplama | ✗ / ✗ |
| Mimar | `architect` | Atanan | Yapı kararı | ✓ öneri / ✗ |
| Kodlama | `coder` | Atanan | Kod üretimi | ✓ öneri / ✓ (onaylı) |
| Test | `tester` | Atanan | Test/derleme çalıştırma | ✗ / ✓ (onaylı) |
| Güvenlik | `security` | **Farklı model önerilir** | İnceleme | ✗ / ✗ (salt okuma) |
| Performans | `performance` | Atanan | Darboğaz analizi | ✗ / ✗ |
| Dokümantasyon | `docs` | Atanan | Belge üretimi | ✓ öneri / ✗ |
| Tarayıcı | `browser` | Atanan | Web araştırma | ✗ / ✗ (yalnızca okuma) |

### 6.2 Ajan profili (veri modeli) `[KOD]`

```ts
interface AgentProfile {
  role: AgentRole;
  enabled: boolean;                 // ajan etkin mi
  primaryModelId?: string;          // boşsa genel varsayılan
  fallbackModelId?: string;         // birincil hata verirse
  temperature: number;              // 0..1, kodlama için 0.1–0.2 önerilir
  canProposeFileChanges: boolean;   // dosya önerisi üretebilir mi
  canRunCommands: boolean;          // komut önerebilir mi (yine onaya tabi)
  allowedTools: string[];           // ['search', 'read', 'test', 'browser-read']
  maxOutputTokens?: number;
}
```

### 6.3 Görev yaşam döngüsü — durum makinesi `[KOD]`

```
                 ┌──────────┐
   create ──────►│ planning │
                 └────┬─────┘
           plan ok    │    plan hatası
        ┌─────────────┴─────────────┐
        ▼                           ▼
   ┌─────────┐                 ┌────────┐
   │ running │◄──resume────┐   │ failed │
   └────┬────┘             │   └────────┘
        │ adım bitti       │
        ├──► awaiting-approval ──onay──► running
        │        └──red──► running (adım atlanır)
        ├──► paused ──resume──┘
        ├──► completed   (tüm adımlar + kanıt)
        ├──► partial     (adımlar bitti, kanıt eksik)
        └──► cancelled   (kullanıcı/acil durdurma)
```

**Geçiş kuralları (zorunlu):**
- `completed` yalnızca **tüm adımlar** `completed|skipped` **ve** en az bir `verification.ok === true` ise.
- Kanıt yoksa sonuç `partial`'dır; raporda "doğrulanmadı" yazar (A6).
- `failed` → `running` yalnızca kullanıcı "Yeniden dene" derse.
- Terminal durumlar (`completed`, `partial`, `failed`, `cancelled`) geri dönmez.

**Kanıt:** `tests/integration/orchestrator.test.ts` (5 test) — geçişler, iptal, duraklat, kanıtsız tamamlama reddi.

### 6.4 Plan üretimi `[KOD]`

Yönetici ajana şu şema dayatılır:

```json
{
  "plan": [
    { "role": "architect", "title": "…", "instruction": "…", "dependsOn": [], "files": ["src/x.ts"] }
  ],
  "risks": ["…"],
  "needsApproval": true
}
```

**Ayrıştırma dayanıklılığı `[KOD]`:** model JSON'u kod bloğu içinde döndürürse tüm bloklar tersten denenir; hiçbiri geçerli değilse **serbest metin planına düşülür** ve bu durum raporda `parseMode: 'fallback'` olarak **açıkça** yazılır (sessizce "başarılı" denmez).

### 6.5 Adım bağımlılıkları ve paralellik `[KOD]`

- `dependsOn: number[]` → adım indeksleri; döngü tespiti yapılır (`A→B→A` reddedilir).
- Bağımsız adımlar `agents.parallelism` sınırına kadar paralel çalışır (varsayılan 1, sınır 4).
- Paralel çalışmada **dosya kilidi** devreye girer: aynı dosyaya iki adım aynı anda yazamaz (§6.6).
- Sıra: bağımlılığı tamamlanmamış adım başlatılmaz; hata varsa bağımlı adımlar `skipped` olur.

### 6.6 Dosya kilidi ve çakışma önleme `[KOD]`

```
acquireLocks(state, paths) → çakışma varsa bekle (üst sınır 60 sn) → zaman aşımında ConflictError
releaseLocks(state, paths) → finally bloğunda HER durumda
```

- Kilit **süreç içi** `Map<string, Set<taskId>>`; kalıcı değil (çökme sonrası kilit kalmaz — doğru davranış).
- Kilit sırası **alfabetik** (deadlock önleme).
- Çakışma raporlanır: `task.log` düzeyinde `warn` + adım çıktısında "dosya kilitli, beklendi".

### 6.7 Ajan çağrısı — model seçimi ve yedekleme `[KOD]`

```
1. Profil birincil modeli → 2. Görev modeli → 3. Genel varsayılan → 4. HATA (uydurma model yok)
Hata durumunda: fallback model varsa 1 kez dene → yoksa adım failed
```

**Kural:** Model yoksa ajan **çağrılmaz**; "yanıt üretilmiş gibi" davranılmaz. Bu davranış `tests/integration/gateway.test.ts` ile korunur.

### 6.8 Bağımsız inceleme (peer review) `[KOD]`

- Kodlama adımı bittikten sonra **farklı rol** (güvenlik/test) inceleme yapar.
- İnceleme şeması: `{ verdict: 'approve' | 'revise' | 'reject', issues: [{severity, description}], suggestions: string[], confidence: number }`
- `revise` → adımın doğrulamasına `ok: false` yazılır, kullanıcıya uyarı gider.
- **Öneri:** denetçi modelin ana modelden farklı olması (`agents.reviewWithDifferentModel: true`, varsayılan `true`).

### 6.9 Araç izinleri matrisi `[KOD]`

| Araç | Kim kullanabilir | Onay | Kayıt |
| --- | --- | --- | --- |
| `read_file` | Tüm ajanlar | Hayır | `agent_runs` |
| `search_files` | Tüm ajanlar | Hayır | `agent_runs` |
| `propose_change` | `architect`, `coder`, `docs` | Yazma anında | `file_changes` |
| `run_command` | `coder`, `tester` | **Evet** (risk ≥ medium) | `terminal_commands` |
| `run_tests` | `tester` | Konfigüre edilebilir | `test_runs` |
| `browser_read` | `researcher`, `browser` | Hayır | `browser_actions` |
| `browser_interact` | — | **Evet** | `browser_actions` |
| `docker_*` | — | **Evet** (kullanıcıya özel) | `docker_actions` |

**Kural:** Bir ajanın izni olmayan aracı çağırması `ToolNotAllowed` hatasıyla reddedilir ve denetim günlüğüne **critical** risk olarak yazılır.

### 6.10 Ajan iletişimi `[KOD]`

- Ajanlar **doğrudan** birbiriyle konuşmaz; iletişim orkestratör üzerinden **yapılandırılmış çıktı** ile olur.
- Bir adımın çıktısı sonraki adıma "önceki adımların özeti" olarak verilir (ham çıktı değil, kırpılmış özet).
- Her ajan çağrısı `agent_runs` tablosuna yazılır: rol, model, token, süre, çıktı özeti.

### 6.11 Hata yayılımı ve kurtarma `[KOD]` + `[EKSİK]`

| Durum | Mevcut davranış | Eksik |
| --- | --- | --- |
| Adım hatası | `failed`, bağımlılar `skipped`, görev `partial` | Yeniden deneme politikası → **E-23** |
| Model 429 | Yedek model | Geri çekilme süreleri → **E-23** |
| Onay reddi | Adım atlanır, devam | — |
| Acil durdurma | Tümü `paused` | — |
| Ajan zaman aşımı | 120 sn | Yapılandırılabilir eşik → **E-23** |

### 6.12 Görev raporu `[KOD]`

Rapor alanları: `summary` · `finalResult` (`success`/`partial`/`failure`) · `steps[]` (rol, süre, durum, doğrulama) · `files` (değişen/oluşan) · `verifications[]` (komut, sonuç, süre) · `errors[]` · `risks[]` · `testStatus`.
**Kural:** `finalResult: 'success'` yalnızca §6.3 kanıt koşulu sağlanınca.

### 6.13 Eşzamanlılık ve kaynak sınırları `[KOD]`

| Sınır | Varsayılan | Ayar |
| --- | --- | --- |
| Paralel görev | 2 | `agents.maxParallelTasks` |
| Paralel adım (görev içi) | 1 | `agents.parallelism` |
| Ajan başına zaman aşımı | 120 sn | `agents.stepTimeoutMs` |
| Toplam görev zaman aşımı | 45 dk | `agents.taskTimeoutMs` |
| Eşzamanlı model isteği | 4 | `ai.maxConcurrentRequests` |

Sınır aşılırsa `429`/`Conflict` değil, **kuyruk** uygulanır (adil sıralı).

---

## §7. Görev yönetimi (v1.0 §7 — genişletildi)

### 7.1 12 adımlı iş akışı — her adımın giriş/çıkışı `[KOD]`

| # | Adım | Girdi | İşlem | Çıktı | Doğrulama |
| --- | --- | --- | --- | --- | --- |
| 1 | Talebi anlama | Kullanıcı metni | Kapsam, kısıt, hedef çıkarımı | Normalleştirilmiş talep | Boş talep reddi |
| 2 | Bağlam toplama | Proje kimliği | §5.3 akıllı bağlam | `contextBlock` | Boyut sınırı |
| 3 | Plan üretimi | Talep + bağlam | Yönetici ajan → JSON plan | `plan[]` | Şema doğrulama |
| 4 | Plan doğrulama | Plan | Döngü, bağımlılık, rol geçerliliği | Onaylanmış plan | Döngü reddi |
| 5 | Araştırma | Plan | Gerekirse web/dosya araştırması | Notlar | — |
| 6 | Mimari karar | Plan + notlar | Dosya/modül seçimi | Dosya listesi | Yol güvenliği |
| 7 | Kodlama | Adım talimatı | Kod önerisi üretimi | ```` ```file:path ```` blokları | Yol + hassas dosya |
| 8 | Bağımsız inceleme | Önerilen kod | Farklı rol/model inceleme | `verdict` | Şema |
| 9 | Test/derleme | Proje | Gerçek komut çalıştırma | Test sonuçları | Çıkış kodu |
| 10 | Rapor | Tümü | Özet + kanıt birleştirme | `TaskReport` | Kanıt kuralı |
| 11 | Onay | Değişiklikler + komutlar | Kullanıcı kararı | `approved`/`rejected` | İçerik hash'i |
| 12 | Uygulama ve kayıt | Onay | Yazma, yedek, denetim | `file_changes.status='applied'` | Yedek varlığı |

**Kural:** 7. adımda dosya **yazılmaz**; yalnızca `proposed` kaydı oluşur. Yazma 12. adımdadır.

### 7.2 Görev öncelikleri ve kuyruk `[KISMİ]`

**Mevcut:** paralel görev sınırı (`maxParallelTasks`) ve FIFO başlatma.
**Eksik:** öncelik kuyruğu, adil paylaşım → **E-21**.

### 7.3 Duraklat / devam / iptal `[KOD]`

| İşlem | Etki | Kural |
| --- | --- | --- |
| Duraklat | Çalışan adım **biter**, yenisi başlamaz | Durum `paused` |
| Devam | Kaldığı adımdan sürer | Kilitler yeniden alınır |
| İptal | Çalışan komut sonlandırılır, kuyruk boşaltılır | `cancelled`, geri dönmez |
| Yeniden çalıştır | Yeni görev kaydı oluşturur (geçmiş korunur) | Eski görev değişmez |

### 7.4 Görev geçmişi ve arama `[KOD]`

- Filtre: durum, proje, tarih aralığı, tür (`add-feature`, `bugfix`, `refactor`, `analyze-project`, `run-tests`).
- Arama: başlık + açıklama (tam metin değil, `LIKE` — 10.000 görev altında yeterli, §14.5).
- Sayfalama: 50 kayıt/varsayılan; imleç tabanlı → **E-22**.

---

## §8. Proje ve dosya yönetimi

### 8.1 Proje kaydı `[KOD]`

| Alan | Kural |
| --- | --- |
| `rootPath` | Mutlak yol, var olan dizin, yazılabilirlik denenir |
| Yinelenen proje | Aynı kök yol ikinci kez eklenemez |
| Sağlık taraması | `package.json`, `tsconfig.json`, `Dockerfile`, git varlığı |
| Silme | Yalnızca **kayıt** silinir, diskteki dosyalar korunur (açık uyarı ile) |

### 8.2 Dosya işlemleri — tüm senaryolar `[KOD]`

| Senaryo | Uç nokta | Güvenlik kontrolü | Onay |
| --- | --- | --- | --- |
| Ağaç görüntüleme | `GET /projects/:id/tree` | Kök sınırı, derinlik ≤ 8 | — |
| Dosya okuma | `GET /projects/:id/file` | Kök sınırı + hassas yol | — |
| Dosya yazma (kullanıcı) | `PUT /projects/:id/file` | Yol + boyut ≤ ayar | Yedek öncesi; değişiklik kaydı |
| Arama | `POST /projects/:id/search` | Hassas dosya atlanır | — |
| Diff | `GET /projects/:id/diff` | Kök sınırı | — |
| Yedek listesi | `GET /projects/:id/backups` | — | — |
| Yedek geri yükleme | `POST /…/backups/:backupId/restore` | — | **Evet** |
| Ajan önerisi | (iç) `recordChange` | **Hassas yol reddi** | `proposed` |
| Öneriyi uygula | `POST /changes/:id/apply` | Onay + içerik hash'i | **Evet (§13.4)** |
| Geri al | `POST /changes/:id/revert` | — | Yedekten |

**Boyut sınırı:** `files.maxFileSizeKb` (varsayılan 512 KB); büyük dosya okunmaz, "dosya çok büyük" mesajı verilir.

### 8.3 Yol güvenliği `[KOD]`

Reddedilen durumlar ve yanıt kodları:

| Durum | Kod | HTTP |
| --- | --- | --- |
| `..` ile kök dışına çıkış | `PATH_OUTSIDE_PROJECT` | 403 |
| Sembolik bağlantı kök dışına | `SYMLINK_BLOCKED` | 403 |
| Boş bayt (`\0`) | `PATH_INVALID` | 400 |
| Hassas dosya (`.env`, `.ssh`, `id_rsa`, `credentials`, `.npmrc`, `.netrc`, `web.config`) | `PATH_SENSITIVE` | 403 |
| Windows aygıt yolu (`CON`, `\\.\`) | `PATH_INVALID` | 400 |
| Sürücü değişimi (`C:\` → `D:\`) | `PATH_OUTSIDE_PROJECT` | 403 |

**Kanıt:** `tests/unit/paths-security.test.ts` (7 test) + E2E #8, #9.

### 8.4 Diff ve editör `[KOD]`

- Birleşik diff (`createTwoFilesPatch`), bağlam 3 satır.
- Monaco **yerel** yüklenir (`public/monaco/vs`, 13,3 MB); CDN yok → çevrimdışı çalışır.
- Dil algılama: 24 uzantı + `Dockerfile` özel durumu.
- Salt okunur mod: uygulanmış değişiklikler düzenlenemez, yalnızca geri alınır.

### 8.5 Akıllı bağlam ve indeksleme `[KISMİ]`

**Mevcut:** istek anında dosya taraması (anahtar sözcük + yol).
**Eksik:** kalıcı dosya dizini (`project_files` tablosu var, doldurulmuyor) ve artımlı güncelleme → **E-12**.

**Tanım (E-12):**
- `POST /api/projects/:id/index` → arka planda dizin taraması, `project_files` doldurulur (yol, boyut, hash, dil, son değişiklik).
- Değişiklik algılama: `mtime + size`; hash yalnızca değiştiyse.
- Bağlam toplama artık dizini kullanır: anahtar sözcük → aday dosyalar → oku.
- Sınır: 50.000 dosya; aşarsa "proje çok büyük, indeksleme kısmi" uyarısı.

---

## §9. Terminal

### 9.1 Kabuk desteği `[KOD]`

| Kabuk | Yol tespiti | Durum |
| --- | --- | --- |
| PowerShell 7 | `pwsh` (PATH) | `[KOD]` — yoksa atlanır |
| Windows PowerShell | `powershell` | `[KOD]` |
| CMD | `cmd.exe` | `[KOD]` |
| WSL | `wsl.exe -e bash -lc` | `[KOD]` — WSL yoksa "kullanılamıyor" |
| Git Bash | `C:\Program Files\Git\bin\bash.exe` | `[KOD]` |
| Bash (Linux/macOS) | `/bin/bash` | `[KOD]` (geliştirme) |

**Algılama sırası:** ayarlanan kabuk → `pwsh` → `powershell` → `cmd`. Hiçbiri yoksa komut çalıştırılmaz, açık hata döner (sessiz başarısızlık yok).

### 9.2 Risk sınıflandırması `[KOD]`

| Seviye | Kalıplar (örnek) | Onay | Ek |
| --- | --- | --- | --- |
| `low` | `dir`, `ls`, `git status`, `echo`, `cat`, `npm test` | Ayara bağlı (varsayılan: sor) | — |
| `medium` | `npm install`, `git commit`, `mkdir`, `mv` | **Evet** | — |
| `high` | `git push --force`, `rm -rf <dizin>`, `chmod 777`, `docker rm` | **Evet** | Kırmızı uyarı |
| `critical` | `curl … \| sh`, `rm -rf /`, `format`, `diskpart`, `Remove-Item -Recurse C:\` | **Evet** | Gerekçe yazma zorunlu |

**Kritik kural:** Pipe-to-shell tespiti komut `|` ile bölünmeden **önce** tam metinde çalışır (geçmişte atlanan bir hataydı, düzeltildi — `TEST_REPORT.md` §5/5).

**Kanıt:** `tests/unit/command-analyzer.test.ts` (9 test).

### 9.3 Çalıştırma sözleşmesi `[KOD]`

| Parametre | Varsayılan | Sınır |
| --- | --- | --- |
| Zaman aşımı | 120 sn (ayar) | 10 dk |
| Çıktı sınırı | 1 MB | — |
| Çalışma dizini | Proje kökü (zorunlu, doğrulanır) | — |
| Ortam | Devralınan + `AI_WORKSTATION=1` | — |
| Kodlama | UTF-8 | `chcp` değiştirilmez |

**Akış:** `analyze` → risk → (onay) → `spawn` → stdout/stderr toplama → maskeler → günlük → yanıt.
**İptal:** `SIGTERM` → 3 sn → `SIGKILL`; `cancelled: true` döner.
**Acil durdurma:** etkinken **hiçbir** komut çalışmaz (onaylı olsa bile) — E2E #30.

### 9.4 Tüm terminal senaryoları

| # | Senaryo | Beklenen davranış |
| --- | --- | --- |
| 1 | Düşük risk, onay ayarı açık | Hemen çalışır, kayıt yazılır |
| 2 | Orta risk | Onay kartı oluşur, çalışmaz |
| 3 | Onay verilir | Komut çalışır, çıktı döner |
| 4 | Onay reddedilir | `APPROVAL_NOT_PENDING`, çalışmaz |
| 5 | Onay sonrası **farklı** komut | Reddedilir (TOCTOU) |
| 6 | Aynı komut tekrar | Bekleyen onay yeniden kullanılır (yığılma yok) |
| 7 | Acil durdurma etkin | Reddedilir |
| 8 | Zaman aşımı | Süreç sonlandırılır, `durationMs` raporlanır |
| 9 | Çıktıda API anahtarı | Maskelenir (`sk-`, `AIza`, …) |
| 10 | Kabuk yok | Açık hata, çökme yok |
| 11 | Var olmayan dizin | Doğrulama hatası |
| 12 | Çok büyük çıktı | `truncated: true` |

**Kanıt:** E2E #25–#28, #30 + `tests/unit/approvals.test.ts`.

### 9.5 Etkileşimli komutlar `[EKSİK]`

Şu an `npm init` gibi stdin bekleyen komutlar desteklenmiyor → **E-10**.

---

## §10. Docker

### 10.1 Kapsam `[KOD]`

| İşlem | Uç nokta | Risk |
| --- | --- | --- |
| Durum | `GET /docker/status` | low |
| Konteyner listesi | `GET /docker/containers` | low |
| Başlat / durdur / yeniden başlat | `POST /docker/containers/:id/:action` | medium |
| Silme | aynı (action=`remove`) | **high** |
| Günlükler | `GET /docker/containers/:id/logs` | low |
| İmaj listesi | `GET /docker/images` | low |
| Compose `up`/`restart`/`logs` | `POST /docker/compose/:action` | medium |
| Compose `down` | medium | — |
| Compose `down -v` | **critical** | Veri kaybı |

### 10.2 Docker yoksa `[KOD]`

- `status()` → `{ available: false, message: "Docker bağlantısı kurulamadı…" }`
- Tüm uç noktalar `503 DOCKER_UNAVAILABLE` döner.
- Arayüz liste **uydurmaz**; "Docker kullanılamıyor" gerekçesiyle gösterir.
- Denetim günlüğü 5 dakikada bir kez yazılır (gürültü bastırma).

### 10.3 Tüm Docker senaryoları

| # | Senaryo | Beklenen |
| --- | --- | --- |
| 1 | Docker yok | 503 + açıklama, çökme yok |
| 2 | Konteyner durdur (çalışıyor) | medium onay → durur |
| 3 | Konteyner sil | high onay → silinir |
| 4 | Compose down -v | critical onay + uyarı metni |
| 5 | Günlük çok uzun | Son 500 satır, kırpma bilgisi |
| 6 | Yetkisiz port | Anlaşılır hata |
| 7 | İşlem sürerken acil durdurma | Docker işlemleri de durur |

### 10.4 Eksikler

- Konteyner içinde komut çalıştırma (exec) → **E-11**
- Volume/network yönetimi → **E-11**
- İmaj çekme ilerlemesi (progress) → **E-11**

---

## §11. Tarayıcı otomasyonu

### 11.1 Mimari `[KOD]`

- Gömülü `WebContentsView` sekmeleri (masaüstü), ayrı `persist:browser` bölümü.
- Playwright yalnızca **headless** arka uç görevleri için (opsiyonel bağımlılık).
- Her sekme temiz profil; çerez dışa aktarımı **yok**.

### 11.2 İşlemler `[KOD]`

| İşlem | Uç nokta | Onay | Kayıt |
| --- | --- | --- | --- |
| Sekme aç/kapat | `POST/DELETE /browser/tabs` | Hayır | `browser_sessions` |
| Sayfa metni (DOM) | `POST /browser/action` `{type:'read'}` | Hayır | `browser_actions` |
| Tıklama | `{type:'click', selector}` | **Evet** | `browser_actions` |
| Yazma | `{type:'type', selector, text}` | **Evet** | `browser_actions` |
| Ekran görüntüsü | `{type:'screenshot'}` | Hayır | dosya + kayıt |

### 11.3 Tüm tarayıcı senaryoları

| # | Senaryo | Beklenen |
| --- | --- | --- |
| 1 | Masaüstü değil | "Yalnızca masaüstü uygulamasında" bildirimi |
| 2 | Geçersiz URL | Doğrulama hatası |
| 3 | `file://` veya `chrome://` | **Reddedilir** (yalnızca http/https) |
| 4 | CAPTCHA / oturum duvarı | Otomasyon **yapılmaz**, kullanıcıya bildirilir |
| 5 | Tıklama seçicisi bulunamadı | Anlaşılır hata |
| 6 | Onay reddedildi | İşlem yapılmaz |
| 7 | Sayfa çok büyük | DOM metni 100.000 karakterle kırpılır |

### 11.4 Eksikler

- Çok adımlı senaryo kaydı/oynatma → **E-09**
- Form doldurma + gönderme akışı (onaylı) → **E-09**
- Playwright tabanlı bağımsız testlerin arayüzden çalıştırılması → **E-09**

---

## §12. Sesli iletişim (v1.0 §12 — ayrıntılandırıldı)

### 12.1 Sağlayıcı mimarisi `[KOD]` + `[EKSİK]`

| Yetenek | Sağlayıcı | Durum | Not |
| --- | --- | --- | --- |
| STT | `webspeech` (Chromium motoru) | `[KOD]` | Ücretsiz, çevrimiçi olabilir |
| STT | `whisper-api` | `[EKSİK]` | Sağlayıcı anahtarı gerekir → **E-13** |
| TTS | `webspeech` (sistem sesi) | `[KOD]` | Çevrimdışı çalışır |
| TTS | Bulut TTS | `[EKSİK]` | → **E-13** |

**Arayüz sözleşmesi (değişmez):**
```ts
interface VoiceProvider {
  kind: 'webspeech' | 'whisper-api' | 'cloud-tts' | 'off';
  start(onFinal: (text: string) => void): void;
  stop(): void;
  speak(text: string): void;
  supported(): boolean;
}
```

### 12.2 Gizlilik kuralları `[KOD]`

- Mikrofon **yalnızca** kullanıcı düğmeye bastığında açılır; arka plan dinleme yok.
- Ses kaydı **diske yazılmaz**; STT sonucu metin olarak sohbete girer.
- Tarayıcı motoru kullanılıyorsa ses **işletim sistemi/sağlayıcı servisine** gidebilir; arayüz bunu Ayarlar'da **açıkça** yazar.
- Bulut STT seçilirse anahtar kasası kullanılır; ses dosyası istek sonrası silinir.

### 12.3 Türkçe kalite notu `[DOĞRULANMADI]`

Web Speech API'nin Türkçe doğruluğu cihaz/sürüme bağlıdır. Bu şartname **doğruluk garantisi vermez**; arayüzde "tanıma hatası olabilir, metni kontrol edin" uyarısı bulunur.

### 12.4 Eksikler

- Whisper API entegrasyonu → **E-13**
- Uzun konuşma parçalama (>60 sn) → **E-13**
- Komut sözlüğü ("yeni görev başlat" gibi sesli komutlar) → **E-13**

---

## §13. Güvenlik ve yetkilendirme (v1.0 §14 — denetlendi ve genişletildi)

### 13.1 Süreç güvenliği `[KOD]`

| Ayar | Değer | Test |
| --- | --- | --- |
| `contextIsolation` | `true` | `electron-security.test.ts` |
| `nodeIntegration` | `false` | aynı |
| `sandbox` | **`true`** (CJS preload) | aynı |
| `webSecurity` | `true` | aynı |
| `webviewTag` | `false` | kaynak denetimi |
| `allowRunningInsecureContent` | `false` | kaynak denetimi |
| Yeni pencere | `deny` + dış tarayıcı | aynı |
| Gezinme | yalnızca `file://` (üretim) | aynı |
| İzinler | `media`, `clipboard-*`, `notifications` | aynı |

### 13.2 IPC beyaz listesi `[KOD]`

```ts
const ALLOWED_PATH = /^\/api\/[a-zA-Z0-9\-_/:.?=&%]*$/;
const ALLOWED_METHODS = new Set(['GET','POST','PUT','PATCH','DELETE']);
```

- Yol `/api/` dışındaysa **reddedilir**.
- `fs`, `child_process`, `shell` arayüze **açılmaz** (regresyon testi vardır).
- Ana süreç `aw:http`, yalnızca **kendi** kaynağına (`127.0.0.1:<port>`) istek atar → SSRF yüzeyi yok.

### 13.3 Anahtar yönetimi `[KOD]`

| Aşama | Uygulama |
| --- | --- |
| Kabul | Yalnızca ana süreç |
| Saklama | `safeStorage` (DPAPI) → `secrets.vault` |
| Kullanım | Yalnızca sağlayıcı isteğinde, ana süreçte |
| Arayüz | `hasCredential: true/false` — değer asla |
| Günlük/denetim | `redact()` + `redactText()` |
| Silme | Sağlayıcı silinince kasa kaydı da silinir |

**Maskeleme alan listesi (tam eşleşme):** `api_key`, `apikey`, `secret`, `secret_key`, `password`, `passwd`, `access_token`, `auth_token`, `refresh_token`, `bearer`, `credential`, `credentials`, `private_key`.
**Kritik düzeltme:** `tokens`, `inputTokens` gibi **ölçüm** alanları maskelenmez (aksi hâlde `/api/stats` bozuluyordu).

### 13.4 Onay kapısı — içeriğe bağlı yetkilendirme `[KOD]`

| Onay türü | Bağlanan veri | Uygulama anında kontrol |
| --- | --- | --- |
| `file-write` | `changeIds` + her değişikliğin **SHA-256** içerik özeti | Özet yeniden hesaplanır; farklıysa `APPROVAL_REQUIRED` |
| `command` | `command` + `cwd` | Birebir karşılaştırma |
| `docker` | işlem + konteyner kimliği | Karşılaştırma |
| `browser` | işlem + seçici + URL | Karşılaştırma |

**TTL:** komut 15 dk, dosya 30 dk, Docker 10 dk. Süresi geçen onay `expired` olur ve kullanılamaz.
**Yeniden kullanım:** aynı komut+dizin için bekleyen onay varsa yeni kayıt açılmaz.
**Kanıt:** E2E #17–#20, `tests/unit/file-service.test.ts` (TOCTOU), `tests/unit/approvals.test.ts`.

### 13.5 Yetkilendirme modeli — eksik `[EKSİK]`

**Mevcut:** tek kullanıcı, işletim sistemi hesabına bağlı, rol yok.
**Sorun:** Şartname "yetkilendirme" derken **kim ne yapabilir** sorusunu tanımlamıyordu.
**Eksik:** rol tabanlı erişim (RBAC) ve oturum kilidi → **E-06**.

**Tanım (E-06):**
- Roller: `owner` (tek), `operator` (görev başlatır, onay verir), `viewer` (salt okuma).
- Varsayılan kurulumda tek `owner`; çok kullanıcılı makinede UAC/ayrı Windows hesabı önerilir.
- Oturum kilidi: 15 dk hareketsizlikte onay verme kilitlenir, parola/PIN ile açılır (opsiyonel).
- **Kapsam dışı:** ağ üzerinden çok kullanıcı erişimi (yerel servis dışa açılmaz).

### 13.6 Bilgi istemi enjeksiyonu savunması `[KOD]`

| Katman | Önlem |
| --- | --- |
| Sarmalama | Dosya/web içeriği `<<<VERİ>>> … <<<VERİ SONU>>>` içinde verilir; "talimat değildir" sistem isteminde yazar |
| Model çıktısı | Yalnızca **öneri**; otomatik uygulanmaz |
| Komut türetme | Model çıktısından komut **çalıştırılmaz**; komut yalnızca kullanıcı/ajan önerisiyle ve onayla |
| Bağımsız denetim | İkinci model/rol incelemesi |
| Araç izni | Ajanın izni olmayan araç çağrısı reddedilir |
| Çıktı sınırı | Uzun çıktı kırpılır (bağlam taşması önlenir) |
| Hassas veri | Bağlama hassas dosyalar girmez |

**Eksik:** enjeksiyon tespiti için kalıp tarayıcı (ör. "önceki talimatları yok say") → **E-31**.

### 13.7 Acil durdurma `[KOD]`

- `Ctrl+Shift+Escape` veya üst çubuk düğmesi.
- Etkiler: ajan adımları iptal, komutlar sonlandırılır, Docker işlemleri durur, yeni onaylar reddedilir.
- **Kalıcıdır**: uygulama yeniden başlasa da etkin kalır (veritabanında `emergency_stopped`).
- Kaldırmak için bilinçli ikinci tıklama; her ikisi de denetim günlüğüne yazılır.
- **Kanıt:** E2E #29–#32.

### 13.8 Güvenlik açığı denetimi — bulunan ve kapatılan

| # | Açık | Durum |
| --- | --- | --- |
| 1 | Onaysız dosya yazımı (`apply` doğrudan yazıyordu) | **Kapatıldı** |
| 2 | Onay içeriğe bağlı değildi (TOCTOU) | **Kapatıldı** |
| 3 | Komut onayı metne bağlı değildi | **Kapatıldı** |
| 4 | Terminal çıktısında anahtar sızıntısı | **Kapatıldı** |
| 5 | Acil durdurma terminali engellemiyordu | **Kapatıldı** |
| 6 | `sandbox: false` | **Kapatıldı** (CJS preload) |
| 7 | Hassas dosyaya ajan yazabiliyordu | **Kapatıldı** |
| 8 | Onay yığılması (kuyruk kirliliği) | **Kapatıldı** |
| 9 | RBAC / oturum kilidi yok | **Açık** → E-06 |
| 10 | Enjeksiyon kalıp taraması yok | **Açık** → E-31 |
| 11 | Yedek şifreleme yok (düz ZIP) | **Açık** → E-08 |
| 12 | Kod imzalama yok | **Açık** → E-41 |

---

## §14. Performans ve ölçeklenebilirlik

### 14.1 Ölçülen değerler `[KOD]`

| Ölçüt | Ölçüm | Koşul |
| --- | --- | --- |
| Arayüz etkileşime hazır | **463 ms** | 2 vCPU / 1 GB, soğuk açılış |
| Açılışta API isteği | 20 istek / 1.087 ms toplam | — |
| `/api/stats` | 1–2 ms | SQLite, 100 satır |
| Ağ geçidi (sahte sağlayıcı) | ~200 ms / çağrı | yerel |
| Test paketi | 4,3 sn (120 test) | — |
| Tam doğrulama | 24,5 sn | — |

### 14.2 Hedefler `[KARAR-3]`

| Ölçüt | Hedef | Ölçüm yöntemi |
| --- | --- | --- |
| Soğuk açılış | < 2 sn (4 çekirdek) | `performance.now()` ilk boyama |
| Sayfa geçişi | < 120 ms | tıklama → boyama |
| 10.000 görevde liste | < 400 ms | sayfalama ile |
| 50.000 dosyalı proje | indeks < 60 sn | arka plan |
| Bellek (boşta) | < 350 MB | Görev Yöneticisi |

### 14.3 Performans eksikleri `[EKSİK]`

| Eksik | Neden | Çözüm | Kayıt |
| --- | --- | --- | --- |
| Sayfalama yok | Tüm listeler tek seferde | İmleç tabanlı sayfalama | E-22 |
| Ağır işler ana süreçte | Tarama/indeks ana süreci bloklar | `worker_threads` / çocuk süreç | E-32 |
| Katalog önbelleği yok | Her açılışta tam liste | 5 dk TTL + ETag | E-05 |
| Dosya indeksi yok | Bağlam her istekte taranır | Kalıcı dizin | E-12 |
| Bellek sınırı yok | Uzun oturumda büyüme | Mesaj/olay budama | E-33 |
| Yavaş sorgu izleme yok | Performans körlüğü | 100 ms üstü sorgu günlüğü | E-33 |

### 14.4 Ölçeklenme sınırları `[KARAR-4]`

Uygulama **tek kullanıcı, tek makine** için tasarlanmıştır. Desteklenen üst sınırlar:
- 200 proje, 50.000 dosya/proje (indeksli), 10.000 görev, 100.000 denetim kaydı.
- Bu sınırların üzerinde uygulama **çalışmaya devam eder** ancak performans düşer; arayüz uyarı gösterir.
- **Kapsam dışı:** çok kullanıcı, bulut senkronizasyonu, dağıtık çalışma.

### 14.5 Veritabanı bakımı `[KISMİ]`

**Mevcut:** WAL modu, indeksler.
**Eksik:** periyodik `VACUUM`, arşivleme, saklama politikası → **E-25**.

---

## §15. Test sistemi (v1.0 §15 — genişletildi)

### 15.1 Test türleri ve algılama `[KOD]`

| Tür | Algılama | Komut | Onay |
| --- | --- | --- | --- |
| `typecheck` | `tsconfig.json` var | `npx --no-install tsc --noEmit` | Kullanıcı başlattıysa hayır |
| `unit` | `vitest`/`jest` kurulu **veya** `test` betiği **veya** `tests/` dizini | vitest/jest/`npm test` | Ajan: onay |
| `e2e` | `playwright.config.ts` | `npx playwright test` | Ajan: onay |
| `build` | `package.json` içinde `build` | `npm run build` | Ajan: onay |
| `security` | `dependencies` var | `npm audit --json` | Ajan: onay |
| `dependency` | `package.json` var | `npm ls --depth=0 --json` | Ajan: onay |

**Kritik kural:** `not-run` **asla** `passed` sayılmaz; nedeni her zaman yazılır ("altyapı bulunamadı", "onay bekliyor", "komut tanımlı değil").

### 15.2 Sonuç modeli `[KOD]`

```ts
type TestOutcome = 'passed' | 'failed' | 'error' | 'skipped' | 'not-run';
interface TestSuiteResult {
  kind, outcome, command?, total, passed, failed, skipped,
  durationMs, cases: TestCaseResult[], notRunReason?, at
}
```

### 15.3 Test senaryoları — eksik olanlar

| # | Senaryo | Beklenen | Durum |
| --- | --- | --- | --- |
| 1 | Projede test yok | `not-run` + neden | `[KOD]` |
| 2 | Test geçti | `passed`, sayılar | `[KOD]` |
| 3 | Test başarısız | `failed` + hata metni | `[KOD]` |
| 4 | Komut çöküyor | `error` | `[KOD]` |
| 5 | Onay gerekiyor | `not-run` + onay kimliği | `[KOD]` |
| 6 | Test sürerken iptal | `cancelled` | `[EKSİK]` → E-24 |
| 7 | Parçalı test (shard) | Paralel koşu | `[EKSİK]` → E-24 |
| 8 | Kapsam raporu | Yüzde + dosya bazlı | `[EKSİK]` → E-24 |
| 9 | Karşılaştırmalı koşu | Önceki koşuyla fark | `[EKSİK]` → E-24 |
| 10 | Test geçmişi filtresi | Proje/tür/tarih | `[KISMİ]` (`listRuns(limit, projectId)`) |

### 15.4 Kendi kendini test etme (dogfooding) `[KOD]`

Uygulama kendi projesinde Test Merkezi'ni çalıştırabilir; `npm test` → 120 test görünür. Bu, test motorunun gerçek projede çalıştığının kanıtıdır.

---

## §16. Hata kurtarma, yedekleme, geri yükleme (v1.0 §16 — genişletildi)

### 16.1 Yedekleme matrisi `[KOD]`

| Yedek türü | Ne zaman | Nerede | Saklama | Geri alma |
| --- | --- | --- | --- | --- |
| Dosya yedeği (yazma öncesi) | Her `apply`/`write` | `dataDir/backups` | 30 gün veya 500 kayıt | Tek dosya |
| Değişiklik geri alma | Kullanıcı isteği | — | Değişiklik `reverted` | Aynı dosya |
| Tam veritabanı yedeği | Kullanıcı "Yedek al" | `backups/*.zip` | Manuel | Tümü |
| Otomatik günlük yedek | Günde 1 | aynı | 7 gün | Tümü → **E-25** |
| Güncelleme öncesi yedek | Sürüm yükseltme | aynı | 2 sürüm | Tümü → **E-40** |

### 16.2 Çökme kurtarma `[KISMİ]`

**Mevcut:**
- SQLite WAL: çökmede veri kaybı yok.
- Açılışta `planning|running` durumundaki görevler `paused` işaretlenir (E-23 ile kesinleşecek).
- Elektron çökmesi: pencere kapanır, veri korunur.

**Eksik:**
- Otomatik yeniden başlatma (ana süreç çökerse) → **E-32**
- Yarım kalan adımın kilitlerinin temizlenmesi (süreç içi olduğu için otomatik, ama görev durumu düzeltilmeli) → **E-23**

### 16.3 Kurtarma senaryoları

| # | Senaryo | Beklenen davranış | Durum |
| --- | --- | --- | --- |
| 1 | Uygulama çalışırken kapanır (kill) | Açılışta görevler `paused`, veri kaybı yok | `[KOD]` |
| 2 | Veritabanı bozuk | Yedekten geri yükleme önerisi, açılış engellenmez | `[EKSİK]` → E-27 |
| 3 | Disk dolu | Yazma hatası, açık mesaj, kısmi dosya bırakmaz | `[EKSİK]` → E-27 |
| 4 | Proje klasörü silinmiş | "Proje bulunamadı" + yeniden bağlama | `[EKSİK]` → E-27 |
| 5 | Sağlayıcı anahtarı geçersiz | `AUTH_FAILED`, yedek model | `[KOD]` |
| 6 | Ağ kesintisi | `NETWORK`, 3 deneme, sonra hata | `[KISMİ]` |
| 7 | Yarıda kalan yazma | Yedekten geri dönüş | `[KOD]` |
| 8 | Kasa dosyası bozuk | Açılışta uyarı, anahtarlar yeniden girilir | `[EKSİK]` → E-27 |
| 9 | Bozuk yedek dosyası | Doğrulama reddi, önceki veri korunur | `[KISMİ]` |
| 10 | Yetersiz RAM | Ağır iş reddedilir, açık mesaj | `[EKSİK]` → E-32 |

### 16.4 Dışa/içe aktarma `[KOD]`

- `POST /api/backup/export` → ZIP + SHA-256 özeti.
- `POST /api/backup/import` → önce geometri/şema doğrulama, sonra otomatik güvenlik kopyası, sonra yükleme.
- **Varsayılan:** anahtar kasası **dışa aktarılmaz** (`includeSecrets: false`).
- **Eksik:** yedek şifreleme (AES-256-GCM, parola türetmeli) → **E-08**.

### 16.5 Veri saklama politikası `[EKSİK]`

**Eksik:** denetim günlüğü, sohbet, komut geçmişi için otomatik temizlik yok → **E-25**.

**Tanım:**
| Veri | Varsayılan saklama | Yapılandırılabilir |
| --- | --- | --- |
| Denetim kaydı | 180 gün | 30–3650 |
| Sohbet | 365 gün | 30–sınırsız |
| Komut geçmişi | 90 gün | 30–365 |
| Test koşuları | 180 gün | 30–365 |
| Bildirimler | 30 gün | — |

Temizlik günde bir, düşük öncelikli; silme öncesi "X kayıt silinecek" bildirimi.

---

## §17. Hata yönetimi ve günlükleme (v1.0 §17 — genişletildi)

### 17.1 Hata sınıfları `[KOD]`

| Sınıf | Örnek kodlar | HTTP | Kullanıcıya gösterilir |
| --- | --- | --- | --- |
| Doğrulama | `VALIDATION_ERROR`, `PATH_INVALID` | 400 | Evet |
| Yetki/onay | `APPROVAL_REQUIRED`, `PATH_SENSITIVE` | 403/428 | Evet |
| Bulunamadı | `*_NOT_FOUND` | 404 | Evet |
| Durum | `ALREADY_APPLIED`, `INVALID_STATE` | 409 | Evet |
| Sağlayıcı | `AUTH_FAILED`, `RATE_LIMITED` | 502/429 | Evet (maskelenmiş) |
| Servis | `DOCKER_UNAVAILABLE` | 503 | Evet |
| Beklenmeyen | — | 500 | "Beklenmeyen hata" + kimlik |

### 17.2 Durum kodu haritası `[KOD]`

`defaultStatusFor(code)` → 403 (yol/hassas), 400 (doğrulama), 404 (`*_NOT_FOUND`), 428 (onay), 409 (durum), 503 (servis), 500 (diğer).
**Kanıt:** `tests/integration/api-contract.test.ts` (19 test).

### 17.3 Günlük seviyeleri `[KOD]`

| Seviye | Nereye | İçerik |
| --- | --- | --- |
| `error` | dosya + arayüz bildirimi | Yığın izi (maskelenmiş) |
| `warn` | dosya | Kurtarılabilir sorun |
| `info` | dosya | Önemli olay |
| `debug` | yalnızca geliştirme | İstek/yanıt özeti |

**Kural:** Hiçbir seviyede anahtar, parola, tam dosya içeriği yazılmaz.

### 17.4 Tanılama paketi `[EKSİK]`

**Eksik:** kullanıcının destek için günlük/ayar/durum paketi oluşturması → **E-28**.

**Tanım:** `POST /api/diagnostics/export` → ZIP: sürüm bilgisi, maskelenmiş son 500 günlük satırı, ayarlar (anahtarlar hariç), modül durumları, son 20 hata. Boyut < 5 MB.

### 17.5 Sürüm kapısı `[KOD]`

`scripts/verify-release.mjs`: tür → test → derleme → e2e. Biri başarısızsa `prepare-release` **ZIP üretmez** (A1).

---

## §18. Gerçek zamanlı izleme ve olay yolu (v1.0 §18 — genişletildi)

### 18.1 Olay tipleri `[KOD]`

| Olay | Yük | Tüketici |
| --- | --- | --- |
| `task.status` | `{taskId, status, progress}` | Görevler sayfası, sağ ray |
| `task.step` | `{taskId, stepId, role, status}` | Görev detayı |
| `task.log` | `{taskId, message, level}` | Adım çıktısı |
| `approval.created` | `{approvalId, title, risk}` | Sağ ray, bildirim |
| `emergency` | `{stopped}` | Tüm ekranlar (bant) |
| `notification` | `{id, title, message, level}` | Toast + bildirim merkezi |

### 18.2 Dayanıklılık `[KISMİ]`

**Mevcut:** IPC olay yolu; bağlantı koparsa arayüz yeniden abone olur.
**Eksik:** olay kaybı telafisi (son olay kimliği ile yeniden oynatma) → **E-19**.

### 18.3 Canlı metrikler `[KOD]`

Sağ ray: aktif görev, aktif ajan sayısı, bekleyen onay, bugünkü token/maliyet, sağlayıcı sağlığı (12 sn'de bir).

### 18.4 Metrik geçmişi `[EKSİK]`

**Eksik:** zaman serisi grafik (token/maliyet/süre) → **E-20**.

---

## §19. Çelişki çözümü (Şartname tutarlılığı)

### 19.1 Ana çelişkiler ve kararlar

| # | Çelişki | v1.0'daki durum | Karar | Gerekçe |
| --- | --- | --- | --- | --- |
| Ç1 | "Bulut çıkarım, GPU gerekmez" **vs** "Ollama/LM Studio desteği" | İkisi de var | Yerel sağlayıcı **opsiyonel, varsayılan kapalı** | v1.0 kuralı korunur; yerel mod isteğe bağlı |
| Ç2 | "Ücretsiz modeller öncelikli" **vs** "Doğrulanmamış ücretsiz etiketi yasak" | Belirsiz | Ücretsizlik **veri** olarak tutulur, **iddia** edilmez | A5 |
| Ç3 | "Ajan her şeyi yapabilir" **vs** "Onaysız hiçbir işlem yok" | Belirsiz | Ajan yalnızca **önerir**; onay kullanıcıda | A2 |
| Ç4 | "Otomatik düzeltme" **vs** "Kod değişiklikleri onaysız uygulanmaz" | Belirsiz | Otomatik düzeltme = yeni **öneri** üretmek | A2 |
| Ç5 | "Tek dosya monolit yasak" **vs** "Tek kurulum dosyası" | Karışıklık | Monolit **kaynak kod** için yasak; paketleme tek dosya olabilir | Modülerlik korunur |
| Ç6 | "Acil durdurma anında durdurur" **vs** "Çalışan adım biter" | Belirsiz | Komutlar **anında** öldürülür; model isteği iptal edilir; adım `cancelled` | Gerçek durdurma |
| Ç7 | "Tüm testler yeşilse tamam" **vs** "Test altyapısı yoksa `not-run`" | Belirsiz | `not-run` kanıt sayılmaz → sonuç `partial` | A6 |
| Ç8 | "Sınırsız ücretsiz model" **vs** gerçek | v1.0'da ima | Açıkça reddedilir; kota sağlayıcıya bağlı | Dürüstlük |
| Ç9 | "Çok kullanıcı" **vs** "yerel tek kullanıcı" | Belirsiz | Yerel tek kullanıcı + opsiyonel roller | Kapsam |
| Ç10 | "Otomatik güncelleme" **vs** "imzasız kurulum" | Belirsiz | Güncelleme **imzalı** kanal ister; imzasız sürümde manuel | Güvenlik |

### 19.2 Kaldırılan **ifade** biçimleri (özellik değil)

| v1.0 ifadesi | Neden kaldırıldı | Yerine |
| --- | --- | --- |
| "Sınırsız ücretsiz model erişimi" | Gerçek dışı | §4.2, §4.7 (kota sağlayıcıya bağlı) |
| "Her modeli %100 doğrulukla sıralar" | Ölçüm tanımsız | §4.5 (benchmark tanımı + `samples`) |
| "Tüm işlemleri otomatik yapar" | Onay ilkesiyle çelişir | §6.9 araç izinleri |
| "Yedekler şifrelenir" (v1.0'da iddia) | Uygulanmamış | E-08 (yeni gereksinim, açık) |

### 19.3 Alternatiflerin değerlendirildiği kararlar

**[KARAR-1]** Arka uç aynı süreçte.
- *Alternatif:* ayrı Node süreci. *Artı:* izolasyon. *Eksi:* IPC karmaşıklığı, paket boyutu, kasa köprüsü. *Sonuç:* aynı süreç + hata sınırları + ağır işler için çocuk süreç (E-32).

**[KARAR-3]** Hedefler ölçülebilir tutuldu; abartılı değer verilmedi. 1 GB RAM'li ortamda ölçülen 463 ms, 4 çekirdekli makinede hedef < 2 sn'dir.

**[KARAR-4]** Tek makine sınırı korundu; çok kullanıcılı dağıtım kapsam dışı ilan edildi (aksi hâlde kimlik doğrulama, TLS, çok kiracılılık gerekirdi).

---

## §20. Windows kurulum ve dağıtım (v1.0 §20 — ayrıntılandırıldı)

### 20.1 Üretim ortamı gereksinimleri

| Bileşen | En az | Önerilen |
| --- | --- | --- |
| Windows | 10 (1909+, x64) | 11 (23H2+) |
| RAM | 4 GB | 8 GB |
| Disk | 1 GB | 3 GB |
| Ekran | 1280×800 | 1920×1080 |
| .NET | Paketle birlikte gelir | — |
| Node.js | **Gerekmez** (paket içinde) | — |

### 20.2 Paketleme `[KOD]` (yapılandırma) / `[DOĞRULANMADI]` (çalıştırma)

| Öğe | Değer |
| --- | --- |
| Araç | `electron-builder` 24+ |
| Hedefler | `nsis` + `portable`, `x64` |
| Kurulum türü | Kullanıcı başına (`perMachine: false`), `asInvoker` |
| Kurulum dizini | Değiştirilebilir; varsayılan `%LOCALAPPDATA%\Programs\AI Workstation` |
| Dil | `tr_TR` (1055) |
| Kısayol | Masaüstü + başlat menüsü |
| ASAR | Açık; `better-sqlite3` ve `*.node` dışarıda |
| İkon | `resources/icons/icon.ico` (16–256 px) |
| Dosya adları | `AI_WORKSTATION_Setup.exe`, `AI_WORKSTATION_Portable.exe` |

**Doğrulama durumu:** Yapılandırma ve derleme (`electron-vite build`) Linux ortamında **doğrulandı**; `.exe` üretimi Windows gerektirir → `[DOĞRULANMADI]` (E-41 ile CI'da kapatılacak).

### 20.3 Kurulum öncesi/sonrası adımlar

```
1. Kurulum: dosya kopyalama + kısayol + (opsiyonel) otomatik başlatma
2. İlk açılış: veri klasörü oluşturma, DB migrasyon, kasa anahtarı
3. Sağlık denetimi: yerel servis, DB, disk alanı → sorun varsa tanılama ekranı
4. Kaldırma: dosyalar silinir, %APPDATA%\AIWorkstation KORUNUR (veri kaybı yok)
```

### 20.4 Kod imzalama `[EKSİK]`

| Konu | Durum | Gereksinim |
| --- | --- | --- |
| İmza | Yok | EV/OV sertifika, `signtool` veya `electron-builder` `certificateSubjectName` |
| SmartScreen | İmzasız uyarır | İmza + itibar birikimi |
| Bütünlük | SHA-256 listesi | `SHA256SUMS.txt` + `docs/hash-list.json` |

**Kullanıcı yönlendirmesi:** "Ek bilgi → Yine de çalıştır" adımı `docs/KURULUM_TR.md` §2.2'de yazılı; özet doğrulama komutu verilmiş.

### 20.5 Otomatik güncelleme `[EKSİK]`

**Durum:** `electron-updater` bağımlılığı **yok**; güncelleme altyapısı kurulmadı.
**Plan (E-40):**
1. `electron-updater` ekle, `autoUpdater.checkForUpdates()` açılışta (3 sn gecikme).
2. Güncelleme kanalı: `latest.yml` + imzalı `.nsis` farkı.
3. **İmza zorunlu:** imzasız güncelleme reddedilir (güvenlik).
4. Güncelleme öncesi otomatik veri yedeği; geri alma: önceki `.exe` + yedek.
5. Kullanıcı onayı olmadan **kurulmaz** (otomatik yeniden başlatma yok).

### 20.6 Taşınabilir sürüm

- Kurulum yapmaz, kayıt defterine yazmaz.
- Veri varsayılan `%APPDATA%`; taşınabilir kullanım için `AW_DATA_DIR` ortam değişkeni.
- **Kısıt:** DPAPI kasa anahtarı makineye bağlı → başka makinede anahtarlar yeniden girilir.

### 20.7 Dağıtım kanalları

| Kanal | Amaç | Hazırlık |
| --- | --- | --- |
| Elle indirme | Son kullanıcı | `SHA256SUMS.txt` |
| GitHub Actions | CI üretim | `.github/workflows/build-windows.yml` `[KOD]` |
| Kurumsal (GPO/Intune) | Toplu kurulum | Sessiz kurulum: `Setup.exe /S` |
| Otomatik güncelleme | Sürüm yayını | E-40 |

### 20.8 Kurulum test kriterleri

| # | Test | Kabul |
| --- | --- | --- |
| K1 | Temiz Windows 11'de kurulum | < 2 dk, hata yok |
| K2 | Yönetici yetkisi istemiyor | UAC tetiklenmiyor |
| K3 | İlk açılış | DB oluşur, servis bağlanır, hata yok |
| K4 | Kaldırma | Dosyalar silinir, `%APPDATA%` kalır |
| K5 | Yeniden kurulum | Eski veriler korunur |
| K6 | Taşınabilir `.exe` | Kurulum olmadan açılır |
| K7 | Türkçe kurulum ekranı | Dil doğru |
| K8 | İmzalı sürüm | SmartScreen uyarısı yok |
| K9 | 4 GB RAM altında | Çökme yok |
| K10 | Yol adında Türkçe karakter | Sorunsuz |

> Bu testler **Windows gerektirir**; bu ortamda yapılmamıştır → `[DOĞRULANMADI]`.

---

## §21. Modül bağımlılık matrisi (denetim çıktısı)

Satır: bağımlı modül · Sütun: bağımlı olduğu modül · ● zorunlu · ○ isteğe bağlı · — yasak (döngü)

| ↓ bağımlı / → | security | memory | database | providers | agents | files | terminal | docker | browser | tests | orchestrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **security** | — | ○ | ● | — | — | — | — | — | — | — | — |
| **memory** | — | — | ● | — | — | — | — | — | — | — | — |
| **providers** | ● | ● | ● | — | — | — | — | — | — | — | — |
| **agents** | ● | ● | ● | ● | — | ○ | ○ | — | — | — | — |
| **files** | ● | ● | ● | — | — | — | — | — | — | — | — |
| **terminal** | ● | ● | ● | — | — | — | — | — | — | — | — |
| **docker** | ● | ● | ● | — | — | — | — | — | — | — | — |
| **browser** | ● | ● | ● | — | — | — | — | — | — | — | — |
| **tests** | ● | ● | ● | — | — | — | ● | — | — | — | — |
| **orchestrator** | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ● | — |
| **chat** | ● | ● | ● | ● | — | ○ | — | — | — | — | — |

**Denetim kuralı:** `security` ve `memory` hiçbir üst modülü import etmez. `agents` ile `orchestrator` birbirini import etmez (orkestratör ajanları çağırır, tersi olmaz). Bu matris `tests/unit/architecture.test.ts` (E-30) ile otomatik denetlenir.

---

## §22. Modüler yapı ve kod organizasyonu (v1.0 §22)

### 22.1 Zorunlu klasör yapısı `[KOD]`

```
AI_WORKSTATION/
├── electron/          main · preload · ipc · browser-bridge
├── backend/
│   ├── database/      şema, DB, migrasyon
│   ├── security/      kasa, maskeleme, yol, onay, denetim, risk
│   ├── memory/        ayarlar, bağlam
│   ├── ai/            adaptörler, gateway, katalog, sohbet, hatalar
│   ├── projects/ files/ terminal/ docker/ browser/ testing/
│   ├── agents/        profiller, istemler, ayrıştırıcı, görev servisi
│   ├── orchestration/ orkestratör, olay yolu
│   └── server/        uygulama, rotalar, konteyner, standalone
├── shared/types/      DONDURULMUŞ sözleşme
├── src/               React arayüzü (14 sayfa, 3 düzen)
├── tests/             unit + integration
├── scripts/           derleme, doğrulama, demo
├── docs/              KURULUM, KULLANIM, ekranlar
├── resources/icons/   uygulama ikonları
└── spec/              bu şartname + eksik kayıtları
```

### 22.2 Kural denetimi `[EKSİK]`

**Eksik:** klasör yapısının ve import yönünün otomatik denetimi → **E-30**.

### 22.3 Dosya boyutu ve karmaşıklık sınırları `[KARAR-5]`

| Ölçüt | Sınır | Gerekçe |
| --- | --- | --- |
| Tek dosya | 800 satır | Okunabilirlik |
| Tek fonksiyon | 80 satır | Test edilebilirlik |
| Parametre sayısı | 5 | Anlaşılırlık |
| İç içe derinlik | 4 | Karmaşıklık |

**Mevcut istisna:** `backend/server/routes.ts` (~600 satır, 74 uç nokta) — bölünmesi önerilir → **E-34**.

---

## §23. Arayüz (v1.0 §4, §24 — genişletildi)

### 23.1 Sayfa envanteri `[KOD]`

| # | Sayfa | Ana işlev | Durum |
| --- | --- | --- | --- |
| 1 | Sohbet | Akışlı yanıt, `/görev` komutları, sesli giriş | `[KOD]` |
| 2 | Projeler | Ekleme, sağlık taraması | `[KOD]` |
| 3 | Dosyalar | Ağaç, önizleme, arama | `[KOD]` |
| 4 | Yapay Zekâ Modelleri | Sağlayıcı, katalog, filtre, sıralama | `[KOD]` |
| 5 | Ajan Merkezi | Model/izin ataması, onay kuyruğu | `[KOD]` |
| 6 | Görevler | 12 adımlı akış, rapor | `[KOD]` |
| 7 | Tarayıcı | Sekmeler, DOM, görüntü | `[KOD]` (masaüstü) |
| 8 | Terminal | Kabuk, risk, onay | `[KOD]` |
| 9 | Docker | Konteyner/imaj/compose | `[KOD]` |
| 10 | Kod Editörü | Monaco, diff, uygula | `[KOD]` |
| 11 | Test Merkezi | Paketler, sonuçlar | `[KOD]` |
| 12 | Geçmiş | Denetim, görev, komut, sohbet | `[KOD]` |
| 13 | Ayarlar | 9 bölüm | `[KOD]` |
| 14 | Yardım | Kısayollar, risk, sorun giderme | `[KOD]` |

### 23.2 Durum yönetimi ve hata sınırları `[KISMİ]`

**Mevcut:** Zustand store, toast, boş/hata/yükleniyor durumları.
**Eksik:** React error boundary (bir sayfa çökerse tüm uygulama beyaz kalır) → **E-02**.

### 23.3 Erişilebilirlik `[EKSİK]`

**Eksik:** klavye ile tam gezinme, odak halkaları, ekran okuyucu etiketleri → **E-03**.

### 23.4 Tema ve yerelleştirme `[KOD]`

- Koyu varsayılan; açık/sistem seçenekleri.
- Tüm metinler Türkçe sabit; çok dilli altyapı **yok** (kapsam dışı, §24.2).

### 23.5 Klavye kısayolları `[KOD]`

| Kısayol | İşlev |
| --- | --- |
| `Ctrl+Shift+Escape` | Acil durdurma |
| `Enter` / `Shift+Enter` | Gönder / yeni satır |
| `Esc` | Modal kapat |

---

## §24. Kapsam dışı (net sınırlar)

Aşağıdakiler **bilinçli olarak kapsam dışıdır**; talep edilirse yeni sürüm konusudur:

| # | Kapsam dışı | Gerekçe |
| --- | --- | --- |
| 1 | Çok kullanıcılı/ağ üzerinden erişim | Kimlik doğrulama + TLS + çok kiracılılık gerektirir |
| 2 | Bulut senkronizasyonu | Veri gizliliği ve maliyet |
| 3 | Mobil uygulama | Ayrı ürün |
| 4 | Yerel model indirme/servis yönetimi | GPU/RAM bağımlılığı (Ç1) |
| 5 | Kod imzalama sertifikası temini | Kurumsal/ticari karar |
| 6 | Web arayüzü otomasyonu / CAPTCHA çözme | Yasal ve etik (v1.0 yasağı korunur) |
| 7 | Çoklu dil (i18n) | Talep yok; Türkçe sabit |
| 8 | Takım işbirliği / yorum sistemi | Ayrı ürün yönü |
| 9 | Ücretli model faturalama entegrasyonu | Sağlayıcı sorumluluğu |

---

## §25. Kabul kriterleri (v1.0 A–K — ölçülebilir hâle getirildi)

Her kriter **komutla doğrulanabilir** olmalıdır.

| Kriter | Kabul koşulu | Doğrulama komutu | Durum |
| --- | --- | --- | --- |
| **A. Derleme** | `tsc --noEmit` 0 hata, `vite build` + `electron-vite build` başarılı | `npm run verify` | ✔ |
| **B. Test** | ≥ 100 test, tümü geçer, 0 atlanmış | `npx vitest run` | ✔ (120) |
| **C. Uçtan uca** | 37/37 kontrol | `npm run e2e` | ✔ |
| **D. Arayüz** | 14 sayfa hatasız açılır, 0 `pageerror` | `docs/ekranlar/` + tarayıcı betiği | ✔ |
| **E. Anahtar güvenliği** | Yanıt/günlük/denetimde anahtar yok | E2E #2, #36 | ✔ |
| **F. Onay kapısı** | Onaysız yazma/komut reddedilir | E2E #17–#20, #26 | ✔ |
| **G. Yol güvenliği** | Kaçış ve hassas dosya reddedilir | E2E #8, #9 | ✔ |
| **H. Acil durdurma** | Tüm işlemleri durdurur | E2E #29–#32 | ✔ |
| **I. Dürüstlük** | `not-run` ≠ `passed`; ücretsiz etiketi doğru | `tests/unit/test-service.test.ts` | ✔ |
| **J. Windows kurulum** | `.exe` üretilir, 10 kurulum testi geçer | `build-windows.ps1` + K1–K10 | ✖ `[DOĞRULANMADI]` |
| **K. Belgeler** | README + kurulum + kullanım + test + güvenlik + değişiklik | Dosya varlığı + bağlantı kontrolü | ✔ |

**Kural:** J kriteri sağlanmadan sürüm "üretime hazır" ilan edilemez; "kaynak + CI hazır" olarak duyurulur (bu belge bunu böyle yapıyor).

---

## §26. Eksik kayıtları (E-01 … E-48)

Aşağıdaki tablo, bu belgenin **asıl tamamlayıcı** kısmıdır. Her kayıt ayrı dosyada teknik uygulama düzeyinde açıklanmıştır.

| # | Eksik | Modül | Öncelik | Efor | Bağımlılık | Dosya |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | Gerçek model benchmark koşucusu | Model Merkezi | **P1** | L | providers, gateway, tests | `E-01-benchmark.md` |
| E-02 | React hata sınırları + kurtarma ekranı | Arayüz | **P1** | S | src, store | `E-02-error-boundary.md` |
| E-03 | Erişilebilirlik (klavye, ARIA, odak) | Arayüz | P2 | M | src | `E-03-erisilebilirlik.md` |
| E-04 | Sağlayıcı kimlik bilgisi rotasyonu ve çoklu anahtar | Model Merkezi | P2 | M | security, providers | `E-04-anahtar-rotasyonu.md` |
| E-05 | Katalog önbelleği + eski katalog uyarısı | Model Merkezi | P2 | S | providers | `E-05-katalog-onbellek.md` |
| E-06 | Rol tabanlı yetkilendirme + oturum kilidi | Güvenlik | **P1** | L | security, server | `E-06-rbac.md` |
| E-07 | Ajan başına bütçe/kota sınırı | Ajanlar | P2 | M | agents, usage_events | `E-07-ajan-butcesi.md` |
| E-08 | Yedek şifreleme (AES-256-GCM + parola) | Yedekleme | **P1** | M | backup, security | `E-08-yedek-sifreleme.md` |
| E-09 | Tarayıcı senaryo kaydı/oynatma + form akışı | Tarayıcı | P2 | L | browser, approvals | `E-09-tarayici-senaryo.md` |
| E-10 | Etkileşimli komut desteği (stdin) | Terminal | P2 | M | terminal | `E-10-etkilesimli-komut.md` |
| E-11 | Docker exec, volume/network, imaj çekme ilerlemesi | Docker | P2 | L | docker, approvals | `E-11-docker-genisletme.md` |
| E-12 | Kalıcı dosya indeksi + artımlı bağlam | Proje/Dosya | **P1** | L | files, projects, db | `E-12-dosya-indeksi.md` |
| E-13 | Whisper/bulut STT-TTS + sesli komutlar | Ses | P2 | M | voice, providers | `E-13-ses-saglayici.md` |
| E-14 | Benchmark tablosu şeması (ölçüm geçmişi) | Veritabanı | P2 | S | db | `E-14-benchmark-tablosu.md` |
| E-15 | `file_locks` kalıcı kilit kaydı (çoklu süreç) | Orkestrasyon | P3 | M | db, orchestrator | `E-15-kilit-tablosu.md` |
| E-16 | Görev şablonları (hazır iş akışları) | Görevler | P3 | M | tasks | `E-16-gorev-sablonlari.md` |
| E-17 | Çoklu proje bağlamı (tek görevde 2+ proje) | Proje | P3 | L | projects, files | `E-17-coklu-proje.md` |
| E-18 | Maliyet bütçesi ve uyarı eşikleri | Model/Maliyet | P2 | S | usage_events | `E-18-butce-uyari.md` |
| E-19 | Olay akışı telafisi (yeniden oynatma) | İzleme | P2 | M | events, db | `E-19-olay-telafisi.md` |
| E-20 | Metrik geçmişi ve grafikler | İzleme | P3 | M | usage_events | `E-20-metrik-gecmisi.md` |
| E-21 | Görev öncelik kuyruğu | Görevler | P2 | M | orchestrator | `E-21-oncelik-kuyrugu.md` |
| E-22 | İmleç tabanlı sayfalama | Genel | **P1** | M | server, src | `E-22-sayfalama.md` |
| E-23 | Yeniden deneme politikası + zaman aşımı yapılandırması | Orkestrasyon | **P1** | M | orchestrator, db | `E-23-yeniden-deneme.md` |
| E-24 | Test iptali, kapsam, karşılaştırmalı koşu | Test | P2 | L | tests | `E-24-test-genisletme.md` |
| E-25 | Veri saklama politikası + otomatik temizlik + VACUUM | Veritabanı | **P1** | M | db, settings | `E-25-saklama-politikasi.md` |
| E-26 | Yedek geri yükleme öncesi şema doğrulama + geri alma | Yedekleme | P2 | S | backup | `E-26-geri-yukleme-dogrulama.md` |
| E-27 | Bozuk DB / disk dolu / eksik proje kurtarma | Kurtarma | **P1** | M | db, projects | `E-27-kurtarma-senaryolari.md` |
| E-28 | Tanılama paketi | Destek | P2 | S | server, audit | `E-28-tanilama-paketi.md` |
| E-29 | API sürümleme (`/api/v1`) | Sözleşme | P3 | S | server | `E-29-api-surumleme.md` |
| E-30 | Mimari kural testi (import yönü, klasör) | Kalite | P2 | S | tests | `E-30-mimari-test.md` |
| E-31 | Enjeksiyon kalıp taraması | Güvenlik | P2 | M | security, agents | `E-31-enjeksiyon-taramasi.md` |
| E-32 | Ağır işler için çocuk süreç + bellek sınırı + otomatik yeniden başlatma | Performans | **P1** | L | electron, backend | `E-32-arka-plan-isler.md` |
| E-33 | Yavaş sorgu izleme + bellek budama | Performans | P2 | S | db, src | `E-33-performans-izleme.md` |
| E-34 | `routes.ts` bölünmesi (modül başına rota dosyası) | Kalite | P3 | M | server | `E-34-rota-bolme.md` |
| E-35 | Çoklu dil altyapısı (opsiyonel) | Arayüz | P4 | L | src | `E-35-i18n.md` |
| E-36 | Eklenti/araç kayıt sistemi | Genişletme | P4 | XL | agents, security | `E-36-eklenti-sistemi.md` |
| E-37 | Git entegrasyonu (commit/branch/diff) | Proje | P2 | L | terminal, projects | `E-37-git-entegrasyonu.md` |
| E-38 | Uzak proje (SSH) desteği | Proje | P4 | XL | files, terminal | `E-38-uzak-proje.md` |
| E-39 | Bildirim merkezi (geçmiş + filtre) | İzleme | P3 | S | notifications, src | `E-39-bildirim-merkezi.md` |
| E-40 | Otomatik güncelleme (imzalı kanal) | Dağıtım | **P1** | M | electron-builder, CI | `E-40-otomatik-guncelleme.md` |
| E-41 | CI'da gerçek Windows `.exe` üretimi + K1–K10 | Dağıtım | **P1** | M | Actions, Windows | `E-41-ci-windows-uretimi.md` |
| E-42 | Kod imzalama hattı | Dağıtım | P2 | M | sertifika | `E-42-kod-imzalama.md` |
| E-43 | Sessiz kurulum / kurumsal dağıtım | Dağıtım | P3 | S | nsis | `E-43-kurumsal-dagitim.md` |
| E-44 | Kullanım telemetrisi (isteğe bağlı, yerel) | İzleme | P4 | M | usage_events | `E-44-telemetri.md` |
| E-45 | Model puanına göre sıralama (arayüz) + ölçüm kaydı bağlantısı | Model Merkezi | **P1** | S | E-01, `providers`, `ModelsPage` | `E-45-puan-siralama.md` |
| E-46 | Doküman iddia denetimi (belge–kod kanıt kapısı) | Süreç | **P1** | M | `verify-release.mjs` | `E-46-dokuman-iddia-denetimi.md` |
| E-47 | Sürüm kimliği ayrımı (uygulama ≠ şartname) + dört bağımsız yayın durumu | Süreç / Dağıtım | **P1** | S | `constants.ts`, `verify-release.mjs` | `E-47-surum-ayrimi.md` |
| E-48 | İptal işaretleme (`cancelled`) — test + sohbet + acil durdurma akışları | Test / Sohbet | **P1** | M | `runtime.ts`, `test-service.ts`, `chat-service.ts`, `gateway.ts` | `E-48-iptal-isaretleme.md` |

**Öncelik tanımları:**
- **P1 — Üretim engelleyici:** güvenlik, veri kaybı, vaat edilen ve çalışmayan özellik.
- **P2 — Önemli:** işlevsel boşluk, kullanıcı deneyimini belirgin etkiler.
- **P3 — İyileştirme:** verimlilik, bakım kolaylığı.
- **P4 — Gelecek:** kapsam genişletme, opsiyonel.

**Efor:** S ≤ 1 gün · M = 2–4 gün · L = 1–2 hafta · XL > 2 hafta.

---

## §27. Uygulama yol haritası (öncelik sırasına göre)

Bu yol haritası **48 kaydın tamamını** kapsar (E-01 … E-48); hiçbir kayıt iki aşamada birden yer almaz. Aşama 0, bu denetimde **kodu yazılıp testi geçen** kayıtları gösterir.

| Aşama | Adı | Kayıtlar | Çıktı | Süre (tahmini) |
| --- | --- | --- | --- | --- |
| **0** | **Bu denetimde kapatılanlar** | E-47 ✔KOD, E-48 ✔KOD | Sürüm ayrımı, iptal işaretleme | **tamamlandı** |
| **1** | Güvenlik ve veri bütünlüğü | E-06, E-08, E-25, E-27, E-31 | RBAC, şifreli yedek, saklama, kurtarma, enjeksiyon taraması | 2 hafta |
| **2** | Üretim engelleyici boşluklar | E-01, E-12, E-22, E-23, E-32, E-40, E-41, E-45 | Benchmark + puan sıralaması, dosya indeksi, sayfalama, retry, arka plan, güncelleme, CI/EXE | 3–4 hafta |
| **3** | İşlevsel genişleme | E-02, E-04, E-05, E-07, E-09, E-10, E-11, E-13, E-18, E-19, E-20, E-21, E-24, E-26, E-28, E-37 | Özellik tamamlama | 6–8 hafta |
| **4** | Kalite ve bakım | E-03, E-14, E-15, E-16, E-17, E-29, E-30, E-33, E-34, E-39, E-42, E-43, E-46 | Mimari disiplin, dağıtım, iddia eşleme tablosu | 3–4 hafta |
| **5** | Gelecek | E-35, E-36, E-38, E-44 | Genişletme | Talep bazlı |

**Kural 1 (sürüm):** Aşama 1 ve 2 tamamlanmadan **uygulama** sürümü 2.0'a yükseltilmez; 1.x serisi yalnızca hata düzeltmesi alır. Şartname sürümü (bu belge) uygulamadan bağımsızdır (E-47).
**Kural 2 (kapsam):** Yukarıdaki tablo 48 kaydın tamamını **tam olarak bir** aşamada listeler; elle doğrulanmıştır.

---

## §27.1 Aşama kapsam doğrulaması (makinece)

| Kontrol | Sonuç |
| --- | --- |
| Kayıt dosyası sayısı | **48** (`spec/eksikler/E-01…E-48`) |
| Numaralandırma boşluğu | **0** |
| Numaralandırma çakışması | **0** |
| Yol haritasında listelenen kayıt | **48 / 48** (Aşama 0: 2 · Aşama 1–5: 46) |
| Aşama 0'da kapanan | E-47, E-48 (kodu + testi); E-46 kısmi |
| Öncelik dağılımı | P1 = 16 · P2 = 20 · P3 = 8 · P4 = 4 |

## §28. Değişiklik yönetimi

### 28.1 Şartname sürümleme

| Sürüm | Anlam |
| --- | --- |
| Büyük (2.0) | Kapsam değişikliği, kaldırılan özellik |
| Küçük (2.1) | Yeni modül/madde |
| Yama (2.1.1) | Netleştirme, yazım |

### 28.2 Şartname → kod izlenebilirliği

Her E-kaydı uygulanırken:
1. Kodu yaz.
2. Testi yaz (kabul kriterleri → test).
3. `CHANGELOG.md`'ye ekle.
4. Bu belgedeki durum işaretini `[EKSİK]` → `[KOD]` yap.

**Kural:** İşaret `[KOD]` olmadan `CHANGELOG`'a "eklendi" yazılamaz.

### 28.3 Geriye dönük uyumluluk

- Veritabanı: her migrasyon ileri yönlü; geri alma yalnızca yedekten.
- API: `/api` yolu korunur; kaldırma yalnızca büyük sürümde (E-29 ile v1 öneki).
- Ayar dosyası: bilinmeyen alanlar korunur (ileri uyumluluk).

---

## §29. Sonuç — denetim özeti

| Denetim | Sonuç |
| --- | --- |
| Toplam modül | **14 ana modül**, 54 alt bileşen |
| v1.0'da yeterli tanımlı | **38 madde** (bkz. §30/A: A1–A38) |
| Eksik/yetersiz tanımlı | **18 madde** (bkz. §30/B: B1–B18) → **48 E-kaydına** açıldı |
| Yeni eklenen gereksinim | **24 madde** (bkz. §30/C: C1–C24) |
| Çelişki | 10 bulundu, tamamı çözüldü (§19) |
| Belge–kod uyuşmazlığı | 10 bulundu (§32) → 4'ü kayıt açtı/güncelledi (E-45, E-47, E-48; E-01/E-12/E-40 güncellendi) |
| Güvenlik açığı | 12 bulundu: **8 kapatıldı**, 4 açık (E-06, E-08, E-31, E-42) |
| Performans eksikliği | 6 bulundu → E-05, E-12, E-22, E-32, E-33 |
| Çalışmayan ama "bitmiş" gösterilen özellik | **2** (model puanı sıralaması → E-45 · otomatik güncelleme iddiası → E-40/E-47) |

### 29.1 İkinci denetim — kapatılan maddeler (kanıtlı)

Bu tabloda **yalnızca kodu yazılmış ve testi geçmiş** maddeler `[KOD]` taşır; geri kalanı açık kayıt olarak kalır.

| Madde (istenen düzeltme) | Durum | Kanıt |
| --- | --- | --- |
| 1. E-01…E-48 taraması | `[KOD]` | 48 dosya, boşluk 0, çakışma 0 (§27.1) |
| 2. E-45/E-46/E-47/E-48 tanımı | `[KOD]` | 4 ayrı kayıt dosyası (§26) |
| 3. Numaralandırma tekil + ardışık | `[KOD]` | §27.1 doğrulama tablosu |
| 4. Toplam görev sayısı | `[KOD]` | **48** |
| 5. P1/P2/P3/P4 sayıları | `[KOD]` | **16 / 20 / 8 / 4** |
| 6. §26/§27/§29/§30/§32 referans uyumu | `[KOD]` | Bu bölüm + §32 düzeltmeleri |
| 7. `TestOutcome` + `cancelled` tek sözleşme | `[KOD]` | `runtime.ts` 6 durum; `test-outcome.test.ts` 4 test |
| 8. Şartname sürümü ≠ uygulama sürümü | `[KOD]` | `SPEC_VERSION`, `/api/health`, `version.test.ts` 5 test |
| 9. EXE / CI / imza / güncelleme ayrı durum | `[KOD]` | `release-status.test.ts` 5 test; README §8 |
| 10. Her kayıtta yöntem/kapsam/bağımlılık/risk/kabul | `[KOD]` | 48 kayıt dosyası §2–§5 yapısı |
| 11. Özellik başına mevcut kod durumu | `[KOD]` | §33 izlenebilirlik tablosu |
| 12. Kanıtsız özellik `[KOD]` sayılmaz | `[KOD]` | §33'te `[KOD]` = kod + test kanıtı |

**Test kanıtı (gerçek çıktı):** `npx vitest run` → **20 dosya / 143 test geçti**; `node scripts/verify-release.mjs` → **6/6 adım ✔** (sürüm kapısı dahil), e2e **37/37**.

**İkinci denetim özeti:** 48 kaydın **2'si tamamen kapandı** (E-47, E-48), **1'i kısmen** (E-46) — hepsi kod + test kanıtıyla. Kalan **45 kayıt açıktır** ve hiçbiri "yapıldı" sayılmaz. Bu denetimin asıl çıktısı yeni özellik değil, **ölçülebilir tutarlılıktır**: numaralandırma, sayılar, sürüm kimliği, veri sözleşmesi ve yayın durumu artık makinece denetleniyor.

**Genel değerlendirme:** v1.0 şartnamesi **iyi bir ürün vizyonu** ama **zayıf bir mühendislik belgesiydi**: ölçülebilir kabul kriterleri yoktu, model sıralaması ve yetkilendirme tanımsızdı, ücretsizlik iddiaları gerçek dışıydı, hata kurtarma ve dağıtım boştu. Bu belge vizyonu koruyup mühendislik tarafını tamamladı.

---

## §30. Üç liste (istenen rapor)

### A. Şartnamede zaten yeterince tanımlanmış özellikler

Bu maddeler v1.0'da açık, ölçülebilir ve uygulanabilir biçimde yazılmıştı; kod da bunları karşılıyor.

| # | Özellik | v1.0 maddesi | Kod kanıtı |
| --- | --- | --- | --- |
| A1 | Türkçe arayüz, koyu tema varsayılan | §1, §4 | 14 sayfa, `class="dark"` |
| A2 | Antigravity benzeri üç sütun düzen | §4 | `Sidebar`, `RightRail` |
| A3 | 14 sayfalık gezinme | §4, §24 | `Sidebar.tsx` |
| A4 | Çoklu sağlayıcı (10 bulut + 2 yerel) | §5 | `adapters/registry.ts` |
| A5 | Dinamik model kataloğu çekme | §5.4 | `provider-service.syncModels` |
| A6 | Bağlantı testi | §5.3 | `probe()` + E2E #3 |
| A7 | Model filtreleri (yetenek/sağlayıcı/arama) | §5.4 | `ModelsPage.tsx` |
| A8 | Token/maliyet gösterimi | §5 | `usage_events`, sağ ray |
| A9 | API anahtarlarının yalnız ana süreçte tutulması | §14.3 | `secrets.ts` + 6 test |
| A10 | 8 uzman ajan + yönetici | §6 | `profiles.ts` |
| A11 | Ajan başına model ve sıcaklık | §6.9 | `agent_profiles` |
| A12 | Ajanlar arası inceleme | §6.12 | orchestrator `review` bloğu |
| A13 | Paralel görev + dosya kilidi | §6.12 | `acquireLocks` |
| A14 | 12 adımlı iş akışı | §7 | `orchestrator.run` |
| A15 | Kullanıcı onayı olmadan uygulamama | §7 | E2E #16–#20 |
| A16 | Duraklat / devam / iptal | §7 | `tasks/:id/{pause,resume,cancel}` |
| A17 | Monaco editör + diff | §8.2 | `EditorPage`, `public/monaco/vs` |
| A18 | Yazma öncesi yedek | §8.2 | `file_backups` |
| A19 | Yol kaçışı koruması | §8.4 | `paths.ts` + 7 test |
| A20 | Akıllı bağlam toplama | §8.1 | `context.ts` + 7 test |
| A21 | Çok kabuklu terminal | §10 | `terminal-service.shellFor` |
| A22 | Komut risk sınıflandırması (4 seviye) | §10 | `command-analyzer.ts` + 9 test |
| A23 | Terminal onay akışı | §10 | `approvals` |
| A24 | Docker konteyner/imaj/compose yönetimi | §11 | `docker-service.ts` |
| A25 | Docker yoksa dürüst "kullanılamıyor" | §11 | 503 + arayüz mesajı |
| A26 | Tarayıcı sekmeleri, DOM, tıkla, yaz, görüntü | §9 | `browser-bridge.ts` |
| A27 | Test Merkezi (6 paket) | §15 | `test-service.ts` |
| A28 | `not-run` ≠ `passed` dürüstlüğü | §15 | `test-service.test.ts` |
| A29 | Acil durdurma | §14 | E2E #29–#32 |
| A30 | Denetim günlüğü + maskeleme | §14, §17 | `audit.ts`, `redaction.ts` |
| A31 | Ayarlar (9 bölüm), yedek al/geri yükle | §24 | `SettingsPage.tsx` |
| A32 | Türkçe ses (STT/TTS) temel | §12 | `useVoice.ts` |
| A33 | Modül bağımsızlığı | §22 | klasör yapısı |
| A34 | Monolit yasağı | §22 | 77 TS dosyası |
| A35 | Yerel SQLite hafıza | §13 | 26 tablo + `schema_migrations` (şema v2) |
| A36 | Bulut çıkarım, GPU gerektirmeme | §5 | varsayılan yol bulut |
| A37 | Dürüst kapsam: kapsam dışı ilan | §1 | §24 |
| A38 | Belgeler (README, CHANGELOG, raporlar) | §28 | 6 belge |

### B. Şartnamede eksik veya yetersiz tanımlanmış özellikler

Bunlar v1.0'da **vardı ama test edilebilir/uygulanabilir değildi**; bu belgede netleştirildi.

| # | Eksik tanım | Modül | Ne eksikti | Bu belgede | E-kaydı |
| --- | --- | --- | --- | --- | --- |
| B1 | "Gerçek test sonuçlarına göre sıralama" | Model Merkezi | Test tanımı, ölçüt, güncelleme kuralı **ve arayüz sıralaması** yok | §4.5 | **E-01** + **E-45** |
| B2 | "Ücretsiz erişim sistemi" | Model Merkezi | Hangi katman, nasıl doğrulanır, kota gösterimi yok | §4.2, §4.7 | E-05 |
| B3 | "Yetkilendirme" | Güvenlik | Kim, neyi, hangi rolde yapabilir belirsiz | §13.5 | **E-06** |
| B4 | "Yedekleme sistemi" | Yedekleme | Ne, ne zaman, ne kadar saklanır; şifreleme? | §16.1, §16.5 | **E-08**, E-25 |
| B5 | "Hata kurtarma" | Kurtarma | Hangi senaryoda ne olur | §16.3 | **E-27** |
| B6 | "Otomatik güncelleme" | Dağıtım | Kanal, imza, geri alma tanımsız | §20.5 | **E-40** |
| B7 | Windows kurulum testleri | Dağıtım | Kabul kriteri yoktu | §20.8 (K1–K10) | **E-41** |
| B8 | Çoklu ajan koordinasyonu | Ajanlar | "Koordinasyon" soyut; bağımlılık/kilit/hata yayılımı yok | §6.3–§6.13 | E-23 |
| B9 | Dosya/terminal/tarayıcı/Docker "tüm senaryolar" | 4 modül | Senaryo matrisi yoktu | §8.2, §9.4, §10.3, §11.3 | — |
| B10 | Performans hedefleri | Genel | Ölçülebilir hedef yoktu | §14.2, §14.4 | E-32, E-33 |
| B11 | Ölçeklenme sınırları | Genel | Kaç proje/görev/dosya | §14.4 | E-12, E-22 |
| B12 | Veri saklama | Veritabanı | Süre yok, temizlik yok | §16.5 | **E-25** |
| B13 | Bilgi istemi enjeksiyonu | Güvenlik | "Savunma" var, yöntem yok | §13.6 | E-31 |
| B14 | Ses sağlayıcı soyutlaması | Ses | Whisper "planlandı" ama arayüz yok | §12.1 | E-13 |
| B15 | Test iptali/kapsam/karşılaştırma | Test | Sonuç modeli dardı | §15.3 | E-24 |
| B16 | Olay akışı dayanıklılığı | İzleme | Kayıp olay telafisi yok | §18.2 | E-19 |
| B17 | Kapsam dışı listesi | Genel | Sınırlar yazılı değildi | §24 | — |
| B18 | Şartname↔kod izlenebilirliği | Süreç | Kural yok | §28.2, §33 | **E-46** |

### C. Şartnameye yeni eklenmesi gereken özellikler

Bunlar v1.0'da **hiç yoktu**; üretim kalitesi için zorunlu görüldü.

| # | Yeni gereksinim | Neden zorunlu | Modül | Öncelik | E-kaydı |
| --- | --- | --- | --- | --- | --- |
| C1 | Rol tabanlı erişim + oturum kilidi | Paylaşılan makinede onay veren kişi ile sahip aynı olmalı | Güvenlik | P1 | E-06 |
| C2 | Şifreli yedekleme (parola türetmeli) | Düz ZIP, tüm proje/ayar geçmişini taşır | Yedekleme | P1 | E-08 |
| C3 | Veri saklama ve otomatik temizlik | Denetim günlüğü sınırsız büyür | Veritabanı | P1 | E-25 |
| C4 | Kurumsal/bozuk durum kurtarma ekranları | Disk dolu, bozuk DB → uygulama açılmıyor | Kurtarma | P1 | E-27 |
| C5 | Ajan başına token/maliyet bütçesi | Kontrolsüz maliyet riski | Ajanlar | P2 | E-07 |
| C6 | Küresel maliyet bütçesi + eşik uyarıları | Sürpriz fatura | Model/Maliyet | P2 | E-18 |
| C7 | İmleç tabanlı sayfalama | 10.000 kayıtta arayüz kilitleniyor | Genel | P1 | E-22 |
| C8 | Yeniden deneme + üstel geri çekilme + iş kimliği | Ağ hatalarında kullanıcı elle tekrar ediyor | Orkestrasyon | P1 | E-23 |
| C9 | Ağır işler için çocuk süreç + otomatik yeniden başlatma | Ana süreç bloklanması/çökmesi tüm uygulamayı durdurur | Performans | P1 | E-32 |
| C10 | Tanılama paketi dışa aktarma | Destek verilemez durum | Destek | P2 | E-28 |
| C11 | Mimari kural testi | Modül sınırları zamanla erozyona uğrar | Kalite | P2 | E-30 |
| C12 | Enjeksiyon kalıp taraması | Model çıktısı komut olarak yorumlanabilir | Güvenlik | P2 | E-31 |
| C13 | API sürümleme (`/api/v1`) | Sözleşme değişince eski arayüz kırılır | Sözleşme | P3 | E-29 |
| C14 | Git entegrasyonu (diff/commit/branch, onaylı) | Geliştiricinin ilk beklediği özellik | Proje | P2 | E-37 |
| C15 | Görev şablonları | Tekrarlayan iş akışları | Görevler | P3 | E-16 |
| C16 | Bildirim merkezi (geçmiş + filtre) | Toast kaçırılınca kayboluyor | İzleme | P3 | E-39 |
| C17 | Olay akışı telafisi | Arayüz yeniden bağlanınca durum kaybolur | İzleme | P2 | E-19 |
| C18 | Metrik zaman serisi | "Ne kadar harcadım, neden yavaş" | İzleme | P3 | E-20 |
| C19 | React hata sınırı | Tek bileşen tüm arayüzü beyaz bırakıyor | Arayüz | P1 | E-02 |
| C20 | Erişilebilirlik (klavye/ARIA) | Klavye kullanıcısı uygulamayı kullanamıyor | Arayüz | P2 | E-03 |
| C21 | Sessiz kurulum / kurumsal dağıtım | BT birimlerinin toplu kurulum ihtiyacı | Dağıtım | P3 | E-43 |
| C22 | Kod imzalama hattı | SmartScreen uyarısı güven kırıyor | Dağıtım | P2 | E-42 |
| C23 | Sürüm kimliği ayrımı (uygulama ≠ şartname) + dört bağımsız yayın durumu | Denetimde "v2.0" üç ayrı anlamda kullanıldı | Süreç / Dağıtım | P1 | **E-47** |
| C24 | İptal işaretleme (`cancelled`) — test + sohbet + acil durdurma | İptal edilen iş "tamamlandı" veya "başarısız" görünüyordu | Test / Sohbet | P1 | **E-48** |

---

## §31. Dosya ekleri ve okuma sırası

1. Bu belge (`spec/AI_WORKSTATION_SPEC_v2.md`) — ana şartname.
2. `spec/ANA_EKSIK_LISTESI.md` — 48 eksik kaydının tek tabloda özeti + durum etiketleri (önce bu okunur).
3. `spec/eksikler/E-XX-*.md` — her eksik için ayrı teknik kayıt (uygulama adımları, test kriterleri, riskler).
4. `spec/YOL_HARITASI.md` — 48 kaydın aşamalara bölünmüş tek planı.
5. `spec/KABUL_TEST_MATRISI.md` — hangi testin hangi maddeyi kanıtladığı.
6. `spec/IZLENEBILIRLIK_TABLOSU.md` — şartname maddesi → dosya → mevcut durum → test (`§33` ile aynı).
7. `spec/EKSIKLER_OZET.md` — kayıt dosyalarından üretilen özet tablo (ikincil).
   `spec/DENETIM_RAPORU_2.md` — ikinci denetimin 12 maddeye verdiği cevaplar (kanıtlı).
8. `README_TR.md`, `CHANGELOG.md`, `TEST_REPORT.md`, `SECURITY_REPORT.md` — mevcut ürün belgeleri.
9. `docs/KURULUM_TR.md`, `docs/KULLANIM_TR.md` — kullanıcı belgeleri.

**Öneri:** Bu şartname bir sözleşme olarak kullanılacaksa, her E-kaydı için ayrı bir iş kaydı (issue) açılmalı ve kabul kriterleri birebir kopyalanmalıdır.

---

## §32. Denetimde bulunan belge–kod uyuşmazlıkları

Bu bölüm, **dokümanın söylediği ile kodun yaptığının** ayrıştığı yerleri kaydeder. Amaç suçlu aramak değil; bir daha "yazıldı ama yapılmadı" durumunun oluşmaması.

| # | Belge ne diyor | Kod ne yapıyor | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| U1 | "Sıralama: ad, bağlam, fiyat, **gerçek test sonucu**" (`README_TR.md` §6) | Yalnızca `name \| cost \| context` | `ModelsPage.tsx:42` | **E-45** (P1); README düzeltildi |
| U2 | "Model puanları gerçek testlerden gelir" (§4.5) | `recordMeasurement()` tanımlı ama **çağrılmıyor**; tablo boş | `provider-service.ts:382` (tek referans) | **E-01** (P1) |
| U3 | "Proje dosya indeksi tutulur" (§8.5) | `project_files` tablosu var, **hiç yazılmıyor** | `schema.ts:29` | **E-12** (P1) |
| U4 | "Kalıcı dosya kilidi" (§6.6) | `task_steps.file_locks` bir **JSON kolonudur**, tablo değil; kilitler süreç içi `Map` | `schema.ts:138` | **E-15** (P3), E-32 ile ilişkili |
| U5 | "Yedekler şifrelenir" (v1.0 iddiası) | Yedek düz ZIP, şifreleme yok | `prepare-release` / `backup/export` | **E-08** (P1) |
| U6 | "Otomatik güncelleme altyapısına hazır" (v1.0 iddiası) | `electron-updater` **bağımlılıkta yok**; güncelleme kodu yok → **iddia geri çekildi** | `package.json`, README §8 | **E-40** (P1) + **E-47** (durum ayrımı ✅) |
| U7 | "Bildirimler" (`GET /api/notifications`) | Okuma + "okundu" var; arayüzde **merkez yok** | `routes.ts`, `src` | **E-39** (P3) |
| U8 | "Test geçmişi" | `listRuns` çalışıyor; arayüz filtresi yok | `TestService.listRuns` | **E-24** (P2, kısmi) |
| U9 | "Ses sağlayıcı: Whisper API seçeneği" (Ayarlar) | Seçenek **var**, arkasında kod **yok** | `SettingsPage.tsx` | **E-13** (P2) |
| U10 | "İptal: kısmi yanıt `cancelled` kaydedilir" (§15.3) | **Düzeltildi:** `messages.status='cancelled'` + `cancel_reason`; yarım içerik korunur | `chat-service.ts:134-176`, `schema.ts` v2, `chat-cancel.test.ts` (4 test) ✅ | **E-48** (P1) — **kapandı** |
| U11 | "Şartname v2.0" ifadesi uygulamanın sürümü gibi okunuyordu | Uygulama **1.0.0**, şartname **AWS-SPEC-2.0**; ayrı sabitler + `/api/health` ayrı alanlar | `constants.ts`, `routes.ts`, `version.test.ts` (5 test) ✅ | **E-47** (P1) — **kapandı** |
| U12 | "Windows kurulum dosyası" tek satırda EXE+CI+imza+güncelleme olarak toplanmıştı | README §8'de **dört bağımsız satır**: EXE `[DOĞRULANMADI]`, CI `[DOĞRULANMADI]`, imza `[EKSİK]`, güncelleme `[EKSİK]` | README §8, `release-status.test.ts` (5 test) ✅ | **E-47** (P1) — **kapandı** |

**Kural (A1'in uygulanışı):** Bu tablodaki her satır, ancak ilgili E-kaydı kapandığında "uyuşmazlık giderildi" olarak işaretlenir. Belgede "yapıldı" yazmak için önce bu tablodan çıkması gerekir. **Bu denetimde U10, U11, U12 kapandı** (kod + test + gerçek çıktı); U1–U9 açık kayıtlarla takip edilir.

### 32.1 Doküman denetim kuralı (yeni)

Her sürümde `scripts/verify-release.mjs` şu ek kontrolü yapar:

1. `README_TR.md` ve `docs/*.md` içindeki **iddia cümleleri** işaretlenir (`<span data-claim>` yerine basit bir `CLAIMS.md` listesi).
2. `spec/IDDIALAR.md` dosyası: her iddia → onu doğrulayan test/komut eşlemesi.
3. Testi olmayan iddia → `[DOĞRULANMADI]` ve sürüm notunda belirtilir.

Bu, "belge gerçeği söylüyor" ilkesini otomatikleştirir (E-46).

---

---

## §33. Belge–kod izlenebilirlik tablosu (tek tablo)

**Amaç:** Madde 11–12'nin karşılığı. Her şartname maddesi → gerçek dosya → **mevcut kod durumu** → test kanıtı.
Tek kaynak: [`spec/IZLENEBILIRLIK_TABLOSU.md`](IZLENEBILIRLIK_TABLOSU.md) (bu bölüm onun aynısıdır).

**`[KOD]` kuralı:** kod **ve** çalıştırılmış test birlikte varsa verilir. Kod var + test yok → `[DOĞRULANMADI]`.
Yapılandırma var + ürün denenmedi → `[DOĞRULANMADI]` (Windows `.exe` gibi).

**Özet:** 43 satır → `[KOD]` 23 · `[KISMİ]` 4 · `[EKSİK]` 11 · `[DOĞRULANMADI]` 1.

### 33.1 Tablo (43 satır)

| Şartname | Özellik | Kod (gerçek dosya) | Mevcut kod durumu | Test kanıtı | Durum |
| --- | --- | --- | --- | --- | --- |
| §4, §24 | 14 sayfalık Türkçe arayüz, koyu tema | `src/pages/*.tsx` (14) | Tam | e2e #1 (build) | [KOD] |
| §4 | Üç sütun düzen (Sidebar / içerik / sağ ray) | `src/layouts/{Sidebar,RightRail}.tsx` | Tam | `vite build` + görsel | [KOD] |
| §5 | Çoklu sağlayıcı adaptörleri (10 bulut + 2 yerel) | `backend/ai/adapters/registry.ts` | Tam | `gateway.test.ts` (10) | [KOD] |
| §5.3 | Bağlantı testi (`probe`) | `provider-service.ts → testConnection` | Tam | `gateway.test.ts` #1 | [KOD] |
| §5.4 | Model kataloğu senkronu | `provider-service.ts → syncModels` | Tam | `gateway.test.ts` #1 | [KOD] |
| §5.4 | Model filtreleri (yetenek/sağlayıcı/arama) | `src/pages/ModelsPage.tsx` | Tam | arayüz + `api-contract` | [KOD] |
| §4.5 | **Model puanına göre sıralama** | `ModelsPage.tsx:42` (yalnız name/cost/context) | **Yok** | — | **[EKSİK]** E-45 |
| §4.5 | Ölçüm kaydı (`recordMeasurement`) | `provider-service.ts:382` — tanımlı, **çağrı yok** | **Bağlanmamış** | — | **[EKSİK]** E-01 |
| §5.6 | Token/maliyet gösterimi | `usage_events`, `RightRail` | Tam | `gateway.test.ts` #2–3 | [KOD] |
| §14.3 | API anahtarı yalnız ana süreçte | `backend/security/secrets.ts` | Tam | `secrets.test.ts` (6) | [KOD] |
| §6 | 8 uzman ajan + yönetici profili | `backend/agents/profiles.ts` | Tam | `orchestrator.test.ts` | [KOD] |
| §6.12 | Ajanlar arası inceleme | `orchestration/orchestrator.ts` review bloğu | Tam | `orchestrator.test.ts` | [KOD] |
| §6.12 | Paralel görev + dosya kilidi | `orchestrator.acquireLocks` (süreç içi Map) | **Kısmi** — kalıcı değil | `orchestrator.test.ts` | [KISMİ] E-15 |
| §7 | 12 adımlı iş akışı | `orchestrator.run` | Tam | `orchestrator.test.ts` (5) | [KOD] |
| §7 | Onaysız uygulama yok | `approvals` + `file_changes` | Tam | `approvals.test.ts` + e2e 16–20 | [KOD] |
| §7 | Duraklat / devam / iptal | `routes.ts → tasks/:id/{pause,resume,cancel}` | Tam | e2e + `orchestrator.test.ts` | [KOD] |
| §8.2 | Monaco editör + diff | `src/pages/EditorPage.tsx`, `public/monaco/vs` | Tam | e2e #13–15 | [KOD] |
| §8.2 | Yazma öncesi yedek | `file_backups` + `file-service.backup` | Tam | `file-service.test.ts` (13) | [KOD] |
| §8.4 | Yol kaçışı koruması | `backend/security/paths.ts` | Tam | `paths-security.test.ts` (7) | [KOD] |
| §8.1 | Akıllı bağlam toplama | `backend/ai/context.ts` | Tam | `context.test.ts` (7) | [KOD] |
| §8.5 | **Kalıcı dosya indeksi** | `project_files` tablosu var — **hiç yazılmıyor** | **Yok** | — | **[EKSİK]** E-12 |
| §10 | Çok kabuklu terminal | `terminal-service.shellFor` | Tam | e2e #21–23 | [KOD] |
| §10 | Komut risk sınıflandırma (4 seviye) | `backend/security/command-analyzer.ts` | Tam | `command-analyzer.test.ts` (9) | [KOD] |
| §11 | Docker konteyner/imaj/compose | `backend/docker/docker-service.ts` | Tam (kuruluysa) | e2e; yok ise `skipped` | [KOD] |
| §12 | Tarayıcı sekmeleri/DOM/tıkla/yaz | `backend/browser/browser-service.ts` | Tam (kuruluysa) | e2e; yok ise `skipped` | [KOD] |
| §12.1 | **Whisper / bulut STT-TTS** | `SettingsPage.tsx` seçeneği var, kod **yok** | **Yok** | — | **[EKSİK]** E-13 |
| §15 | Test Merkezi (10 tür) | `backend/testing/test-service.ts` | Tam | `test-service.test.ts` (5) + `parsers.test.ts` (13) | [KOD] |
| §15.2 | **Test sonucu sözleşmesi (6 durum)** | `shared/types/runtime.ts:194` | **Tam (bu denetimde)** | `test-outcome.test.ts` (4) | **[KOD]** E-48 |
| §15.3 | **Sohbet iptali `cancelled`** | `chat-service.ts:159`, `schema.ts` v2 | **Tam (bu denetimde)** | `chat-cancel.test.ts` (4) + `migration.test.ts` (2) | **[KOD]** E-48 |
| §15.4 | **Acil durdurma tüm akışları keser** | `gateway.ts:43 abortAll`, `routes.ts` | **Tam (bu denetimde)** | `gateway.test.ts` + `api-contract.test.ts` | **[KOD]** E-48 |
| §16.5 | Veri saklama / temizlik | — | **Yok** | — | **[EKSİK]** E-27, E-25 |
| §13.6 | Bilgi istemi enjeksiyonu taraması | — | **Yok** | — | **[EKSİK]** E-31 |
| §14 | Denetim günlüğü + maskeleme | `backend/security/{audit,redaction}.ts` | Tam | `redaction.test.ts` (7) | [KOD] |
| §18.2 | Olay akışı telafisi | — | **Yok** | — | **[EKSİK]** E-19 |
| §20.1 | **Sürüm ayrımı (uygulama ≠ şartname)** | `shared/constants.ts:17`, `/api/health` | **Tam (bu denetimde)** | `version.test.ts` (5) | **[KOD]** E-47 |
| §20.5 | **Otomatik güncelleme** | — (`electron-updater` yok) | **Yok** | `release-status.test.ts` doğrular | **[EKSİK]** E-40 |
| §20.8 | **Windows .exe + K1–K10** | `electron-builder.yml`, `build-windows.ps1` | **Yapılandırma var, ürün yok** | — | **[DOĞRULANMADI]** E-41 |
| §20.9 | **Kod imzalama** | — | **Yok** | `release-status.test.ts` doğrular | **[EKSİK]** E-42 |
| §32.1 | **Belge iddia denetimi** | `verify-release.mjs` (sürüm + yayın kapıları) | **Kısmi** | `version.test.ts`, `release-status.test.ts` | [KISMİ] E-46 |
| §21 | RBAC / 9 rol | `users` tablosu var, yetki matrisi **yok** | **Yok** | — | **[EKSİK]** E-06 |
| §17 | Şifreli yedek | `backup/export` düz ZIP | **Yok** | — | **[EKSİK]** E-08 |
| §19 | Bildirim merkezi (arayüz) | `GET /api/notifications` var, arayüz **yok** | **Kısmi** | `api-contract.test.ts` | [KISMİ] E-39 |
| §22 | Test geçmişi filtresi | `TestService.listRuns` var, filtre **yok** | **Kısmi** | `api-contract.test.ts` | [KISMİ] E-24 |

## Notlar

1. **`[KOD]` sayısı abartılmadı.** Tabloda `[KOD]` taşıyan her satırın test dosyası adı ve test sayısı yazılıdır; `npx vitest run` bu dosyaların hepsini koşar.
2. **`[KISMİ]` ne demek?** Uç nokta/veri var, kullanıcı akışı eksik (ör. `notifications` API'si var, arayüz merkezi yok).
3. **`[DOĞRULANMADI]` ne demek?** `electron-builder.yml` ve PowerShell betiği okunabilir durumda ama `.exe` hiç üretilmedi, Windows'ta hiç açılmadı. Bu satır, Windows'ta kurulum yapılmadan `[KOD]` olamaz.
4. **Satır 7 ve 8 (E-45 / E-01):** belge "gerçek test sonucuna göre sıralama" diyordu; kod sıralamıyor ve ölçüm kaydetmiyor. README düzeltildi, kayıt açık.
5. **Bu tablo `spec/AI_WORKSTATION_SPEC_v2.md` §33 olarak da yer alır** (tek kaynak ilkesi: belge ve teslim aynı içeriği taşır).


### 33.2 Neden bu tablo "yapıldı" demek değildir

Bu tablo **mevcut kodun** durumunu gösterir; ürünün eksiksiz olduğunu göstermez. 45 kayıt açıktır ve
bunların 14'ü P1'dir. Tablodaki `[KOD]` satırları "bu madde bugün çalışıyor ve testi var" demektir;
"şartname tamamlandı" demek değildir.

**Sözleşme:** Bu tabloya yeni bir satır `[KOD]` olarak ancak testi `npx vitest run` çıktısında göründüğünde eklenir.

---

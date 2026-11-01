# Değişiklik Günlüğü

Tüm önemli değişiklikler bu dosyada izlenir. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) · Sürümleme: [SemVer](https://semver.org/lang/tr/).

## [Belge 2.0.1 / Uygulama 1.0.0] — 01.11.2026 — İkinci denetim: tutarlılık giderildi

**Kod değişti** (E-48, E-47). Aşağıdaki her madde test çıktısıyla kanıtlıdır.

### Eklenen (kod)
- **E-48 — İptal işaretleme.** `TestOutcome` altı duruma çıktı (`passed|failed|error|skipped|cancelled|not-run`);
  altyapı hatası artık `error`, iptal `cancelled`; öncelik `cancelled > failed > error > passed`.
  Sohbet iptali `messages.status='cancelled'` + `cancel_reason` ile kaydedilir, yarım içerik korunur.
  Acil durdurma `gateway.abortAll()` ile **tüm model akışlarını** iptal eder; iptal edilen istek yedek modele geçmez.
  Şema v2 migration (`messages.status`, `messages.cancel_reason`), v1 veritabanını kayıpsız yükseltir.
- **E-47 — Sürüm ayrımı.** `APP_VERSION` (1.0.0) ile `SPEC_VERSION` (2.0) ayrıldı; `/api/health`
  `specVersion`/`specId` döner; `verify-release.mjs` sürüm tutarlılığı kapısı eklendi; arayüzde iki sürüm ayrı gösterilir.
- **E-46 (kısmi) — Belge denetimi.** `scripts/check-spec-consistency.mjs`: numaralandırma, §26 tablosu,
  yol haritası kapsamı, hayalet referanslar, öncelik sayıları ve özet belge sayıları makinece denetlenir.
- Testler: `test-outcome` (4), `chat-cancel` (4), `migration` (2), `version` (5), `release-status` (5),
  gateway iptal testi (+1) → **133 → 143 test**.

### Eklenen (belge)
- `spec/ANA_EKSIK_LISTESI.md` — 48 kaydın tek ana listesi (durum etiketleriyle).
- `spec/YOL_HARITASI.md` — 48 kaydın tek, çakışmasız aşama planı.
- `spec/KABUL_TEST_MATRISI.md` — hangi test hangi maddeyi kanıtlıyor.
- `spec/IZLENEBILIRLIK_TABLOSU.md` — 43 satırlık belge–kod tablosu (`§33`).
- `spec/eksikler/E-46`, `E-47`, `E-48` — yeni kayıtlar.
- Şartname §26 (48 kayıt), §27 (Aşama 0–5, tam kapsam), §29 (gerçek sayılar), §30/C23–C24, §32 (U11–U12), §33 (yeni).

### Düzeltilen (dürüstlük)
- README §8: "Windows kurulum dosyası" tek satırı **dört bağımsız satıra** bölündü:
  EXE `[DOĞRULANMADI]`, CI `[DOĞRULANMADI]`, imza `[EKSİK]`, otomatik güncelleme `[EKSİK]`.
- README §8.1 ve CHANGELOG: 45 → 48 kayıt, 13 → 16 P1.
- §32 U10/U11/U12 **kapandı** olarak işaretlendi (kanıtlarıyla).

### Bilinen sınırlar (değişmedi)
- Windows `.exe` üretilmedi ve Windows'ta denenmedi (E-41) → `[DOĞRULANMADI]`.
- Kod imzalama yok (E-42) → `[EKSİK]`.
- Otomatik güncelleme yok (E-40) → `[EKSİK]`.
- Gerçek sağlayıcı anahtarıyla canlı test yok; testler sahte OpenAI sunucusu kullanır.

---

## [Belge 2.0] — 31.10.2026 — Şartname denetimi ve genişletme

Kod değişmedi; **şartname** denetlendi ve eksikler kayıt altına alındı.

### Eklenen
- `spec/AI_WORKSTATION_SPEC_v2.md` — 1.741 satırlık denetlenmiş ana şartname (33 bölüm).
- `spec/EKSIKLER_OZET.md` — 48 eksik kaydının özet tablosu (16'sı P1).
- `spec/eksikler/E-01…E-48` — her eksik için teknik uygulama + kabul/test kriterleri.
- §32 "Belge–kod uyuşmazlıkları": 10 uyuşmazlık (U1–U10) kanıtlarıyla listelendi.

### Düzeltilen (belge dürüstlüğü)
- `README_TR.md` ve `docs/KULLANIM_TR.md`: "gerçek test sonucuna göre sıralama" iddiası kaldırıldı,
  yerine "henüz kullanıma açık değil + E-45 kaydı" yazıldı. Gerekçe: `ModelsPage.tsx` yalnızca
  `name|cost|context` sıralıyor ve `recordMeasurement()` hiçbir yerden çağrılmıyor.

### Bilinen sınırlar (değişmedi)
- Windows `.exe` üretilmedi (E-41).
- Kod imzalama yok (E-42).
- Otomatik güncelleme yok (E-40).

---

## [1.0.0] — 31.10.2026

İlk kararlı sürüm. Şartname v1.0 kapsamının tamamı uygulandı.

### Eklenen — Çekirdek
- **Electron masaüstü kabuğu**: ana süreç, preload köprüsü, IPC işleyicileri, tek örnek kilidi, acil durdurma kısayolu.
- **Yerel Fastify servisi**: `127.0.0.1` üzerinde rastgele portta, ~70 uç nokta, tipli sözleşme katmanı (`shared/types/api.ts`).
- **SQLite veritabanı**: 27 tablo (26 uygulama tablosu + `schema_migrations`) (görevler, sohbetler, ajan çalışmaları, dosya değişiklikleri, yedekler, komutlar, denetim kayıtları, ayarlar, bellek, onaylar, test koşuları…), WAL modu, migrasyon ve yedekleme altyapısı.

### Eklenen — Model Merkezi
- 9 sağlayıcı adaptörü: OpenAI, Google Gemini, Anthropic, xAI, DeepSeek, Mistral, OpenRouter, Hugging Face, OpenAI uyumlu uç nokta.
- Dinamik model kataloğu (sağlayıcıdan çekme), yetenek filtreleri, bağlam/fiyat sıralaması.
- Bağlantı testi, sağlık durumu, kota/maliyet takibi.
- API anahtarları: `safeStorage` (DPAPI) ile şifreli kasa; arayüze asla dönmez.
- "Ücretsiz" etiketi yalnızca sağlayıcının resmî katmanı için; doğrulanmamış modeller **"Doğrulanmadı"**.

### Eklenen — Ajan Sistemi
- 8 uzman ajan: Yönetici, Araştırma, Mimar, Kodlama, Test, Güvenlik, Performans, Dokümantasyon.
- Ajan başına model/vekalet modeli, sıcaklık, araç izinleri.
- Yönetici ajan planı JSON olarak üretir; döngü/bağımlılık doğrulaması yapılır.
- Bağımsız kod incelemesi (`approve` / `revise` / `reject` + güven puanı).
- Paralel çalışma; dosya kilidi ve çakışma önleme.

### Eklenen — Görev Yönetimi
- 12 adımlı iş akışı: anlama → bağlam → plan → doğrulama → araştırma → mimari → kodlama → inceleme → test → rapor → onay → uygulama.
- Durumlar: `planning`, `running`, `awaiting-approval`, `paused`, `completed`, `partial`, `failed`, `cancelled`.
- Duraklat/devam/iptal/yeniden çalıştır; kalıcı geçmiş ve adım çıktıları.
- Sonuç **yalnızca gerçek test/derleme kanıtıyla** "tamamlandı" sayılır.

### Eklenen — Proje ve Dosya
- Proje ekleme, sağlık taraması, dosya ağacı, arama, önizleme.
- Monaco editör (yerel, çevrimdışı), diff görünümü, uygula/geri al.
- Yazma öncesi otomatik yedek; yol kaçışı ve sembolik bağlantı koruması.
- Hassas dosya (`.env`, `.ssh`, kimlik bilgileri) okuma/yazma engeli.

### Eklenen — Terminal
- PowerShell, PowerShell 7, CMD, WSL, Git Bash; kabuk yoklama ve geri düşme.
- 4 seviyeli risk sınıflandırması; kritik komutlarda kırmızı uyarı.
- Onay kartı, 10 dakika zaman aşımı, çıktı sınırlama ve maskelere tabi tutma.
- Komut geçmişi ve çıkış kodu kaydı.

### Eklenen — Docker
- Konteyner/imaj/compose yönetimi, günlükler, sistem durumu.
- Yüksek riskli işlemlerde ayrı onay; `down -v` **kritik**.
- Docker yoksa açık "kullanılamıyor" durumu (sahte liste yok).

### Eklenen — Tarayıcı Otomasyonu
- `WebContentsView` sekmeleri, adres çubuğu, DOM okuma, tıklama, yazma, ekran görüntüsü.
- Her etkileşim öncesi onay; CAPTCHA/oturum duvarı politikası.

### Eklenen — Test Merkezi
- 6 paket: tip denetimi, birim, uçtan uca, derleme, güvenlik denetimi, bağımlılık ağacı.
- Sonuç durumları `passed` / `failed` / `error` / **`not-run`**; `not-run` asla "geçti" sayılmaz.
- Koşu geçmişi ve proje bazlı filtre.

### Eklenen — Sesli İletişim
- Türkçe konuşma tanıma (tarayıcı motoru) ve seslendirme; değiştirilebilir sağlayıcı mimarisi.
- Mikrofon yalnızca kullanıcı düğmeye bastığında açılır; kayıt diske yazılmaz.
- Asistan yanıtlarını sesli okuma düğmesi.

### Eklenen — Güvenlik
- `contextIsolation: true`, `nodeIntegration: false`, **`sandbox: true`**, `webSecurity: true`.
- Katı CSP (`unsafe-eval` yok, dış bağlantı yok).
- Preload beyaz listesi: yalnızca `/api/` yolları ve 5 HTTP yöntemi.
- **Onay içeriğe bağlı**: dosya değişikliği SHA-256 özetiyle, komut metni+diziniyle eşleştirilir (TOCTOU koruması).
- Acil durdurma tüm ajan, komut ve Docker işlemlerini engeller; kalıcıdır.
- Çıktı ve günlüklerde kimlik bilgisi maskeleme (`sk-`, `AIza`, `xai-`, `hf_`, `ghp_`, `Bearer`…).
- Denetim günlüğü + gürültü bastırma.

### Eklenen — Arayüz
- 14 sayfa, tamamı Türkçe, koyu tema: Sohbet, Projeler, Dosyalar, Yapay Zekâ Modelleri, Ajan Merkezi, Görevler, Tarayıcı, Terminal, Docker, Kod Editörü, Test Merkezi, Geçmiş, Ayarlar, Yardım.
- Antigravity benzeri üç sütunlu düzen; canlı görev, onay kuyruğu, maliyet ve model paneli.
- Akışlı sohbet, `/görev` · `/analiz` · `/test` komutları.
- Bildirimler (toast), klavye kısayolları, boş/hatalı/yükleniyor durumları.

### Eklenen — Paketleme ve dokümantasyon
- `electron-builder` yapılandırması: NSIS kurulum + taşınabilir sürüm, x64, `asInvoker`, Türkçe kurulum dili.
- `scripts/build-windows.ps1` (Windows'ta tek komut) ve `.github/workflows/build-windows.yml` (CI).
- Uygulama ikonları (16–1024 px PNG + `.ico`).
- `README_TR.md`, `docs/KURULUM_TR.md`, `docs/KULLANIM_TR.md`, `TEST_REPORT.md`, `SECURITY_REPORT.md`, `LICENSE.txt`.
- `scripts/verify-release.mjs` (tek komutla doğrulama kapısı) ve `scripts/e2e-scenario.mjs` (37 kontrol).
- `scripts/mock-provider.ts`: API anahtarı olmadan uçtan uca demo.
- 15 test dosyası / 122 test (şartname denetimi sonrası 2 regresyon testi eklendi).

### Düzeltilen (sürüm öncesi testlerde bulundu)
- `redactDeep` ölçüm alanlarını (`tokens`, `inputTokens`) yanlışlıkla maskeliyordu → alan adı tam eşleşmesi.
- `/api/stats` yanıtı proxy'de `content-length` nedeniyle bozuluyordu → başlık filtresi.
- Dosya değişikliği onaysız uygulanabiliyordu → onay zorunlu.
- Onay içeriğe bağlı değildi (TOCTOU) → SHA-256 özeti + komut metni karşılaştırması.
- Terminal çıktısındaki anahtarlar maskelenmiyordu → `redactText`.
- Acil durdurma terminal komutlarını engellemiyordu → orkestratör durumu sorgulanıyor.
- Denetçi yanıtında kod bloğu varsa JSON bulunamıyordu → tüm bloklar tersten denenir.
- Aynı komut için onay yığılması → bekleyen onay yeniden kullanılır.
- Docker yoklaması denetim günlüğünü dolduruyordu → 300 sn bastırma.
- `TestService.listRuns` `LIMIT ?` hatası → sınır doğrulaması.
- Monaco CDN'den yükleniyordu → yerel `public/monaco/vs`.
- Electron `sandbox: false` → CJS preload ile `sandbox: true`.

### Bilinen sınırlar (1.0.0)
- Windows kurulum dosyası bu depoda üretilmedi (Linux ortamı); Windows'ta `scripts\build-windows.ps1` veya CI ile üretilir.
- Kod imzalama yok.
- Otomatik güncelleme altyapısı hazır ancak yayın kanalı tanımlı değil.
- Sesli tanıma tarayıcı motoruna bağlı; çevrimdışı ortamda kullanılamayabilir.

---

## Sürüm geçmişi biçimi

- `Eklenen` — yeni özellik
- `Değişen` — davranış değişikliği
- `Düzeltilen` — hata düzeltmesi
- `Kaldırılan` — kaldırılan özellik
- `Güvenlik` — güvenlikle ilgili değişiklik

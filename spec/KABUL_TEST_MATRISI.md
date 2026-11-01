# KABUL TEST MATRİSİ — AI WORKSTATION (tek matris)

**Belge kimliği:** AWS-KABUL-1.0 · **Şartname:** AWS-SPEC-2.0 · **Uygulama:** 1.0.0
**Tarih:** 01.11.2026

> Kural: Bir özellik ancak bu matristeki **tüm** satırları geçtiğinde "tamam" sayılır.
> `[KOD]` = testi yazıldı **ve çalıştırıldı**. Boş kutu = test yok = özellik kanıtsız.

---

## 0. Çalıştırma komutları (tek doğru yol)

```bash
npx vitest run                 # birim + entegrasyon testleri
node scripts/e2e-scenario.mjs  # uçtan uca API senaryosu (37 kontrol)
node scripts/verify-release.mjs # 6 kapı: sürüm + tsc + test + vite + electron + e2e
```

**Son gerçek çıktı (01.11.2026):**

```
Test Files  20 passed (20)
     Tests  143 passed (143)
✔ Sürüm tutarlılığı (uygulama 1.0.0 · şartname 2.0)
✔ Tür denetimi (tsc --noEmit) (6.2 sn)
✔ Testler (vitest run) (5.0 sn)
✔ Arayüz derlemesi (vite build) (3.3 sn)
✔ Electron derlemesi (electron-vite build) (6.2 sn)
✔ Uçtan uca senaryo (scripts/e2e-scenario.mjs) (4.2 sn)
{"toplam": 37, "gecen": 37, "basarisiz": 0}
```

---

## 1. Test envanteri — hangi dosya neyi kanıtlıyor

| Test dosyası | Test | Kanıtladığı özellik |
| --- | --- | --- |
| `unit/approvals.test.ts` | 2 | Onay akışı, TTL, reddetme |
| `unit/command-analyzer.test.ts` | 9 | Komut risk sınıflandırması (4 seviye) |
| `unit/context.test.ts` | 7 | Akıllı bağlam toplama, token bütçesi |
| `unit/database.test.ts` | 4 | Şema kurulumu, migration, WAL |
| `unit/electron-security.test.ts` | 13 | `nodeIntegration:false`, CSP, sandbox, preload yüzeyi |
| `unit/file-service.test.ts` | 13 | Dosya oku/yaz/diff/yedek, kilit |
| `unit/parsers.test.ts` | 13 | Test çıktısı ayrıştırma (vitest/jest/tsc) |
| `unit/paths-security.test.ts` | 7 | Yol kaçışı (`..`, symlink, absolute) |
| `unit/redaction.test.ts` | 7 | Günlükte anahtar/token maskeleme |
| `unit/secrets.test.ts` | 6 | Anahtar yalnız ana süreçte, arayüze sızmaz |
| `unit/settings.test.ts` | 3 | Ayar doğrulama, varsayılanlar |
| `unit/test-service.test.ts` | 5 | Test koşumu, `not-run` ≠ `passed` |
| **`unit/test-outcome.test.ts`** | **4** | **E-48:** `TestOutcome` 6 durum, öncelik sırası |
| **`unit/chat-cancel.test.ts`** | **4** | **E-48:** iptal → `status='cancelled'`, yarım içerik korunur |
| **`unit/migration.test.ts`** | **2** | **E-48:** v1 → v2 şema yükseltmesi |
| **`unit/version.test.ts`** | **5** | **E-47:** uygulama ≠ şartname sürümü, verify kapısı |
| **`unit/release-status.test.ts`** | **5** | **E-47:** EXE/CI/imza/güncelleme ayrı ve etiketli |
| `integration/api-contract.test.ts` | 19 | 72 uç nokta sözleşmesi, acil durdurma |
| `integration/gateway.test.ts` | 10 | Gerçek HTTP, akış, yedek model, **E-48 iptal** |
| `integration/orchestrator.test.ts` | 5 | 12 adımlı iş akışı, iptal/duraklat |
| **Toplam** | **143** | **20 dosya** |

---

## 2. Uçtan uca senaryo matrisi (37 kontrol)

`node scripts/e2e-scenario.mjs` — sahte OpenAI sunucusuyla, gerçek backend üzerinden:

| Grup | Kontroller | Kapsam |
| --- | --- | --- |
| Sağlık + sürüm | 1–2 | `/api/health` ayakta; sürüm alanları |
| Sağlayıcı | 3–6 | Sağlayıcı ekle, bağlantı testi, model senkronu |
| Sohbet | 7–12 | Akış, kullanım kaydı, iptal |
| Proje + dosya | 13–15 | Proje aç, dosya oku/yaz, yol koruması |
| Onay akışı | 16–20 | Risk sınıfı, onay bekleme, reddetme |
| Terminal | 21–23 | Komut çalıştır, çıktı, risk bloğu |
| Test Merkezi | 24–28 | Test koş, sonuç ayrıştır, `not-run` dürüstlüğü |
| Acil durdurma | 29–32 | Durdur → yeni iş reddedilir → devam |
| Yedek | 33–35 | Yedek al, listele, geri yükle |
| Denetim | 36–37 | Günlük kaydı, maskeleme |

**Sonuç:** `{"toplam": 37, "gecen": 37, "basarisiz": 0}`

---

## 3. Madde 7 — Test sonucu sözleşmesi kabul matrisi

| # | Senaryo | Beklenen | Test | Durum |
| --- | --- | --- | --- | --- |
| T-7.1 | Test geçti | `passed` | `test-service.test.ts` | [KOD] |
| T-7.2 | Test başarısız | `failed` | `test-service.test.ts` | [KOD] |
| T-7.3 | Komut hiç çalışmadı | `error` + `notRunReason` | `test-outcome.test.ts` | [KOD] |
| T-7.4 | Kullanıcı iptal etti | `cancelled` / `user` | `test-outcome.test.ts` | [KOD] |
| T-7.5 | Acil durdurma | `cancelled` / `emergency-stop` | `chat-cancel.test.ts` | [KOD] |
| T-7.6 | Altyapı yok | `not-run` | `test-service.test.ts` | [KOD] |
| T-7.7 | Öncelik: cancelled > failed > error > passed | Kaynak düzeyinde sıra | `test-outcome.test.ts` | [KOD] |
| T-7.8 | İptal edilen koşu yeşil görünmez | `overall ≠ passed` | `test-outcome.test.ts` | [KOD] |
| T-7.9 | İptal edilen sohbet yanıtı kaybolmaz | `status='cancelled'`, içerik korunur | `chat-cancel.test.ts` | [KOD] |
| T-7.10 | Hatalı mesaj | `status='failed'` | `chat-cancel.test.ts` | [KOD] |
| T-7.11 | v1 DB → v2 | Kolonlar eklenir, eski satır `complete` | `migration.test.ts` | [KOD] |
| T-7.12 | İptal edilen istek yedek modele geçmez | `AbortError`, fallback yok | `gateway.test.ts` | [KOD] |
| T-7.13 | Durdurma sırasında yeni istek | `AbortError` | `gateway.test.ts` | [KOD] |
| T-7.14 | `abortedStreams` sayısı | `number` | `api-contract.test.ts` | [KOD] |
| T-7.15 | Zaman aşımı → `cancelled`/`timeout` | Ayrı neden | — | **[EKSİK]** (E-48 §5) |

---

## 4. Madde 8 — Sürüm ayrımı kabul matrisi

| # | Senaryo | Beklenen | Test | Durum |
| --- | --- | --- | --- | --- |
| T-8.1 | `APP_VERSION` = `package.json.version` | Eşit | `version.test.ts` | [KOD] |
| T-8.2 | Şartname başlığı = `SPEC_VERSION` | Eşit | `version.test.ts` | [KOD] |
| T-8.3 | İki sürüm ayrı sabit | Bağımsız | `version.test.ts` | [KOD] |
| T-8.4 | `/api/health` iki alan | `version`, `specVersion`, `specId` | `version.test.ts` + sözleşme | [KOD] |
| T-8.5 | Verify sürüm kapısı çalışır | `✔ Sürüm tutarlılığı` | `verify-release.mjs` | [KOD] |
| T-8.6 | Sürüm bozulunca kapı düşer | Çıkış kodu 1 | — | **[EKSİK]** (negatif test) |

---

## 5. Madde 9 — Dört bağımsız yayın durumu kabul matrisi

| # | Konu | Beklenen durum | Kanıt | Durum |
| --- | --- | --- | --- | --- |
| T-9.1 | Windows EXE | `[DOĞRULANMADI]` — üretilmedi, denenmedi | README §8 + `release-status.test.ts` | [KOD] (etiket doğru) |
| T-9.2 | CI iş akışı | `[DOĞRULANMADI]` — koşu yok | `.github/workflows/build-windows.yml` | [KOD] (etiket doğru) |
| T-9.3 | Kod imzalama | `[EKSİK]` — yapılandırma yok | `electron-builder.yml` taraması | [KOD] (etiket doğru) |
| T-9.4 | Otomatik güncelleme | `[EKSİK]` — `electron-updater` yok | `package.json` | [KOD] (etiket doğru) |
| T-9.5 | Dört satır ayrı, birleştirilmemiş | 4 ayrı etiket | `release-status.test.ts` | [KOD] |
| T-9.6 | EXE gerçekten kuruldu | Kurulum + açılış | Windows gerekir | **[DOĞRULANMADI]** (E-41) |

> **T-9.1…T-9.4 "KOD" demek "özellik çalışıyor" demek değildir:** testler yalnızca *etiketin doğru olduğunu* kanıtlar. Ürün yeteneği E-40/E-41/E-42 kapanınca gelir.

---

## 6. Ürün yetenekleri kabul matrisi (A-listesi — kanıtlı)

| Yetenek | Kabul kriteri | Kanıt | Durum |
| --- | --- | --- | --- |
| Türkçe arayüz, koyu tema | 14 sayfa, varsayılan koyu | `src/pages/*` | [KOD] |
| 3 sütun düzen | Sidebar + içerik + sağ ray | `layouts/` | [KOD] |
| Çoklu sağlayıcı | 10 bulut + 2 yerel adaptör | `adapters/registry.ts` | [KOD] |
| Model kataloğu çekme | `syncModels` gerçek HTTP ile | `gateway.test.ts` | [KOD] |
| Bağlantı testi | `probe()` → `available` | `gateway.test.ts` | [KOD] |
| API anahtarı sızmaz | Arayüz yanıtında anahtar yok | `secrets.test.ts` (6) | [KOD] |
| Ajan profilleri | 8 uzman + yönetici | `profiles.ts` | [KOD] |
| 12 adımlı iş akışı | Adımlar sırayla, iptal edilebilir | `orchestrator.test.ts` (5) | [KOD] |
| Onaysız uygulama yok | Risk ≥ medium → onay | `approvals.test.ts` + e2e 16–20 | [KOD] |
| Yol kaçışı koruması | `..`, symlink, absolute reddedilir | `paths-security.test.ts` (7) | [KOD] |
| Komut risk sınıflandırma | 4 seviye + gerekçe | `command-analyzer.test.ts` (9) | [KOD] |
| Dosya yazma öncesi yedek | `file_backups` kaydı | `file-service.test.ts` (13) | [KOD] |
| Test Merkezi | 10 test türü (syntax…packaging), çıktı ayrıştırma | `parsers.test.ts` (13) | [KOD] |
| `not-run` ≠ `passed` | Dürüst sonuç | `test-service.test.ts` | [KOD] |
| Acil durdurma | Durdur → yeni iş reddedilir | e2e 29–32 + `gateway.test.ts` | [KOD] |
| Denetim + maskeleme | Anahtar günlüğe yazılmaz | `redaction.test.ts` (7) | [KOD] |
| Electron güvenliği | `nodeIntegration:false`, sandbox | `electron-security.test.ts` (13) | [KOD] |
| Yerel SQLite, şema v2 | 26 tablo + migration | `database.test.ts`, `migration.test.ts` | [KOD] |
| Bulut çıkarım, GPU gerekmez | Varsayılan yol bulut | e2e 3–12 | [KOD] |
| **Puan sıralaması** | Ölçülen puana göre sıralama | — | **[EKSİK]** E-45 |
| **Windows kurulum** | Kurulur ve açılır | — | **[DOĞRULANMADI]** E-41 |
| **Otomatik güncelleme** | İmzalı paketle güncelleme | — | **[EKSİK]** E-40 |
| **Şifreli yedek** | Parolasız açılamaz | — | **[EKSİK]** E-08 |
| **RBAC** | Rol başına yetki matrisi | — | **[EKSİK]** E-06 |

---

## 7. Kayıt bazlı kabul kriterleri — nerede yazılı?

Her kaydın kendi kabul + test kriteri kendi dosyasındadır (§3 ve §4 başlıkları):

| Kayıt | Dosya | Kabul kriteri | Test kriteri |
| --- | --- | --- | --- |
| E-01…E-44 | `spec/eksikler/E-XX-*.md` | §3 | §4 |
| E-45 | `E-45-puan-siralama.md` | 5 madde | 4 madde |
| E-46 | `E-46-dokuman-iddia-denetimi.md` | 6 madde | 6 madde (2 ✔) |
| E-47 | `E-47-surum-ayrimi.md` | 6 madde | 8 madde (6 ✔) |
| E-48 | `E-48-iptal-isaretleme.md` | 8 madde | 15 madde (14 ✔) |

**Toplam kabul kriteri:** 48 kayıt × ortalama 5 = ≈240 madde. Hiçbiri "yazıldı" ile kapanmaz; kapanış **test çıktısı** ile olur.

---

## 8. Bu matrisin sınırları (dürüst beyan)

1. **Windows yolu test edilmedi.** Tüm testler Linux'ta koştu. `.exe` üretimi ve kurulumu kanıtsızdır.
2. **Gerçek sağlayıcı anahtarıyla test yok.** Testler sahte OpenAI sunucusu kullanır; gerçek faturalama, kota ve model davranışı doğrulanmadı.
3. **WSL/Docker/Playwright** sistemde yoksa ilgili testler `skipped` olur; bu "geçti" sayılmaz.
4. **Performans** ölçümleri tek makinede, tek koşu: UI etkileşim 463 ms, `/api/stats` 98 ms.
5. **Görsel regresyon yok** (E-21); ekran görüntüsü karşılaştırması yapılmadı.
6. **Erişilebilirlik testi yok** (E-03); klavye/ARIA otomatik denetlenmiyor.

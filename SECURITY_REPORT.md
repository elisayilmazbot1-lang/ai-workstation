# GÜVENLİK RAPORU — AI Workstation v1.0.0

**Tarih:** 31.10.2026 · **Sürüm:** 1.0.0 · **Hedef platform:** Windows 10/11 x64 (Electron)

Bu rapor, uygulamanın güvenlik mimarisini, uygulanan savunmaları ve **doğrulanmış** test sonuçlarını içerir. Doğrulanmamış hiçbir iddia "test edildi" olarak sunulmamıştır.

---

## 1. Tehdit modeli

| Tehdit | Varlık | Varsayım |
| --- | --- | --- |
| Ajanların kontrolsüz dosya/sistem erişimi | Dosya sistemi, kabuk | Model çıktısı **güvenilmez**; onay olmadan hiçbir yazma/çalıştırma yok |
| API anahtarı sızıntısı | Sağlayıcı hesapları | Arayüz, sohbet geçmişi, günlükler ve denetim kayıtları anahtarı görmemeli |
| Bilgi istemi enjeksiyonu | Ajan davranışı | Web sayfası/dosya içeriği talimat olarak yorumlanmamalı |
| Zamanlama (TOCTOU) | Onay mekanizması | Onaylanan içerik ile uygulanan içerik aynı olmalı |
| Yol kaçışı | Proje dışı dosyalar | `..`, sembolik bağlantı ve mutlak yol denemeleri reddedilmeli |
| Yetki yükseltme | İşletim sistemi | Kurulum `asInvoker`; yönetici yetkisi istenmez |
| Kötü niyetli web içeriği | Uygulama penceresi | Pencere ele geçirilememeli, dış gezinme engellenmeli |

---

## 2. Süreç ve pencere güvenliği (Electron)

| Ayar | Değer | Doğrulama |
| --- | --- | --- |
| `contextIsolation` | **true** | `tests/unit/electron-security.test.ts` |
| `nodeIntegration` | **false** | aynı test |
| `sandbox` | **true** (preload CJS) | aynı test |
| `webSecurity` | **true** | aynı test |
| `webviewTag` | false | kaynak denetimi |
| `allowRunningInsecureContent` | false | kaynak denetimi |
| Yeni pencere (`window.open`) | **deny** + sistem tarayıcısına yönlendirme | aynı test |
| Gezinme (`will-navigate`) | yalnızca `file://` (üretim) / `localhost` (geliştirme) | aynı test |
| İzin istekleri | beyaz liste: `media`, `clipboard-*`, `notifications` | aynı test |
| Tek örnek kilidi | `requestSingleInstanceLock` | aynı test |
| Preload yüzeyi | `invoke`, `onEvent`, `platform`, `versions` — başka hiçbir şey | aynı test |

**Preload beyaz listesi** (kaynak: `electron/preload/index.ts`):

```ts
const ALLOWED_PATH = /^\/api\/[a-zA-Z0-9\-_/:.?=&%]*$/;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
```

- Yol `/api/` ile başlamıyorsa istek reddedilir.
- `fs`, `child_process`, `shell` **hiçbir biçimde** açılmaz (test ile doğrulanır).
- Ana süreçteki `aw:http` işleyicisi yalnızca kendi yerel kaynağına (`127.0.0.1:<rastgele port>`) istek atar.

---

## 3. İçerik Güvenliği Politikası (CSP)

`index.html` içinde tanımlı:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' http://127.0.0.1:* http://localhost:* ws://localhost:*;
```

- `unsafe-eval` **yok** (test ile doğrulanır).
- Dış alan adlarına bağlantı yok; model çağrıları **ana süreçten** yapılır, arayüz hiçbir sağlayıcıya doğrudan bağlanmaz.

---

## 4. API anahtarı yaşam döngüsü

| Aşama | Uygulama |
| --- | --- |
| Kabul | Yalnızca ana süreçte (`POST /api/providers` gövdesi) |
| Saklama | `safeStorage` (Windows DPAPI) ile şifreli `secrets.vault`; anahtar dosyası ayrı |
| Kullanım | Yalnızca ilgili sağlayıcı isteğinde, ana süreçte çözülür |
| Arayüze dönüş | **Asla** — yanıtlarda `hasCredential: true/false` döner |
| Günlük/denetim | `redact()` + `redactText()` ile maskelenir |
| Sağlayıcı silme | Kasa kaydı ve sağlayıcı satırı birlikte silinir |

**Doğrulama:**
- `tests/unit/secrets.test.ts` (6 test): şifreleme, çözme, yanlış anahtar, yanıtta sızmama.
- `tests/unit/redaction.test.ts` (7 test): alan maskeleme; `tokens`/`inputTokens` gibi **ölçüm** alanlarının yanlışlıkla maskelenmemesi.
- E2E kontrol #2 ve #36: yanıt gövdesinde ve denetim kaydında anahtar yok.

**Maskeleme kalıpları** (`backend/security/redaction.ts`): `api_key`, `access_token`, `refresh_token`, `secret`, `password`, `client_secret` alanları; ayrıca `sk-…`, `sk-ant-…`, `AIza…`, `xai-…`, `hf_…`, `ghp_…`, `Bearer …` metin kalıpları.

> Not: İlk sürümde `redactDeep` her `token` içeren alanı maskeliyordu; bu, `/api/stats` yanıtını bozuyordu. Alan adı eşleşmesi tam ad üzerinden yapılacak şekilde düzeltildi (bkz. `TEST_REPORT.md` §5, hata 1).

---

## 5. Onay kapısı ve TOCTOU koruması

Yüksek riskli **her** işlem onay ister: dosya yazma/silme, kabuk komutu, Docker işlemi, tarayıcı form gönderimi.

### 5.1 Onay yaşam döngüsü
`pending` → `approved` / `rejected` / `expired` (TTL: 15 dakika komut, 30 dakika dosya).

### 5.2 İçeriğe bağlama (kritik)
Onay kaydı, üzerinde anlaşılan **içeriğin özetini** taşır:

| Onay türü | Bağlanan veri | Doğrulama |
| --- | --- | --- |
| `file-write` | `changeIds` + her değişikliğin SHA-256 içerik özeti | Uygulama anında özet yeniden hesaplanır; farklıysa `APPROVAL_REQUIRED` |
| `command` | `command` + `cwd` | Çalıştırma anında birebir karşılaştırma; farklıysa hata |

**Doğrulama:**
- E2E #17–#18: onaysız `apply` → **428 `APPROVAL_REQUIRED`**, dosya **yazılmadı**.
- `tests/unit/file-service.test.ts`: "onaydan sonra içerik değişirse yazma reddedilir (TOCTOU)".
- `tests/unit/approvals.test.ts`: "onaylanan komut yalnızca onaylanan metinle çalışır".

### 5.3 Onay yığılması
Aynı komut + dizin için bekleyen onay varsa yenisi oluşturulmaz; kullanıcıya gereksiz kart yığılmaz (`tests/unit/approvals.test.ts`).

---

## 6. Dosya sistemi güvenliği

| Savunma | Uygulama | Doğrulama |
| --- | --- | --- |
| Proje kökü sınırı | `resolveInsideRoot` — normalize + göreli yol kontrolü | `paths-security.test.ts`, E2E #8 |
| Sembolik bağlantı | `realpath` çözümlemesi; kök dışına çıkan bağlantı reddedilir | `paths-security.test.ts` |
| Boş bayt enjeksiyonu | `\0` içeren yollar reddedilir | aynı test |
| Hassas dosyalar | `.env`, `.ssh`, `id_rsa`, `credentials`, `.npmrc`, `.netrc`, `web.config` okunamaz/aranamaz | `paths-security.test.ts`, E2E #9 |
| Hassas dosyaya yazma | `recordChange` ve `write` reddeder | `file-service.test.ts` |
| Dizin dışına yazma | `../../kacak.txt` reddedilir | `file-service.test.ts` |
| Arama sızıntısı | Hassas dosyalar içerik aramasında atlanır | `file-service.test.ts` |
| Yazma öncesi yedek | `backups/` altında kopya + kayıt | `file-service.test.ts` |

---

## 7. Komut çalıştırma güvenliği

### 7.1 Risk sınıflandırması
| Seviye | Örnek | Davranış |
| --- | --- | --- |
| `low` | `dir`, `git status` | Doğrudan (ayarla otomatik onaylanabilir) |
| `medium` | `npm install`, `git commit` | Onay |
| `high` | `git push --force`, `rm -rf node_modules` | Onay + uyarı |
| `critical` | `curl … \| sh`, `rm -rf /`, disk biçimlendirme | Onay + kırmızı uyarı; ajanlar için ek gerekçe |

`tests/unit/command-analyzer.test.ts` (9 test) tüm seviyeleri ve **pipe-to-shell** kuralını doğrular. Kural, komut `|` ile bölünmeden **önce** tam metin üzerinde çalışır (bu bir hata düzeltmesidir — `TEST_REPORT.md` §5).

### 7.2 Çalıştırma kuralları
- Kabuk asla "düzeltilmez"; kullanıcı ne yazdıysa o çalışır.
- Zaman aşımı: varsayılan ayarlardan, üst sınır **10 dakika**.
- Çıktı üst sınırı: `LIMITS.maxCommandOutputBytes`, sonrası `truncated: true`.
- Çıktı **hem** yapısal maskeleme (`redact`) **hem** metin maskeleme (`redactText`) ile temizlenir.
- **Acil durdurma etkinken hiçbir komut çalışmaz** — onaylı olsa bile (E2E #30).
- `proposedBy: 'agent'` komutlar için onay eşiği daha sıkıdır.

---

## 8. Bilgi istemi enjeksiyonu savunması

| Önlem | Açıklama |
| --- | --- |
| İçerik/ talimat ayrımı | Dosya ve web içeriği "veri" olarak sarılır, talimat olarak yorumlanmaz |
| Model çıktısı = öneri | Kod/değişiklik çıktısı **otomatik uygulanmaz**; onay gerekir |
| Komut yasağı | Model çıktısından komut türetilip çalıştırılmaz; ajanların komut izni ayrı ayardır |
| Bağımsız denetim | Kod önerisi farklı model/rol tarafından incelenir (`verdict: approve/revise/reject`) |
| Dürüst doğrulama | Sonuç yalnızca gerçek test/derleme çıktısıyla "başarılı" sayılır |
| Hassas veri filtresi | Bağlama giren dosyalar hassas yol listesinden geçirilir |
| Sınırlar | Bağlam boyutu, dosya sayısı ve çıktı uzunluğu `LIMITS` ile sınırlı |

---

## 9. Ağ ve servis yüzeyi

| Öğe | Durum |
| --- | --- |
| Yerel servis bağlaması | `127.0.0.1`, **port 0** (işletim sistemi boş port atar) |
| Dışarıdan erişim | Yok — yalnızca geri döngü arayüzü |
| CORS | Yalnızca `localhost`, `127.0.0.1`, `file://`, `null` ve `*.e2b.app` (önizleme) kaynakları |
| Sağlayıcı çağrıları | Yalnızca ana süreçten; arayüzden değil |
| SSE olay akışı | Aynı kaynak; kimlik doğrulama gerektiren veri taşımaz |
| Web otomasyonu | Ayrı `persist:browser` bölümü; çerez/oturum dışa aktarımı yok |

---

## 10. Veri ve yedekleme

- Veritabanı: SQLite, WAL modu, `%APPDATA%\AIWorkstation\workstation.db`.
- Yedek: ZIP + **SHA-256 özeti**; özet yedek yanıtında döner (E2E #33–#34).
- Yedeğe anahtar kasası **varsayılan olarak girmez** (`includeSecrets: false`).
- Geri yükleme öncesi otomatik güvenlik kopyası.
- Kurulum kaldırıldığında veriler **silinmez** (kullanıcı verisi korunur).

---

## 11. Denetim ve gözlemlenebilirlik

Her onay, komut, dosya değişikliği, ajan adımı ve güvenlik olayı `audit_logs` tablosuna yazılır.
- Tüm ayrıntı alanları `redact()` ile maskelenir.
- Durum yoklamaları gibi gürültülü kayıtlar 300 saniye bastırılır (`dedupeSeconds`).
- Kayıtlar kullanıcı tarafından **Geçmiş** sayfasından görüntülenebilir.

---

## 12. Test özeti (güvenlikle ilgili)

| Test dosyası | Test | Sonuç |
| --- | --- | --- |
| `electron-security.test.ts` | 13 | ✔ |
| `paths-security.test.ts` | 7 | ✔ |
| `redaction.test.ts` | 7 | ✔ |
| `secrets.test.ts` | 6 | ✔ |
| `command-analyzer.test.ts` | 9 | ✔ |
| `approvals.test.ts` | 2 | ✔ |
| `file-service.test.ts` (onay/TOCTOU/hassas) | 13 | ✔ |
| E2E güvenlik kontrolleri (#2, #8, #9, #17–#20, #26–#30, #36) | 13 | ✔ |

Tam liste ve çalıştırma çıktısı: [`TEST_REPORT.md`](TEST_REPORT.md).

---

## 13. Bilinen sınırlar ve öneriler

| Konu | Durum | Öneri |
| --- | --- | --- |
| Kod imzalama | Yok | Kurumsal dağıtımda EV sertifikası ile imzalayın |
| Otomatik güncelleme | Altyapı hazır, kanal kapalı | Yayın kanalı + imzalı güncelleme ekleyin |
| Windows Defender | İmzasız `.exe` uyarabilir | Sertifika + SmartScreen itibarı |
| Ajan araç izinleri | Ayarlardan yönetilir | Üretimde yalnızca gerekli ajanlara komut izni verin |
| Çok kullanıcılı makine | Veriler kullanıcı hesabına bağlı | Ayrı Windows hesapları kullanın |
| Kasa taşınabilirliği | DPAPI makineye bağlı | Yeni makinede anahtarlar yeniden girilir (tasarım gereği) |

---

## 14. Sorumlu açıklama

Güvenlik açığı bildirimi: `SECURITY.md` yerine bu belgedeki "Bilinen sınırlar" bölümünü inceleyin ve bulguları proje deposunda bildirin.

**Bu raporun kapsamadığı şey:** üçüncü taraf bağımlılıklarının kendi güvenlik durumu. `npm audit` çıktısı Test Merkezi'ndeki **security** paketiyle proje bazında çalıştırılabilir.

---

## 15. Üçüncü denetim bulguları (2026-11-01)

Bu bölüm, üçüncü denetimde güvenlik yüzeyini etkileyen değişiklikleri ve **kapatılmayan** riskleri kaydeder.
Tam gerekçe ve kanıt: `spec/DENETIM_RAPORU_3.md`.

### 15.1 İzin verilenler (yeni saldırı yüzeyi — daraltıldı)

| Değişiklik | Dosya | Güvenlik değerlendirmesi |
| --- | --- | --- |
| Yeni IPC kanalı `aw:stream` | `electron/ipc/handlers.ts` | **Yalnız POST**, yalnız `/api/*` yolları (`/^\/api\//`), hedef `getBackendUrl()` ile **aynı origin** olmak zorunda (SSRF koruması `url.origin !== base` ile). Preload yalnız `{path, body}` alır; dosya sistemi/shell erişimi yok. |
| Preload `stream()` köprüsü | `electron/preload/index.ts` | Dinleyiciler akış bitince kaldırılır (`removeListener`); sızıntı yok. Yol doğrulaması ana süreçte yapılır. |
| `cpu-features` / `sshcrypto` paketten çıkarıldı | `electron-builder.yml` | Yerel ikili sayısı 3 → **1**'e indi (`better_sqlite3`, PE32+). Saldırı yüzeyi **azaldı**. Her ikisi de `try {}` ile yüklendiğinden işlev kaybı yok. |
| `base: './'` | `vite.config.ts` | Mutlak yol (`/assets/`) kaldırıldı; `file://` altında yol çözümü kısıtlandı. Yükleme davranışı **daha güvenli**. |

### 15.2 Açık riskler (kapatılmadı)

| # | Risk | Durum | Not |
| --- | --- | --- | --- |
| R-1 | **Kod imzalama yok** | **AÇIK** | `release/AI_WORKSTATION_Setup.exe` imzasız. SmartScreen/Defender uyarabilir; güncelleme zinciri doğrulanamaz. |
| R-2 | **Otomatik güncelleme test edilmedi** | **AÇIK** | `electron-updater` akışı hiç çalıştırılmadı. Güncelleme paketlerinin imza doğrulaması **kanıtlanmadı**. |
| R-3 | **Gerçek Windows'ta çalıştırılmadı** | **AÇIK** | Yalnız Wine + Linux Electron. Windows'a özgü yol/izin davranışı `[DOĞRULANMADI]`. |
| R-4 | Docker / tarayıcı köprüsü test edilmedi | **AÇIK** | `[DOĞRULANMADI]` — bu iki yüzeyin güvenlik davranışı **kanıtsız**. |
| R-5 | `safeStorage=true` yalnız Wine'da gözlendi | **AÇIK** | Anahtar şifreleme yolu (`DPAPI`) gerçek Windows'ta doğrulanmadı. |

### 15.3 Değişmeyen güvenlik özellikleri (yeniden doğrulandı)

- Yol kaçışı reddedildi — E2E kontrol #8 (`[403, 400, 404]`, içerik sızmıyor)
- Hassas dosya okuması reddedildi — E2E kontrol #9
- API anahtarı yanıtlarda/denetim kaydında görünmüyor — E2E #2 ve #37
- Onaysız dosya değişikliği reddedildi ve **diske yazılmadı** — E2E #17, #18
- Kritik komut sınıflandırıldı ve **çalıştırılmadı** — E2E #28, #29
- Acil durdurma tüm akışları kesti, **yedek sağlayıcıya 0 istek** —
  `tests/verify/emergency-stop-independent.ts` (13/13) + `tests/integration/emergency-stop-all-streams.test.ts` (4/4)
- Zaman aşımı kontrollü sonlanıyor, sistem kilitlenmiyor —
  `tests/verify/e48-timeout-independent.ts` (8/8)

---

**Güvenlik raporu sonu (v1.0.0 + üçüncü denetim).**

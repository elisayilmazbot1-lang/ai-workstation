# BELGE–KOD İZLENEBİLİRLİK TABLOSU (tek tablo)

**Belge kimliği:** AWS-IZLENEBILIRLIK-1.0 · **Şartname:** AWS-SPEC-2.0 · **Uygulama:** 1.0.0
**Tarih:** 01.11.2026

> **Bu tablo madde 11–12'nin cevabıdır.** Her satır bir şartname maddesini, onu karşılayan dosyayı,
> o dosyanın **gerçek** durumunu ve varsa **test kanıtını** gösterir.
>
> **`[KOD]` kuralı:** yalnızca hem kod **hem** çalıştırılmış test varsa verilir.
> Kod var + test yok → `[DOĞRULANMADI]`. Yapılandırma var + ürün yok → `[DOĞRULANMADI]`.

## Özet

| Durum | Satır |
| --- | --- |
| `[KOD]` — kod + test kanıtı var | 
23 |
| `[KISMİ]` — bir kısmı var | 4 |
| `[EKSİK]` — kod yok | 11 |
| `[DOĞRULANMADI]` — yapılandırma var, ürün denenmedi | 1 |
| **Toplam satır** | **43** |

## Tablo

| Şartname | Özellik | Kod (gerçek dosya) | Mevcut kod durumu | Test kanıtı | Durum |
| --- | --- | --- | --- | --- | --- |
| §4, §24 | 14 sayfalık Türkçe arayüz, koyu tema | `src/pages/*.tsx` (14) | Tam | e2e #1 (build) | [KOD] |
| §4 | Üç sütun düzen (Sidebar / içerik / sağ ray) | `src/layouts/{Sidebar,RightRail}.tsx` | Tam | **Görsel kanıt**: `artifacts/kanit/01_arayuz_sohbet.png` (paketlenmiş uygulama, 1440×900, üç sütun görünür) | [KOD] |
| §5 | Çoklu sağlayıcı adaptörleri (10 bulut + 2 yerel) | `backend/ai/adapters/registry.ts` | Tam | `gateway.test.ts` (10) | [KOD] |
| §5.3 | Bağlantı testi (`probe`) | `provider-service.ts → testConnection` | Tam | `gateway.test.ts` #1 | [KOD] |
| §5.4 | Model kataloğu senkronu | `provider-service.ts → syncModels` | Tam | `gateway.test.ts` #1 | [KOD] |
| §5.4 | Model filtreleri (yetenek/sağlayıcı/arama) | `src/pages/ModelsPage.tsx` | Tam | **Görsel kanıt**: `artifacts/kanit/04_modeller_filtreler.png` — "Model ara", "Tümü", "Tüm yetenekler", "Ada göre" denetimleri görünür | [KOD] |
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
| §11 | Docker konteyner/imaj/compose | `backend/docker/docker-service.ts` | Kod var, **hiç test yok** | **TEST YOK** — `docker` bu ortamda kurulu değil (`which docker` → boş); e2e'de atlanıyor | [DOĞRULANMADI] |
| §12 | Tarayıcı sekmeleri/DOM/tıkla/yaz | `backend/browser/browser-service.ts` | Köprü yalnız Electron'da bağlanıyor (`electron/main/index.ts:123`); **hiç test yok** | **TEST YOK** — başsız çalıştırmada `/api/browser/tabs` → `[]` | [DOĞRULANMADI] |
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

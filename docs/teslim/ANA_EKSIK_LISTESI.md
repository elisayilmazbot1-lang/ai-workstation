# ANA EKSİK LİSTESİ — AI WORKSTATION (tek kaynak)

**Belge kimliği:** AWS-EKSIK-1.0 · **Şartname:** AWS-SPEC-2.0
**Üretim tarihi:** 01.11.2026 · **Kaynak:** `spec/eksikler/E-01…E-48` (48 ayrı kayıt dosyası)
**Uygulama sürümü:** 1.0.0 · **Test durumu:** `npx vitest run` → **20 dosya / 143 test geçti** · e2e **37/37**

> Bu dosya **elle yazılmaz**: `spec/eksikler/*.md` başlıklarından üretilir. Tek bir kayıt dosyası
> eklenip bu tablo güncellenmezse `npm run verify` uyarır (E-46).

## 1. Sayılar (makinece doğrulanmış)

| Ölçü | Değer |
| --- | --- |
| Toplam kayıt | **48** |
| Numaralandırma | E-01 … E-48 · boşluk **0** · çakışma **0** |
| P1 / P2 / P3 / P4 | **16 / 20 / 8 / 4** |
| Bu denetimde kapanan | **2** (E-47, E-48) — kod + test kanıtı |
| Kısmen kapanan | **1** (E-46) |
| Açık kayıt | **45** |
| Efor dağılımı | S = 13 · M = 23 · L = 10 · XL = 2 |

## 2. Ana tablo — 48 kayıt

| No | Eksik | Modül | Öncelik | Efor | Bağımlılık | Durum | Kayıt dosyası |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | Gerçek model benchmark koşucusu | Model Merkezi | **P1** | L | providers, gateway, tests, model_measurements | `[EKSİK]` | [`E-01-benchmark.md`](eksikler/E-01-benchmark.md) |
| E-02 | React hata sınırları ve kurtarma ekranı | Arayüz | **P1** | S | src, useAppStore | `[EKSİK]` | [`E-02-error-boundary.md`](eksikler/E-02-error-boundary.md) |
| E-03 | Erişilebilirlik (klavye, ARIA, odak) | Arayüz | **P2** | M | src | `[EKSİK]` | [`E-03-erisilebilirlik.md`](eksikler/E-03-erisilebilirlik.md) |
| E-04 | Sağlayıcı kimlik bilgisi rotasyonu ve çoklu anahtar | Model Merkezi | **P2** | M | security, providers | `[EKSİK]` | [`E-04-anahtar-rotasyonu.md`](eksikler/E-04-anahtar-rotasyonu.md) |
| E-05 | Katalog önbelleği ve eskime uyarısı | Model Merkezi | **P2** | S | providers | `[EKSİK]` | [`E-05-katalog-onbellek.md`](eksikler/E-05-katalog-onbellek.md) |
| E-06 | Rol tabanlı yetkilendirme ve oturum kilidi | Güvenlik | **P1** | L | security, server, users | `[EKSİK]` | [`E-06-rbac.md`](eksikler/E-06-rbac.md) |
| E-07 | Ajan başına token ve maliyet bütçesi | Ajanlar | **P2** | M | agents, usage_events | `[EKSİK]` | [`E-07-ajan-butcesi.md`](eksikler/E-07-ajan-butcesi.md) |
| E-08 | Yedek şifreleme (AES-256-GCM + parola türetme) | Yedekleme | **P1** | M | backup, security | `[EKSİK]` | [`E-08-yedek-sifreleme.md`](eksikler/E-08-yedek-sifreleme.md) |
| E-09 | Tarayıcı senaryo kaydı/oynatma ve form akışı | Tarayıcı | **P2** | L | browser, approvals, db | `[EKSİK]` | [`E-09-tarayici-senaryo.md`](eksikler/E-09-tarayici-senaryo.md) |
| E-10 | Etkileşimli komut desteği (stdin) | Terminal | **P2** | M | terminal, approvals | `[EKSİK]` | [`E-10-etkilesimli-komut.md`](eksikler/E-10-etkilesimli-komut.md) |
| E-11 | Docker: exec, volume/network, imaj çekme ilerlemesi | Docker | **P2** | L | docker, approvals | `[EKSİK]` | [`E-11-docker-genisletme.md`](eksikler/E-11-docker-genisletme.md) |
| E-12 | Kalıcı dosya indeksi ve artımlı bağlam | Proje/Dosya | **P1** | L | files, projects, db | `[EKSİK]` | [`E-12-dosya-indeksi.md`](eksikler/E-12-dosya-indeksi.md) |
| E-13 | Whisper/bulut STT-TTS ve sesli komutlar | Ses | **P2** | M | voice, providers, security | `[EKSİK]` | [`E-13-ses-saglayici.md`](eksikler/E-13-ses-saglayici.md) |
| E-14 | Benchmark ve ölçüm geçmişi tablosu | Veritabanı | **P2** | S | db, E-01 | `[EKSİK]` | [`E-14-benchmark-tablosu.md`](eksikler/E-14-benchmark-tablosu.md) |
| E-15 | Kalıcı kilit kaydı (çoklu süreç) | Orkestrasyon | **P3** | M | db, orchestrator, E-32 | `[EKSİK]` | [`E-15-kilit-tablosu.md`](eksikler/E-15-kilit-tablosu.md) |
| E-16 | Görev şablonları | Görevler | **P3** | M | tasks, orchestrator | `[EKSİK]` | [`E-16-gorev-sablonlari.md`](eksikler/E-16-gorev-sablonlari.md) |
| E-17 | Çoklu proje bağlamı | Proje | **P3** | L | projects, files, orchestrator | `[EKSİK]` | [`E-17-coklu-proje.md`](eksikler/E-17-coklu-proje.md) |
| E-18 | Maliyet bütçesi ve uyarı eşikleri | Model/Maliyet | **P2** | S | usage_events, settings | `[EKSİK]` | [`E-18-butce-uyari.md`](eksikler/E-18-butce-uyari.md) |
| E-19 | Olay akışı telafisi (yeniden oynatma) | İzleme | **P2** | M | events, db | `[EKSİK]` | [`E-19-olay-telafisi.md`](eksikler/E-19-olay-telafisi.md) |
| E-20 | Metrik geçmişi ve grafikler | İzleme | **P3** | M | usage_events, test_runs | `[EKSİK]` | [`E-20-metrik-gecmisi.md`](eksikler/E-20-metrik-gecmisi.md) |
| E-21 | Görev öncelik kuyruğu | Görevler | **P2** | M | orchestrator, tasks | `[EKSİK]` | [`E-21-oncelik-kuyrugu.md`](eksikler/E-21-oncelik-kuyrugu.md) |
| E-22 | İmleç tabanlı sayfalama | Genel | **P1** | M | server, src | `[EKSİK]` | [`E-22-sayfalama.md`](eksikler/E-22-sayfalama.md) |
| E-23 | Yeniden deneme politikası ve zaman aşımı yapılandırması | Orkestrasyon | **P1** | M | orchestrator, settings | `[EKSİK]` | [`E-23-yeniden-deneme.md`](eksikler/E-23-yeniden-deneme.md) |
| E-24 | Test iptali, kapsam raporu, karşılaştırmalı koşu | Test | **P2** | L | tests, terminal | `[EKSİK]` | [`E-24-test-genisletme.md`](eksikler/E-24-test-genisletme.md) |
| E-25 | Veri saklama politikası, otomatik temizlik, VACUUM | Veritabanı | **P1** | M | db, settings | `[EKSİK]` | [`E-25-saklama-politikasi.md`](eksikler/E-25-saklama-politikasi.md) |
| E-26 | Yedek geri yükleme öncesi doğrulama ve geri alma | Yedekleme | **P2** | S | backup | `[EKSİK]` | [`E-26-geri-yukleme-dogrulama.md`](eksikler/E-26-geri-yukleme-dogrulama.md) |
| E-27 | Bozuk DB / disk dolu / eksik proje kurtarma | Kurtarma | **P1** | M | db, projects, electron | `[EKSİK]` | [`E-27-kurtarma-senaryolari.md`](eksikler/E-27-kurtarma-senaryolari.md) |
| E-28 | Tanılama paketi | Destek | **P2** | S | server, audit, settings | `[EKSİK]` | [`E-28-tanilama-paketi.md`](eksikler/E-28-tanilama-paketi.md) |
| E-29 | API sürümleme | Sözleşme | **P3** | S | server, shared | `[EKSİK]` | [`E-29-api-surumleme.md`](eksikler/E-29-api-surumleme.md) |
| E-30 | Mimari kural testi | Kalite | **P2** | S | tests | `[EKSİK]` | [`E-30-mimari-test.md`](eksikler/E-30-mimari-test.md) |
| E-31 | Bilgi istemi enjeksiyonu kalıp taraması | Güvenlik | **P2** | M | security, agents | `[EKSİK]` | [`E-31-enjeksiyon-taramasi.md`](eksikler/E-31-enjeksiyon-taramasi.md) |
| E-32 | Ağır işler için çocuk süreç, bellek sınırı, otomatik yeniden başlatma | Performans | **P1** | L | electron, backend | `[EKSİK]` | [`E-32-arka-plan-isler.md`](eksikler/E-32-arka-plan-isler.md) |
| E-33 | Yavaş sorgu izleme ve bellek budama | Performans | **P2** | S | db, src | `[EKSİK]` | [`E-33-performans-izleme.md`](eksikler/E-33-performans-izleme.md) |
| E-34 | routes.ts bölünmesi | Kalite | **P3** | M | server | `[EKSİK]` | [`E-34-rota-bolme.md`](eksikler/E-34-rota-bolme.md) |
| E-35 | Çoklu dil altyapısı (opsiyonel) | Arayüz | **P4** | L | src | `[EKSİK]` | [`E-35-i18n.md`](eksikler/E-35-i18n.md) |
| E-36 | Eklenti/araç kayıt sistemi | Genişletme | **P4** | XL | agents, security | `[EKSİK]` | [`E-36-eklenti-sistemi.md`](eksikler/E-36-eklenti-sistemi.md) |
| E-37 | Git entegrasyonu | Proje | **P2** | L | terminal, projects, approvals | `[EKSİK]` | [`E-37-git-entegrasyonu.md`](eksikler/E-37-git-entegrasyonu.md) |
| E-38 | Uzak proje (SSH) desteği | Proje | **P4** | XL | files, terminal | `[EKSİK]` | [`E-38-uzak-proje.md`](eksikler/E-38-uzak-proje.md) |
| E-39 | Bildirim merkezi | İzleme | **P3** | S | notifications, src | `[EKSİK]` | [`E-39-bildirim-merkezi.md`](eksikler/E-39-bildirim-merkezi.md) |
| E-40 | Otomatik güncelleme (imzalı kanal) | Dağıtım | **P1** | M | electron-builder, CI, E-42 | `[EKSİK]` | [`E-40-otomatik-guncelleme.md`](eksikler/E-40-otomatik-guncelleme.md) |
| E-41 | CI'da gerçek Windows .exe üretimi ve kurulum testleri | Dağıtım | **P1** | M | Actions, Windows, electron-builder | `[EKSİK]` | [`E-41-ci-windows-uretimi.md`](eksikler/E-41-ci-windows-uretimi.md) |
| E-42 | Kod imzalama hattı | Dağıtım | **P2** | M | sertifika, electron-builder | `[EKSİK]` | [`E-42-kod-imzalama.md`](eksikler/E-42-kod-imzalama.md) |
| E-43 | Sessiz kurulum ve kurumsal dağıtım | Dağıtım | **P3** | S | nsis | `[EKSİK]` | [`E-43-kurumsal-dagitim.md`](eksikler/E-43-kurumsal-dagitim.md) |
| E-44 | Yerel kullanım telemetrisi (isteğe bağlı) | İzleme | **P4** | M | usage_events, settings | `[EKSİK]` | [`E-44-telemetri.md`](eksikler/E-44-telemetri.md) |
| E-45 | Model puanına göre sıralama (arayüz) ve ölçüm kaydı bağlantısı | Model Merkezi / Arayüz | **P1** | S | E-01 (benchmark koşucusu), provider-service, ModelsPage | `[EKSİK]` | [`E-45-puan-siralama.md`](eksikler/E-45-puan-siralama.md) |
| E-46 | Doküman iddia denetimi (belge–kod kanıt kapısı) | Süreç / Kalite | **P1** | M | `scripts/verify-release.mjs`, `spec/IDDIALAR.md` (yeni), `TEST_REPORT.md` | [KISMİ] | [`E-46-dokuman-iddia-denetimi.md`](eksikler/E-46-dokuman-iddia-denetimi.md) |
| E-47 | Sürüm kimliği ayrımı: uygulama sürümü ≠ şartname sürümü ≠ yayın durumu | Süreç / Dağıtım | **P1** | S | `shared/constants.ts`, `package.json`, `/api/health`, `scripts/verify-release.mjs`, E-46 | **[KOD]** | [`E-47-surum-ayrimi.md`](eksikler/E-47-surum-ayrimi.md) |
| E-48 | İptal işaretleme: test ve sohbet sonuçlarında `cancelled` durumu | Test Merkezi / Sohbet / Güvenlik | **P1** | M | `shared/types/runtime.ts`, `backend/testing/test-service.ts`, `backend/ai/chat-service.ts`, `backend/ai/gateway.ts`, `backend/database/schema.ts` | **[KOD]** | [`E-48-iptal-isaretleme.md`](eksikler/E-48-iptal-isaretleme.md) |

## 3. Durum etiketlerinin anlamı

| Etiket | Anlam | Bu denetimdeki kullanım |
| --- | --- | --- |
| **[KOD]** | Kodu yazıldı **ve** testi geçti; kanıt dosya:satır + test adı olarak gösterilebilir | Yalnızca E-47 ve E-48 |
| [KISMİ] | Bir kısmı kodda var, kalanı açık | E-46 (kapı var, iddia tablosu yok) |
| `[EKSİK]` | Kodda yok | 45 kayıt |
| [DOĞRULANMADI] | Yapılandırma var ama hiç çalıştırılmadı/denenmedi | Windows EXE, CI koşusu |

**Kural:** Bir kayıt, kabul kriterlerinin **tamamı** testle kanıtlanmadan `[KOD]` olamaz. "Derleniyor" veya "yazıldı" yeterli değildir.

## 4. Bu denetimde kapanan kayıtların kanıtı

| Kayıt | Ne yapıldı | Kanıt (dosya:satır / test) |
| --- | --- | --- |
| **E-47** | Şartname sürümü uygulama sürümünden ayrıldı; `/api/health` iki alan döner; `verify-release.mjs` sürüm kapısı eklendi; README'de EXE/CI/imza/güncelleme **dört ayrı satır** | `shared/constants.ts:8-24` · `backend/server/routes.ts` health bloğu · `scripts/verify-release.mjs → checkVersions()` · `tests/unit/version.test.ts` (5) · `tests/unit/release-status.test.ts` (5) |
| **E-48** | `TestOutcome` 6 duruma çıkarıldı; `cancelled`/`error` ayrıldı; sohbet iptali `status='cancelled'` olarak kaydedilir; acil durdurma tüm model akışlarını iptal eder; şema v2 migration | `shared/types/runtime.ts:185-195` · `backend/testing/test-service.ts` (parseSuite + overall) · `backend/ai/chat-service.ts:134-176` · `backend/ai/gateway.ts → abortAll/resume` · `tests/unit/test-outcome.test.ts` (4) · `tests/unit/chat-cancel.test.ts` (4) · `tests/unit/migration.test.ts` (2) · `tests/integration/gateway.test.ts` (+1) |
| **E-46** (kısmi) | Sürüm tutarlılığı + yayın durumu kapıları kodlandı; iddia eşleme tablosu (`spec/IDDIALAR.md`) henüz yok | `scripts/verify-release.mjs` · `tests/unit/version.test.ts` · `tests/unit/release-status.test.ts` |

## 5. Öncelik sırasına göre açık işler (P1 — 14 açık)

| No | Eksik | Neden P1 |
| --- | --- | --- |
| E-01 | Gerçek model benchmark koşucusu | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-02 | React hata sınırları ve kurtarma ekranı | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-06 | Rol tabanlı yetkilendirme ve oturum kilidi | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-08 | Yedek şifreleme (AES-256-GCM + parola türetme) | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-12 | Kalıcı dosya indeksi ve artımlı bağlam | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-22 | İmleç tabanlı sayfalama | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-23 | Yeniden deneme politikası ve zaman aşımı yapılandırması | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-25 | Veri saklama politikası, otomatik temizlik, VACUUM | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-27 | Bozuk DB / disk dolu / eksik proje kurtarma | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-32 | Ağır işler için çocuk süreç, bellek sınırı, otomatik yeniden başlatma | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-40 | Otomatik güncelleme (imzalı kanal) | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-41 | CI'da gerçek Windows .exe üretimi ve kurulum testleri | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-45 | Model puanına göre sıralama (arayüz) ve ölçüm kaydı bağlantısı | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |
| E-46 | Doküman iddia denetimi (belge–kod kanıt kapısı) | Üretim engelleyici — güvenlik, veri kaybı veya vaat edilip çalışmayan özellik |

## 6. Bakım kuralı

1. Yeni eksik → yeni `E-XX-*.md` dosyası (ASCII ad) + bu tabloya satır.
2. Kayıt kapanınca durum `[KOD]` olur **ve** kanıt sütunu doldurulur.
3. Sayılar bu dosyada **hesaplanır**, elle yazılmaz (bkz. `scripts/gen-gap-list.mjs`).

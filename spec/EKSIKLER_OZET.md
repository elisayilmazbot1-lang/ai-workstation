# EKSİK KAYITLARI — ÖZET TABLO

**Kaynak:** `spec/eksikler/*.md` (bu dosya o dosyalardan üretilir, elle yazılmaz)
**Toplam:** 48 kayıt · **P1/P2/P3/P4:** 16/20/8/4
**Şartname:** AWS-SPEC-2.0 · **Tek ana liste:** [`ANA_EKSIK_LISTESI.md`](ANA_EKSIK_LISTESI.md)

> **Üçüncü denetim notu (2026-11-01):** Hiçbir kayıt kanıt olmadan kapatılmadı.
> Bu denetimde **0 kayıt kapatıldı**; yalnızca etiketler gerçek duruma getirildi.
> İzlenebilirlik etiketleri: `[KOD]` 29 · `[KISMİ]` 6 · `[EKSİK]` 12 · `[DOĞRULANMADI]` 6.
> Ayrıntı ve kanıt: [`DENETIM_RAPORU_3.md`](DENETIM_RAPORU_3.md)

| No | Eksik | Modül | Öncelik | Efor | Durum | Dosya |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | Gerçek model benchmark koşucusu | Model Merkezi | **P1** | L | `[EKSİK]` — uygulanmadı | [`E-01-benchmark.md`](eksikler/E-01-benchmark.md) |
| E-02 | React hata sınırları ve kurtarma ekranı | Arayüz | **P1** | S | `[EKSİK]` — uygulanmadı | [`E-02-error-boundary.md`](eksikler/E-02-error-boundary.md) |
| E-03 | Erişilebilirlik (klavye, ARIA, odak) | Arayüz | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-03-erisilebilirlik.md`](eksikler/E-03-erisilebilirlik.md) |
| E-04 | Sağlayıcı kimlik bilgisi rotasyonu ve çoklu anahtar | Model Merkezi | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-04-anahtar-rotasyonu.md`](eksikler/E-04-anahtar-rotasyonu.md) |
| E-05 | Katalog önbelleği ve eskime uyarısı | Model Merkezi | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-05-katalog-onbellek.md`](eksikler/E-05-katalog-onbellek.md) |
| E-06 | Rol tabanlı yetkilendirme ve oturum kilidi | Güvenlik | **P1** | L | `[EKSİK]` — uygulanmadı | [`E-06-rbac.md`](eksikler/E-06-rbac.md) |
| E-07 | Ajan başına token ve maliyet bütçesi | Ajanlar | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-07-ajan-butcesi.md`](eksikler/E-07-ajan-butcesi.md) |
| E-08 | Yedek şifreleme (AES-256-GCM + parola türetme) | Yedekleme | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-08-yedek-sifreleme.md`](eksikler/E-08-yedek-sifreleme.md) |
| E-09 | Tarayıcı senaryo kaydı/oynatma ve form akışı | Tarayıcı | **P2** | L | `[EKSİK]` — uygulanmadı | [`E-09-tarayici-senaryo.md`](eksikler/E-09-tarayici-senaryo.md) |
| E-10 | Etkileşimli komut desteği (stdin) | Terminal | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-10-etkilesimli-komut.md`](eksikler/E-10-etkilesimli-komut.md) |
| E-11 | Docker: exec, volume/network, imaj çekme ilerlemesi | Docker | **P2** | L | `[EKSİK]` — uygulanmadı | [`E-11-docker-genisletme.md`](eksikler/E-11-docker-genisletme.md) |
| E-12 | Kalıcı dosya indeksi ve artımlı bağlam | Proje/Dosya | **P1** | L | `[EKSİK]` — uygulanmadı | [`E-12-dosya-indeksi.md`](eksikler/E-12-dosya-indeksi.md) |
| E-13 | Whisper/bulut STT-TTS ve sesli komutlar | Ses | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-13-ses-saglayici.md`](eksikler/E-13-ses-saglayici.md) |
| E-14 | Benchmark ve ölçüm geçmişi tablosu | Veritabanı | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-14-benchmark-tablosu.md`](eksikler/E-14-benchmark-tablosu.md) |
| E-15 | Kalıcı kilit kaydı (çoklu süreç) | Orkestrasyon | **P3** | M | `[EKSİK]` — uygulanmadı | [`E-15-kilit-tablosu.md`](eksikler/E-15-kilit-tablosu.md) |
| E-16 | Görev şablonları | Görevler | **P3** | M | `[EKSİK]` — uygulanmadı | [`E-16-gorev-sablonlari.md`](eksikler/E-16-gorev-sablonlari.md) |
| E-17 | Çoklu proje bağlamı | Proje | **P3** | L | `[EKSİK]` — uygulanmadı | [`E-17-coklu-proje.md`](eksikler/E-17-coklu-proje.md) |
| E-18 | Maliyet bütçesi ve uyarı eşikleri | Model/Maliyet | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-18-butce-uyari.md`](eksikler/E-18-butce-uyari.md) |
| E-19 | Olay akışı telafisi (yeniden oynatma) | İzleme | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-19-olay-telafisi.md`](eksikler/E-19-olay-telafisi.md) |
| E-20 | Metrik geçmişi ve grafikler | İzleme | **P3** | M | `[EKSİK]` — uygulanmadı | [`E-20-metrik-gecmisi.md`](eksikler/E-20-metrik-gecmisi.md) |
| E-21 | Görev öncelik kuyruğu | Görevler | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-21-oncelik-kuyrugu.md`](eksikler/E-21-oncelik-kuyrugu.md) |
| E-22 | İmleç tabanlı sayfalama | Genel | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-22-sayfalama.md`](eksikler/E-22-sayfalama.md) |
| E-23 | Yeniden deneme politikası ve zaman aşımı yapılandırması | Orkestrasyon | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-23-yeniden-deneme.md`](eksikler/E-23-yeniden-deneme.md) |
| E-24 | Test iptali, kapsam raporu, karşılaştırmalı koşu | Test | **P2** | L | `[EKSİK]` — uygulanmadı | [`E-24-test-genisletme.md`](eksikler/E-24-test-genisletme.md) |
| E-25 | Veri saklama politikası, otomatik temizlik, VACUUM | Veritabanı | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-25-saklama-politikasi.md`](eksikler/E-25-saklama-politikasi.md) |
| E-26 | Yedek geri yükleme öncesi doğrulama ve geri alma | Yedekleme | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-26-geri-yukleme-dogrulama.md`](eksikler/E-26-geri-yukleme-dogrulama.md) |
| E-27 | Bozuk DB / disk dolu / eksik proje kurtarma | Kurtarma | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-27-kurtarma-senaryolari.md`](eksikler/E-27-kurtarma-senaryolari.md) |
| E-28 | Tanılama paketi | Destek | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-28-tanilama-paketi.md`](eksikler/E-28-tanilama-paketi.md) |
| E-29 | API sürümleme | Sözleşme | **P3** | S | `[EKSİK]` — uygulanmadı | [`E-29-api-surumleme.md`](eksikler/E-29-api-surumleme.md) |
| E-30 | Mimari kural testi | Kalite | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-30-mimari-test.md`](eksikler/E-30-mimari-test.md) |
| E-31 | Bilgi istemi enjeksiyonu kalıp taraması | Güvenlik | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-31-enjeksiyon-taramasi.md`](eksikler/E-31-enjeksiyon-taramasi.md) |
| E-32 | Ağır işler için çocuk süreç, bellek sınırı, otomatik yeniden başlatma | Performans | **P1** | L | `[EKSİK]` — uygulanmadı | [`E-32-arka-plan-isler.md`](eksikler/E-32-arka-plan-isler.md) |
| E-33 | Yavaş sorgu izleme ve bellek budama | Performans | **P2** | S | `[EKSİK]` — uygulanmadı | [`E-33-performans-izleme.md`](eksikler/E-33-performans-izleme.md) |
| E-34 | routes.ts bölünmesi | Kalite | **P3** | M | `[EKSİK]` — uygulanmadı | [`E-34-rota-bolme.md`](eksikler/E-34-rota-bolme.md) |
| E-35 | Çoklu dil altyapısı (opsiyonel) | Arayüz | **P4** | L | `[EKSİK]` — uygulanmadı | [`E-35-i18n.md`](eksikler/E-35-i18n.md) |
| E-36 | Eklenti/araç kayıt sistemi | Genişletme | **P4** | XL | `[EKSİK]` — uygulanmadı | [`E-36-eklenti-sistemi.md`](eksikler/E-36-eklenti-sistemi.md) |
| E-37 | Git entegrasyonu | Proje | **P2** | L | `[EKSİK]` — uygulanmadı | [`E-37-git-entegrasyonu.md`](eksikler/E-37-git-entegrasyonu.md) |
| E-38 | Uzak proje (SSH) desteği | Proje | **P4** | XL | `[EKSİK]` — uygulanmadı | [`E-38-uzak-proje.md`](eksikler/E-38-uzak-proje.md) |
| E-39 | Bildirim merkezi | İzleme | **P3** | S | `[EKSİK]` — uygulanmadı | [`E-39-bildirim-merkezi.md`](eksikler/E-39-bildirim-merkezi.md) |
| E-40 | Otomatik güncelleme (imzalı kanal) | Dağıtım | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-40-otomatik-guncelleme.md`](eksikler/E-40-otomatik-guncelleme.md) |
| E-41 | CI'da gerçek Windows .exe üretimi ve kurulum testleri | Dağıtım | **P1** | M | `[EKSİK]` — uygulanmadı | [`E-41-ci-windows-uretimi.md`](eksikler/E-41-ci-windows-uretimi.md) |
| E-42 | Kod imzalama hattı | Dağıtım | **P2** | M | `[EKSİK]` — uygulanmadı | [`E-42-kod-imzalama.md`](eksikler/E-42-kod-imzalama.md) |
| E-43 | Sessiz kurulum ve kurumsal dağıtım | Dağıtım | **P3** | S | `[EKSİK]` — uygulanmadı | [`E-43-kurumsal-dagitim.md`](eksikler/E-43-kurumsal-dagitim.md) |
| E-44 | Yerel kullanım telemetrisi (isteğe bağlı) | İzleme | **P4** | M | `[EKSİK]` — uygulanmadı | [`E-44-telemetri.md`](eksikler/E-44-telemetri.md) |
| E-45 | Model puanına göre sıralama (arayüz) ve ölçüm kaydı bağlantısı | Model Merkezi / Arayüz | **P1** | S | `[EKSİK]` — denetimde tespit edildi | [`E-45-puan-siralama.md`](eksikler/E-45-puan-siralama.md) |
| E-46 | Doküman iddia denetimi (belge–kod kanıt kapısı) | Süreç / Kalite | **P1** | M | `[KISMİ]` — sürüm kapısı **kodlandı ve test edildi**; iddia eşleme tablosu **yok** | [`E-46-dokuman-iddia-denetimi.md`](eksikler/E-46-dokuman-iddia-denetimi.md) |
| E-47 | Sürüm kimliği ayrımı: uygulama sürümü ≠ şartname sürümü ≠ yayın durumu | Süreç / Dağıtım | **P1** | S | **`[KOD]`** — uygulandı, `npm run verify` kapısı + `tests/unit/version.test.ts` ve `tests/unit/release-status.test.ts` ile kilitli | [`E-47-surum-ayrimi.md`](eksikler/E-47-surum-ayrimi.md) |
| E-48 | İptal işaretleme: test ve sohbet sonuçlarında `cancelled` durumu | Test Merkezi / Sohbet / Güvenlik | **P1** | M | **`[KOD]`** — uygulandı ve test edildi (9 yeni test) | [`E-48-iptal-isaretleme.md`](eksikler/E-48-iptal-isaretleme.md) |

> Bu tablo **ikincil**dir. Karar ve plan için `ANA_EKSIK_LISTESI.md` + `YOL_HARITASI.md` kullanılır.
> Tutarlılık `node scripts/check-spec-consistency.mjs` ile denetlenir.
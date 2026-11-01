# YOL HARİTASI — AI WORKSTATION (tek, tutarlı plan)

**Belge kimliği:** AWS-YOLHARITASI-1.0 · **Şartname:** AWS-SPEC-2.0 · **Uygulama:** 1.0.0
**Tarih:** 01.11.2026 · **Kaynak:** `spec/ANA_EKSIK_LISTESI.md` (48 kayıt)

> Bu yol haritası **48 kaydın tamamını** kapsar ve her kayıt **tam olarak bir** aşamada yer alır
> (makinece doğrulandı: §5). Takvim tahminleri **efor toplamına** dayanır, vaat değildir.

---

## 1. Durum özeti — neredeyiz?

| Ölçü | Değer | Kanıt |
| --- | --- | --- |
| Çalışan modül | 8 ana modül (14 sayfa, 74 uç nokta, 26 tablo) | `npm run verify` 6/6 ✔ |
| Otomatik test | **143 test / 20 dosya geçti** | `npx vitest run` çıktısı |
| Uçtan uca kontrol | **37 / 37 geçti** | `node scripts/e2e-scenario.mjs` |
| Açık kayıt | **45** (P1 = 14, P2 = 20, P3 = 8, P4 = 3 açık) | `spec/ANA_EKSIK_LISTESI.md` |
| Windows `.exe` | **Üretilmedi, denenmedi** | `[DOĞRULANMADI]` |
| Kod imzalama / otomatik güncelleme | **Yok** | `[EKSİK]` |

**Tek cümlelik dürüst durum:** Ürün Linux üzerinde çalışıyor, sohbet/ajan/dosya/terminal/test akışları testlerle kanıtlı; Windows dağıtımı ve 14 P1 eksik üretim öncesi kapatılmalı.

---

## 2. Aşama 0 — Bu denetimde kapananlar (tamamlandı)

| Kayıt | Ne yapıldı | Kanıt |
| --- | --- | --- |
| **E-47** Sürüm ayrımı | `APP_VERSION` (1.0.0) ≠ `SPEC_VERSION` (2.0); `/api/health` iki alan; `verify-release.mjs` sürüm kapısı; README'de **4 bağımsız yayın satırı** | `version.test.ts` (5) · `release-status.test.ts` (5) · `✔ Sürüm tutarlılığı (uygulama 1.0.0 · şartname 2.0)` |
| **E-48** İptal işaretleme | `TestOutcome` 6 durum; `cancelled`/`error` ayrı; sohbet iptali `status='cancelled'` + yarım içerik; acil durdurma tüm model akışlarını iptal eder; şema v2 migration | `test-outcome.test.ts` (4) · `chat-cancel.test.ts` (4) · `migration.test.ts` (2) · gateway +1 |
| **E-46** İddia denetimi (kısmi) | Sürüm + yayın durumu kapıları kodda | `verify-release.mjs`, iki test dosyası |

**Kural:** Bu üç satır dışında hiçbir kayıt `[KOD]` değildir. "Yazıldı" ≠ "kapandı".

---

## 3. Aşamalar

### Aşama 1 — Güvenlik ve veri bütünlüğü (≈2 hafta)

| Kayıt | İş | Neden önce? |
| --- | --- | --- |
| **E-06** | Rol tabanlı yetkilendirme + oturum kilidi | 9 rol tanımlı ama uygulanmıyor; çok kullanıcılı kullanımda veri sızıntısı |
| **E-08** | Yedek şifreleme (AES-256-GCM + parola türetme) | Yedek düz ZIP; "şifreli yedek" iddiası geri çekildi |
| **E-27** | Veri saklama ve otomatik temizlik | Denetim günlüğü/olay tablosu sınırsız büyüyor |
| **E-25** | Kurtarma prosedürü (bozuk DB, yarım yedek) | Veri kaybı riski |
| **E-31** | Bilgi istemi enjeksiyonu kalıp taraması | Ajan çıktısı komuta dönüşebiliyor |

**Çıkış kriteri:** Yedek dosyası parolasız açılamaz; RBAC testleri rol başına menü/uç nokta matrisini doğrular; enjeksiyon kalıbı yakalanınca onay istenir.

### Aşama 2 — Üretim engelleyici boşluklar (≈3–4 hafta)

| Kayıt | İş | Bağımlılık |
| --- | --- | --- |
| **E-01** | Gerçek benchmark koşucusu + `recordMeasurement()` bağlantısı | E-14 |
| **E-45** | Puan sıralaması arayüzü (E-01'in verisiyle) | E-01 |
| **E-12** | Kalıcı dosya indeksi (`project_files` yazımı) + artımlı bağlam | — |
| **E-22** | Sayfalama (büyük listeler) | E-12 |
| **E-23** | Yeniden deneme (retry) + üstel geri çekilme | — |
| **E-32** | Ağır işler için çocuk süreç + bellek sınırı + otomatik yeniden başlatma | E-15 |
| **E-40** | Otomatik güncelleme (imzalı kanal) | E-42, E-41 |
| **E-41** | CI'da gerçek Windows `.exe` + K1–K10 kurulum testleri | E-42 |

**Çıkış kriteri:** Benchmark koşusu puanı doldurur ve sıralama değişir; Windows runner'da üretilen `.exe` kurulup açılır ve K1–K10 geçer; güncelleme imzalı paketle çalışır.

> **Not:** E-41 kapanmadan hiçbir belgede "Windows'ta çalışıyor" yazılamaz.

### Aşama 3 — İşlevsel genişleme (≈6–8 hafta)

| Kayıt | İş |
| --- | --- |
| E-02 | React hata sınırları ve kurtarma ekranı |
| E-04 | Sağlayıcı kimlik bilgisi rotasyonu, çoklu anahtar |
| E-05 | Katalog önbelleği + eskime uyarısı |
| E-07 | Ajan başına token/maliyet bütçesi |
| E-09 | Tarayıcı senaryo kaydı/oynatma |
| E-10 | Etkileşimli komut (stdin) desteği |
| E-11 | Docker exec/volume/network, imaj çekme ilerlemesi |
| E-13 | Whisper/bulut STT-TTS, sesli komutlar |
| E-18 | Maliyet bütçesi ve uyarı eşikleri |
| E-19 | Olay akışı telafisi (yeniden oynatma) |
| E-20 | Metrik geçmişi ve grafikler |
| E-21 | Görsel regresyon testleri |
| E-24 | Test iptali/kapsam/karşılaştırma (E-48 ile temel atıldı) |
| E-26 | Bildirim kanalları (e-posta/webhook) |
| E-28 | Ajan hafızası (proje bazlı bilgi kartları) |
| E-37 | Git entegrasyonu (commit/branch/diff) |

### Aşama 4 — Kalite ve bakım (≈3–4 hafta)

| Kayıt | İş |
| --- | --- |
| E-03 | Erişilebilirlik (klavye, ARIA, odak) |
| E-14 | Benchmark/ölçüm geçmişi tablosu |
| E-15 | Kalıcı kilit kaydı (çoklu süreç) |
| E-16 | Görev şablonları |
| E-17 | Çoklu proje bağlamı |
| E-29 | Denetim günlüğü dışa aktarma (CSV/JSON) |
| E-30 | Kurulum sihirbazı iyileştirmeleri |
| E-33 | Yavaş sorgu izleme + bellek budama |
| E-34 | `routes.ts` bölünmesi (modül başına rota dosyası) |
| E-39 | Bildirim merkezi (arayüz) |
| E-42 | Kod imzalama hattı |
| E-43 | Sessiz kurulum / kurumsal dağıtım |
| **E-46** | İddia eşleme tablosu (`spec/IDDIALAR.md`) + verify kapısı |

### Aşama 5 — Gelecek (talep bazlı)

| Kayıt | İş |
| --- | --- |
| E-35 | Çoklu dil altyapısı |
| E-36 | Eklenti/araç kayıt sistemi |
| E-38 | Uzak proje (SSH) desteği |
| E-44 | Yerel kullanım telemetrisi (isteğe bağlı) |

---

## 4. Sürüm kuralı

| Sürüm | Koşul |
| --- | --- |
| **1.0.x** (şimdi) | Hata düzeltmesi; Aşama 0 tamam |
| **1.1** | Aşama 1 tamam (güvenlik) |
| **1.2** | Aşama 2 tamam (üretim engelleyiciler + Windows EXE doğrulandı) |
| **2.0** | Aşama 3 en az %80 + Aşama 4 tamam |

**Şartname sürümü ayrıdır:** Belge her denetimde artar (`AWS-SPEC-2.1`, `3.0`…), uygulama sürümü takvimle ilerler (E-47).

---

## 5. Kapsam doğrulaması (makinece)

| Kontrol | Sonuç |
| --- | --- |
| Kayıt dosyası | 48 |
| Yol haritasında listelenen | 48 / 48 |
| İki aşamada birden olan | 0 |
| Aşama 0 (kapandı) | 2 → E-47, E-48 (E-46 kısmi, Aşama 4'te biter) |
| Aşama 1 | 5 |
| Aşama 2 | 8 |
| Aşama 3 | 16 |
| Aşama 4 | 13 |
| Aşama 5 | 4 |
| **Toplam** | **2 + 5 + 8 + 16 + 13 + 4 = 48** ✔ (Aşama 0 üç kayıttan ikisini kapatır; E-46 Aşama 4'te tamamlanır) |

---

## 6. Riskler ve gerçekçi olmayan beklentiler

| Risk | Etki | Önlem |
| --- | --- | --- |
| "Ücretsiz sınırsız model" beklentisi | Kullanıcı hayal kırıklığı | Belgelerde ücretsiz kota yalnız sağlayıcının resmî beyanıyla gösterilir |
| Windows doğrulamasının atlanması | Üretimde açılmayan kurulum | E-41 kapanışı: runner'da üretilen `.exe` indirilip kurulacak |
| Benchmark maliyeti | Kullanıcı faturası | Benchmark yalnız kullanıcı başlatınca ve onaylı model listesiyle çalışır |
| İmza sertifikası maliyeti | SmartScreen uyarısı sürer | E-42: sertifika yoksa kurulum "imzasız" olarak açıkça etiketlenir |
| 48 kaydın "hepsi bitti" sanılması | Yanlış beyan | Durum etiketi kuralı (§3, ANA_EKSIK_LISTESI) + E-46 kapısı |

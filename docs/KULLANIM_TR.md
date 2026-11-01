# AI Workstation — Kullanım Kılavuzu (Türkçe)

Bu belge, günlük iş akışlarını ekran ekran anlatır. Kurulum için bkz. [`KURULUM_TR.md`](KURULUM_TR.md).
Ekran görüntüleri: [`ekranlar/`](ekranlar/) — 14 sayfanın tamamı gerçek uygulamadan alınmıştır.

İçindekiler
1. [Ekran düzeni](#1-ekran-düzeni)
2. [Sohbet ve komutlar](#2-sohbet-ve-komutlar)
3. [Çok ajanlı görev akışı](#3-çok-ajanlı-görev-akışı-12-adım)
4. [Model seçimi ve maliyet](#4-model-seçimi-ve-maliyet)
5. [Kod değişikliklerini onaylama](#5-kod-değişikliklerini-onaylama)
6. [Terminal ve risk sınıfları](#6-terminal-ve-risk-sınıfları)
7. [Docker](#7-docker)
8. [Tarayıcı otomasyonu](#8-tarayıcı-otomasyonu)
9. [Test Merkezi](#9-test-merkezi)
10. [Sesli iletişim](#10-sesli-iletişim)
11. [Acil durdurma](#11-acil-durdurma)
12. [Sorun giderme](#12-sık-karşılaşılan-sorunlar)

---

## 1. Ekran düzeni

```
┌───────────────────────────────────────────────────────────────────────┐
│ Üst çubuk: proje seçici · model seçici · ACİL DURDUR · bildirim       │
├────────────┬──────────────────────────────────────┬───────────────────┤
│ Sol menü   │ Ana çalışma alanı                    │ Sağ ray           │
│ 14 sayfa   │ (seçili sayfanın içeriği)            │ canlı görev,      │
│            │                                      │ ajanlar, onaylar, │
│            │                                      │ maliyet, model    │
├────────────┴──────────────────────────────────────┴───────────────────┤
│ Alt durum çubuğu: proje · model · durum · servis · sürüm              │
└───────────────────────────────────────────────────────────────────────┘
```

**Sağ ray** her sayfada görünür ve üç kritik bilgiyi canlı tutar:
- **Canlı görev** — çalışan görevin adımı ve yüzdesi,
- **Onay bekleyen** — sayısı ve hızlı onay/red düğmeleri,
- **Kullanım ve maliyet** — bugünkü token, tahmini maliyet, sağlayıcı sağlığı.

---

## 2. Sohbet ve komutlar

**Sohbet** ekranı varsayılan giriş noktasıdır.

| Girdi | Davranış |
| --- | --- |
| `merhaba` | Seçili modelle akışlı sohbet yanıtı |
| `/görev Yeni bir giriş ekranı ekle` | Çok ajanlı görev başlatır (plan → adımlar → rapor) |
| `/analiz` | Aktif projeyi tarar, mimari/risk özeti çıkarır |
| `/test` | Test Merkezi'ndeki testleri çalıştırır ve sonucu özetler |

- `Enter` gönderir, `Shift+Enter` yeni satır açar.
- Asistan balonundaki 🔊 düğmesi yanıtı sesli okur (ses etkinse).
- 🎤 düğmesi mikrofonu açar; söyledikleriniz metne dönüşüp kutuya eklenir.
- Yanıtların altında **model adı** ve **token** bilgisi görünür.

> Sohbet geçmişi yerel veritabanına yazılır. API anahtarları hiçbir zaman sohbet geçmişine kaydedilmez; kullanıcı anahtar yapıştırırsa maskeleme devreye girer.

---

## 3. Çok ajanlı görev akışı (12 adım)

`/görev` yazdığınızda Yönetici Ajan devreye girer ve şu akışı yürütür:

| # | Adım | Yapan | Not |
| --- | --- | --- | --- |
| 1 | Talebi anlama | Yönetici | Kapsam ve kısıtlar çıkarılır |
| 2 | Bağlam toplama | Yönetici | Proje ağacı, ilgili dosyalar (akıllı bağlam) |
| 3 | Plan oluşturma | Yönetici | JSON plan; rol/bağımlılık/dosya eşlemesi |
| 4 | Plan doğrulama | Yönetici | Döngü ve çakışma kontrolü |
| 5 | Araştırma (gerekirse) | Araştırma Ajanı | Belgeler, API imzaları |
| 6 | Mimari karar | Mimar Ajanı | Dosya/modül seçimi |
| 7 | Kodlama | Kodlama Ajanı | Değişiklik önerisi üretir (**uygulamaz**) |
| 8 | Bağımsız inceleme | Güvenlik/Test | Farklı model önerilir; sonuç `verdict` |
| 9 | Test/derleme | Test Ajanı | Gerçek komut çıktısı; `not-run` ayrı gösterilir |
| 10 | Rapor | Yönetici | Tamamlandı / kısmi / başarısız |
| 11 | Onay | **Siz** | Dosya yazımı ve komutlar için onay kuyruğu |
| 12 | Uygulama ve kayıt | Sistem | Onay sonrası yazım, yedek, denetim kaydı |

**Durumlar:** `planning` → `running` → `awaiting-approval` → `completed` / `partial` / `failed` / `cancelled` / `paused`.

Görevler sayfasından: **Duraklat**, **Devam et**, **İptal**, **Yeniden çalıştır**.

> "Kısmi" sonucu, adımların çoğu tamamlandı ama testler çalıştırılamadı veya bir inceleme itiraz etti anlamına gelir. Nihai raporda hangi doğrulamanın eksik kaldığı tek tek yazılır — bu bilgi gizlenmez.

---

## 4. Model seçimi ve maliyet

**Yapay Zekâ Modelleri** sayfasında:

- **Filtreler:** yetenek (kodlama, görsel, araç kullanımı, uzun bağlam), ücretsiz katman, sağlayıcı, arama.
- **Sıralama:** ad, bağlam penceresi, giriş/çıkış fiyatı. Puan sıralaması **henüz kullanıma açık değil** (`spec/eksikler/E-45-puan-siralama.md`).
- **Model kartı:** bağlam, fiyat, yetenekler, sağlık durumu.

**Ücretsiz etiketi kuralı:** yalnızca sağlayıcının resmî olarak duyurduğu ücretsiz katman "Ücretsiz" olarak işaretlenir. Doğrulanmamış modeller **"Doğrulanmadı"** etiketiyle gösterilir ve ücretsiz sayılmaz.

**Maliyet:** her çağrıda token sayısı ve tahmini tutar hesaplanır; sağ raydaki **Kullanım ve Maliyet** panelinde görünür. Fiyat bilgisi sağlayıcı kataloğundan gelir; bilinmeyen modelde `—` gösterilir (uydurulmaz).

---

## 5. Kod değişikliklerini onaylama

Ajanlar dosyaları **doğrudan değiştirmez**; öneri üretir.

1. **Kod Editörü** sayfasını açın.
2. Soldaki listede `proposed` durumundaki değişiklikleri seçin.
3. Sağda birleşik diff görünümünü inceleyin (`+` yeşil, `-` kırmızı).
4. **Uygula** → dosya yazılır, önceki hâli `backups\` altına kaydedilir.
5. **Geri al** → son uygulanan değişiklik geri alınır.

> Aynı dosyaya iki ajan aynı anda yazmaya çalışırsa kilit mekanizması ikinciyi bekletir; çakışma raporlanır. Onaysız hiçbir yazma işlemi yapılmaz.

---

## 6. Terminal ve risk sınıfları

**Terminal** sayfasında kabuğu seçin: **PowerShell**, **PowerShell 7 (pwsh)**, **CMD**, **WSL**, **Git Bash**.

| Risk | Örnek | Davranış |
| --- | --- | --- |
| **Düşük** | `dir`, `git status`, `npm test` | Doğrudan çalışır |
| **Orta** | `npm install`, `git commit` | Onay istenir (tek tık) |
| **Yüksek** | `git push --force`, `rm -rf node_modules` | Onay + uyarı metni |
| **Kritik** | `| sh`, `rm -rf /`, `format`, disk silme | Onay + kırmızı uyarı + gerekçe yazma |

Kurallar:
- Komutlar **değiştirilmeden** çalıştırılır; uygulama sessizce "düzeltmez".
- Çıktı 120 saniye sonra zaman aşımına uğrar; uzun işler için `timeout` kullanın.
- `Ctrl+Shift+Escape` tüm çalışan komutları sonlandırır.
- Komut geçmişi ve çıkış kodları **Geçmiş** sayfasına yazılır.

---

## 7. Docker

**Docker** sayfası dört sekme sunar:

| Sekme | İşlemler | Risk |
| --- | --- | --- |
| Konteynerler | Başlat, durdur, yeniden başlat, sil, günlükler | Durdurma: orta · Silme: yüksek |
| İmajlar | Listele, sil, çek | Silme: yüksek |
| Compose | `up`, `down`, `restart`, `logs` | `down -v`: kritik |
| Sistem | Disk kullanımı, budama | Budama: yüksek |

Docker Desktop kapalıysa sayfa açıkça **"Docker kullanılamıyor"** der ve nedenini yazar; sahte liste göstermez.

---

## 8. Tarayıcı otomasyonu

Yalnızca masaüstü uygulamasında çalışır (gömülü `WebContentsView` + Playwright).

1. Adres çubuğuna URL yazın → **Git**.
2. **Sekme ekle** ile birden fazla sayfa açın.
3. **DOM oku** → sayfanın erişilebilir metni ajana bağlam olarak verilir.
4. **Tıkla** / **Yaz** → seçici ile etkileşim; her işlem öncesi onay istenir.
5. **Ekran görüntüsü** → PNG kaydedilir.

> Bankacılık, CAPTCHA, oturum açma duvarları ve ödeme sayfalarında otomasyon **yapılmaz**. Çerez/oturum kopyalama yoktur; her sekme temiz bir profil kullanır.

---

## 9. Test Merkezi

- **Birim testleri** — proje `package.json` içindeki test betiği.
- **Tip denetimi** — `tsc --noEmit` (TypeScript projeleri).
- **Derleme** — `build` betiği.

Sonuç durumları: `passed`, `failed`, `error`, **`not-run`**.
`not-run` = "bu projede ilgili altyapı yok". Bu durum **asla geçti sayılmaz** ve görev raporunda "doğrulanmadı" olarak geçer.

---

## 10. Sesli iletişim

**Ayarlar → Ses** paneli:

| Ayar | Açıklama |
| --- | --- |
| Sesli iletişimi etkinleştir | Ana anahtar (kapalıyken mikrofon hiç açılmaz) |
| Dil | Varsayılan `tr-TR` |
| Konuşma tanıma sağlayıcısı | Tarayıcı motoru (varsayılan) · bulut STT |
| Seslendirme sağlayıcısı | Sistem sesi · bulut TTS |

Kullanım: Sohbet kutusundaki 🎤 → konuşun → metin kutuya eklenir → `Enter`.
Yanıtı dinlemek için asistan balonundaki 🔊.

> Mikrofon yalnızca siz düğmeye bastığınızda açılır, arka planda dinleme yapılmaz. Kayıtlar diske yazılmaz.

---

## 11. Acil durdurma

`Ctrl+Shift+Escape` veya üst çubuktaki kırmızı **ACİL DURDUR** düğmesi:

1. Çalışan tüm ajan adımlarını iptal eder,
2. çalışan kabuk komutlarını sonlandırır,
3. yeni komut/dosya yazma onaylarını reddeder,
4. durumu tüm ekranlara bildirir.

Durdurma durumu kalıcıdır (uygulama yeniden başlasa bile). Devam etmek için düğmeye tekrar basın; sistem "sürdürüldü" kaydını denetim günlüğüne yazar.

---

## 12. Sık karşılaşılan sorunlar

| Sorun | Neden | Çözüm |
| --- | --- | --- |
| Model listesi boş | Sağlayıcı eklenmemiş | Yapay Zekâ Modelleri → + Sağlayıcı ekle → Kataloğu çek |
| "Onay bekliyor" ama işlem yok | Onay kuyruğu sağ rayda | Sağ raydaki **Onayla** düğmesi |
| Diff boş görünüyor | Değişiklik `rejected` | Kod Editörü → yeniden üret |
| Terminal "kabuk bulunamadı" | PATH sorunu | Ayarlar → Terminal → varsayılan kabuğu değiştirin |
| Tarayıcı sekmesi açılmıyor | Tarayıcıda çalışıyorsunuz | Masaüstü uygulamasını kullanın |
| Görev "kısmi" bitti | Test altyapısı yok | Nihai raporda hangi adımın eksik olduğunu okuyun |
| Token/maliyet 0 görünüyor | Sağlayıcı kullanım bilgisi vermiyor | Fiyat tablosu boşsa `—` normaldir |

---

**Güvenlik ilkeleri:** bkz. [`SECURITY_REPORT.md`](../SECURITY_REPORT.md) · **Değişiklikler:** [`CHANGELOG.md`](../CHANGELOG.md)

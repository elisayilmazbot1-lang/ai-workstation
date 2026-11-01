# E-46 — Doküman iddia denetimi (belge–kod kanıt kapısı)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-46 |
| **Modül** | Süreç / Kalite |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | `scripts/verify-release.mjs`, `spec/IDDIALAR.md` (yeni), `TEST_REPORT.md` |
| **Durum** | `[KISMİ]` — sürüm kapısı **kodlandı ve test edildi**; iddia eşleme tablosu **yok** |
| **Şartname maddesi** | §29 / §32.1 / §30 A1 |

## 1. Neden gerekli

İkinci denetimin en uzun süren işi, "belgede yazıyor ama kodda yok" maddelerini **elle** bulmaktı (§32 U1–U10). Bu tek seferlik bir çabaydı: aynı tür uyuşmazlık bir sonraki sürümde yine sessizce oluşabilir.

Somut kanıtlar (bu denetimde):

- `README_TR.md` "gerçek test sonucuna göre sıralama" diyordu; `ModelsPage.tsx:42` yalnızca `name | cost | context` biliyordu (→ §32 U1, E-45).
- `README_TR.md` "otomatik güncelleme altyapısına hazır" diyordu; `electron-updater` `package.json`'da **yoktu** (→ §32 U6, E-40). İkinci denetimde dört ayrı durum satırına bölündü (E-47 ile).
- `docs/KULLANIM_TR.md` "yedekler şifrelenir" imasında bulunuyordu; yedek düz ZIP'ti (→ §32 U5, E-08).

Ortak örüntü: **iddia cümlesi ile onu doğrulayan komut arasında bağ yok.** Belge, testi olmayan bir cümleyi taşıyabiliyor.

## 2. Teknik uygulama

### 2.1 İddia kaydı (tek kaynak)

`spec/IDDIALAR.md` — her satır bir iddia ve onun **kanıt komutu**:

```markdown
| ID | İddia (belgede geçen cümle) | Belge | Kanıt | Durum |
| --- | --- | --- | --- | --- |
| I-001 | "133 otomatik test geçer" | README §8.1 | `npx vitest run` → `Tests 133 passed` | [KOD] |
| I-002 | "Uygulama ve şartname sürümü ayrıdır" | README §8.1 | `tests/unit/version.test.ts` | [KOD] |
| I-003 | "Sohbet iptali `cancelled` olarak işaretlenir" | §15.3 | `tests/unit/chat-cancel.test.ts` | [KOD] |
| I-004 | "Windows kurulum dosyası üretildi" | — | **kanıt yok** | [DOĞRULANMADI] |
```

Kurallar:

1. Bir iddia yalnızca **çalıştırılabilir kanıtı** varsa `[KOD]` olabilir (test adı, komut, dosya:satır).
2. Kanıt komutu **çıktısıyla** birlikte yazılır (çıktı olmadan `[KOD]` yasak).
3. Kanıtsız iddia belgede kalabilir ama `[DOĞRULANMADI]` etiketiyle ve "doğrulama adımı" cümlesiyle kalır.
4. İddia silinemez; yalnızca kanıtlanır veya etiketlenir (mevcut ürün özellikleri korunur).

### 2.2 Otomatik kapı

`scripts/verify-release.mjs` içine iki yeni kontrol eklendi/genecek:

| Kontrol | Durum | Ne yapar |
| --- | --- | --- |
| Sürüm tutarlılığı | **`[KOD]`** (bu denetimde eklendi) | `package.json.version` = `APP_VERSION`; şartname başlığı = `SPEC_VERSION`. `tests/unit/version.test.ts` bunu kilitler. |
| Yayın durumu ayrımı | **`[KOD]`** (bu denetimde eklendi) | `tests/unit/release-status.test.ts`; EXE/CI/imza/güncelleme satırlarının ayrı ve etiketli olmasını denetler. |
| İddia eşlemesi | `[EKSİK]` | `spec/IDDIALAR.md`'deki her `[KOD]` iddia için kanıt dosyasının var olması; `[DOĞRULANMADI]` sayısının raporlanması. |

Üçüncü kontrolün eklenmesi bu kaydın kapanış koşuludur (2.2'deki tablo `[EKSİK]` iken kayıt `[KISMİ]` kalır).

### 2.3 Rapor bağlantısı

- `TEST_REPORT.md`: gerçek çıktı bloğu (komut + son satırlar) korunur; özet sayı **elle** yazılmaz, `artifacts/verify-report.json`'dan alınır.
- `CHANGELOG.md`: her sürümde `[DOĞRULANMADI]` maddeleri ayrı başlık altında listelenir.

## 3. Kabul kriterleri

1. `spec/IDDIALAR.md` var ve en az 20 iddia içeriyor.
2. Her `[KOD]` iddianın yanında **çalıştırılabilir** kanıt (test adı veya komut) var.
3. `node scripts/verify-release.mjs` iddia eşlemesini denetliyor; kanıt dosyası silinen iddiada çıkış kodu 1.
4. README/docs içinde `[DOĞRULANMADI]` etiketsiz spekülatif iddia yok (elle tarama + test).
5. Denetim raporunda "kaç iddia kanıtlı / kaç kanıtsız" sayısı yer alıyor.
6. **Regresyon kilidi:** sürüm tutarlılığı ve yayın durumu testleri `npx vitest run` içinde geçiyor.

## 4. Test kriterleri

- [x] `tests/unit/version.test.ts` — sürüm ayrımı + verify kapısı varlığı (5 test) ✅
- [x] `tests/unit/release-status.test.ts` — dört yayın durumu ayrı; `electron-updater` yok; imza yapılandırması yok (5 test) ✅
- [ ] `tests/unit/claims.test.ts` — `IDDIALAR.md` ayrıştırma, kanıt dosyası varlığı, `[KOD]` sayısı
- [ ] `verify-release.mjs` — kanıtı kırık iddiayla çıkış kodu 1 (negatif test)
- [ ] Belge taraması — `[DOĞRULANMADI]` etiketsiz "hazır/çalışıyor" cümlesi kalmasın

## 5. Riskler ve dikkat edilecekler

- **Bürokrasi riski:** Her cümleyi iddia yapmak sürdürülemez. Sınır: yalnızca **yetenek/performans/güvenlik** iddiaları (pazarlama cümleleri değil).
- **Bayat kanıt:** Test adı değişince iddia sessizce kanıtsız kalır → eşleme **dosya yolu + test adı** üzerinden, satır numarası üzerinden değil.
- **Yanlış güven:** `[KOD]` etiketi "ürün eksiksiz" demek değildir; yalnızca "bu cümle kodla doğrulandı" demektir. E-kayıtları açık kaldıkça ürün eksiktir.
- **Belge şişmesi:** `IDDIALAR.md` 200 satırı geçerse bölünür; tek dosya sınırı korunur.

# KENDİ KOPYANIZI TARAYIN

Bu araç, sizdeki klasörün teslim edilen sürümle **birebir aynı** olup olmadığını söyler ve
eksik/bozuk dosyaları tek tek listeler.

**npm install gerekmez.** Yalnız Node.js 18+ yeterli.

---

## 1. Kurulum (30 saniye)

1. Şu iki dosyayı **aynı klasöre** koyun:
   ```
   tarama/
   ├── TARA.cmd              (Windows: buna çift tıkla)
   ├── ONAR.cmd
   ├── aw-scan.cjs
   ├── manifest.json
   └── SORUN_GIDERME.md
   ```

   > **Neden "FROZEN"?** Manifest, teslim ZIP'i üretildikten **sonra** donduruldu.
   > Ad, "bu dosya değiştirilmemeli" anlamına gelir: içeriği ZIP ile birebir uyumludur.

2. Node.js sürümünüzü kontrol edin:
   ```bash
   node --version      # v18.0.0 veya üzeri olmalı
   ```
   > Yoksa: https://nodejs.org (LTS sürüm)

---

## 2. Çalıştırma

### Windows — EN KOLAY: `TARA.cmd` dosyasına çift tıklayın

`TARA.cmd`, bu iki dosyayla **aynı klasörde** olmalı:
```
tarama\
├── TARA.cmd                  ← çift tıkla
├── ONAR.cmd
├── aw-scan.cjs
├── manifest.json
└── SORUN_GIDERME.md
```

Varsayılan olarak `..\AI_WORKSTATION` klasörünü tarar.
Farklı yol için: `TARA.cmd "D:\baska\yer\AI_WORKSTATION"`

Kendi kendine: Node kontrolü → dosya kontrolü → bütünlük → kod denetimi → JSON rapor.

### Windows (PowerShell veya CMD) — elle

```powershell
cd C:\Users\siz\Desktop\tarama
node aw-scan.cjs "C:\Users\siz\Downloads\AI_WORKSTATION"
```

### macOS / Linux

```bash
cd ~/tarama
node aw-scan.cjs ~/Downloads/AI_WORKSTATION
```

> **Yol boşluk içeriyorsa tırnak kullanın.**

---

## 3. Modlar

| Komut | Ne yapar |
| --- | --- |
| `node aw-scan.cjs <klasör>` | **Bütünlük taraması** — 217 dosyayı SHA-256 ile kıyaslar |
| `node aw-scan.cjs <klasör> --mode code` | **Kaynak kod denetimi** — 13 davranışsal kontrol |
| `node aw-scan.cjs <klasör> --mode all` | İkisi birlikte |
| `node aw-scan.cjs <klasör> --json rapor.json` | Sonucu JSON olarak da yazar |
| `node aw-scan.cjs --help` | Kullanım metni |

---

## 4. Çıktıyı nasıl okursunuz

### Bütünlük taraması

```
SONUÇ
  ✔ Tam eşleşen : 217/217  (%100.0)

✔ KOPYA TAM — 217 dosyanın tamamı referansla birebir aynı.
```

Sorun varsa:

```
SONUÇ
  ○ Tam eşleşen : 214/217  (%98.6)
  ✖ Eksik       : 2
  ▲ Değişmiş    : 1

EKSİK DOSYALAR (2)
  ✖ electron/ipc/handlers.ts
  ✖ src/services/api.ts

DEĞİŞMİŞ DOSYALAR (1)
  ▲ backend/ai/gateway.ts
     boyut: 12522 → 12533 | özet: abbcdb3eaea6ed29 → 405c09fde4f0ef14
```

- **Eksik** = dosya hiç yok → kopyalama yarıda kalmış
- **Değişmiş** = var ama içeriği farklı → elle düzenlenmiş veya bozulmuş
- **Fazla** = referansta olmayan dosya → hata değil, sadece bilgi

### Kaynak kod denetimi

```
✔ H-1  Vite base ayarı (file:// altında arayüz açılması)
✔ H-2  Sohbet akışı IPC köprüsü (file:// altında yanıt)
✖ E-01  recordMeasurement çağrılıyor mu
    beklenen: backend/ içinde tanım DIŞINDA en az 1 çağrı
    gerçek  : tanım:1 · çağrı:0 → İŞLEVSİZ
```

**Son satır önemli:**
```
EKSİK OLAN TARAF — 3 madde
  ● E-01 — recordMeasurement çağrılıyor mu
  ● E-12 — project_files tablosuna yazılıyor mu
  ● E-13 — sttProvider ayarı tüketiliyor mu
```

Üç madde de **bilinen ve bilerek kapatılmamış** eksiklerdir (bkz. `DENETIM_RAPORU_3.md` §6).

---

## 5. Çıkış kodları

| Kod | Anlamı |
| --- | --- |
| `0` | Her şey tam |
| `1` | Eksik/bozuk dosya veya başarısız denetim var |
| `2` | Kullanım hatası (klasör yok, geçersiz mod) |

Otomasyonda kullanmak için:
```bash
node aw-scan.cjs ./AI_WORKSTATION || echo "KOPYA EKSİK!"
```

---

## 6. Neler taranır, neler atlanır

**Taranır (217 dosya):** tüm kaynak kod (`src/`, `backend/`, `electron/`, `shared/`, `tests/`, `scripts/`), şartname (`spec/`), yapılandırma dosyaları, dokümanlar.

**Atlanır (kasten):**
| Klasör/Dosya | Neden |
| --- | --- |
| `node_modules/` | `npm ci` ile yeniden üretilir |
| `dist/`, `out/` | `npm run build` ile yeniden üretilir |
| `public/monaco/vs/` | `npm run monaco` ile yeniden üretilir |
| `release/`, `artifacts/` | Paket çıktıları |
| `*.db`, `*.map`, `*.log` | Veri/geçici dosyalar |

Yani **eksik çıkan bir dosya `node_modules` altındaysa sorun değil** — `npm ci` yeterli.

---

## 7. Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| `manifest.json bulunamadı` | İki dosya aynı klasörde olmalı |
| `Klasör bulunamadı` | Yolu tırnak içine alın; Windows'ta `\` kullanın |
| `Unexpected token 'export'` | Node.js sürümünüz 18'den eski — güncelleyin |
| Tüm dosyalar "Eksik" | Yanlış klasörü gösteriyorsunuz; içinde `package.json` olmalı |
| Fazla dosyalar görünüyor | Normal — kendi eklediğiniz dosyalar listelenir, hata sayılmaz |

> **npm / kurulum hataları için** → `SORUN_GIDERME.md` (4 hatanın ayrıntılı çözümü)
> **Ortam kontrolü için** → `ONAR.cmd` dosyasına çift tıklayın

---

## 7b. `ONAR.cmd` — ortam onarımı

`npm ci` başarısız olduğunda **`ONAR.cmd` dosyasına çift tıklayın**.
Otomatik kontrol eder:

| # | Kontrol | Ne yapar |
|---|---|---|
| 1 | Node.js sürümü | v20–v26 arası mı? Değilse ne yapmalı |
| 2 | Visual Studio C++ | Gerekli mi, yoksa uyarır |
| 3 | Boş disk | ~1,5 GB var mı |
| 4 | Kilitli `node_modules` | Electron/Node süreçlerini kapatıp siler |
| 5 | `package.json` | Doğru klasörde misiniz |

Sonunda **sıradaki adımları** yazar.

> ⚠️ `ONAR.cmd` **`node_modules` klasörünü SİLER**. Sorun yoksa çalıştırmayın.

---

## 8. İndirme sonrası tipik akış

```bash
# 1) ZIP'i açın
unzip kaynak-kod.zip -d AI_WORKSTATION

# 2) Tarayın
node aw-scan.cjs ./AI_WORKSTATION

# 3) Tam çıktıysa çalıştırın
cd AI_WORKSTATION
npm ci && npm run monaco && npm run verify
```

`npm run verify` 7 kapıyı koşar: sürüm tutarlılığı, şartname, tip denetimi, 149 test, arayüz derlemesi, Electron derlemesi, 37 E2E kontrolü.

---

## 9. Neden bu araç var

Üçüncü denetimde **5 gerçek ürün hatası** bulundu ve düzeltildi — ikisi ürünü kullanılamaz kılıyordu:

| # | Hata | Belirti |
| --- | --- | --- |
| H-1 | `vite base` ayarı yok | Arayüz **hiç açılmıyordu** (siyah pencere) |
| H-2 | Akış `file://` altında göreli fetch | Arayüzden sohbet **yanıt vermiyordu** |
| H-3 | Windows paketinde Linux `.node` | EXE Windows'ta **açılmaz** |
| H-4 | Ana süreç sourcemap | Derleme SIGKILL (bellek) |
| H-5 | "Whisper API" seçeneği işlevsiz | Kullanıcı yanıltılıyordu |

Bu araç, sizdeki kopyanın **bu düzeltmeleri gerçekten içerdiğini** doğrular.
H-1 … H-5 kontrolleri `--mode code` çıktısında tek tek görünür.

Ayrıntı: `03_raporlar/DENETIM_RAPORU_3.md`

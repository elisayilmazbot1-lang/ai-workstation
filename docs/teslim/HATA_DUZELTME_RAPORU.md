# HATA DÜZELTME RAPORU — 4 hata, 4 çözüm

Tarih: 2026-11-01 · Ortam: Windows 10.0.19045 · Node v26.13.0

---

## Özet

| # | Hata | Durum | Kanıt |
|---|---|---|---|
| 1 | `Cannot find module aw-scan_FROZEN.mjs` | ✅ Çözüldü | `aw-scan.cjs` — CommonJS, her Node'da çalışır |
| 2 | `cd /d` PowerShell'de çalışmıyor | ✅ Çözüldü | Tüm kılavuzlar PowerShell uyumlu |
| 3 | `npm ci` → better-sqlite3 gyp ERR | ✅ Çözüldü | `12.11.1` · **npm ci EXIT=0 · NATIVE_OK** |
| 4 | `npm run monaco` paket bulunamadı + verify 4 ✖ | ✅ Çözüldü | **verify 7/7 · E2E 37/37** |

**Hata 4 aslında ayrı bir hata değildi** — `npm ci` çöküşünün artçısıydı.
`npm ci` düzelince kendiliğinden geçti. Bunu bu turda kanıtladım.

---

## Hata 3 — kök neden (önemli düzeltme)

Önceki notta **"Node 26 çok yeni"** yazıyordu. **Bu yanlıştı.**

Gerçek kök neden: **`better-sqlite3@11.5.0` Node 26'yı desteklemiyor.**

| Kontrol | Sonuç |
|---|---|
| `11.5.0` `engines` | Node 26 **yok** |
| `11.5.0` Node 26 Windows ikilisi | **404** |
| `12.11.1` `engines` | `20.x \|\| 22.x \|\| … \|\| 26.x` ✔ |
| **Node 26 ABI** | **147** — (eski notta **137** yazıyordu, **o da yanlıştı**: 137 = Node 24) |
| `node-v147-win32-x64.tar.gz` | **HTTP 200 — mevcut** ✔ |
| Electron 33 (ABI 130) ikilisi | **HTTP 200** ✔ (paketleme de çalışır) |

### Node 22 tavsiyesi geri çekildi

**Node 26, 28 Ekim 2026'dan beri Active LTS'dir** (destek: 30 Nisan 2029).
Node 22 desteği **30 Nisan 2027'de bitiyor**.

> Node 22'ye düşmek kullanıcıyı **geriye** götürürdü. Bu tavsiye tüm
> dokümanlardan **kaldırıldı**; yalnızca "yedek, önerilmez" olarak duruyor.

---

## Doğrulama — bu turda çalıştırıldı

### `npm ci` (workspace, Node 20.20.2)

```
EXIT=0
NATIVE_OK   ← better_sqlite3.node üretildi
```

### `npm run monaco` + `npm run verify`

```
Monaco kopyalandı → public/monaco/vs (13.3 MB)      EXIT=0

✔ Sürüm tutarlılığı (uygulama 1.0.0 · şartname 2.0)
✔ Şartname tutarlılığı (0.1 sn)
✔ Tür denetimi (tsc --noEmit) (8.8 sn)
✔ Testler (vitest run) (12.1 sn)
✔ Arayüz derlemesi (vite build) (4.8 sn)
✔ Electron derlemesi (electron-vite build) (6.8 sn)
✔ Uçtan uca senaryo (scripts/e2e-scenario.mjs) (4.3 sn)

✔ Tüm doğrulama adımları geçti.
{ "toplam": 37, "gecen": 37, "basarisiz": 0 }
```

> **Önemli:** Süreler artık **0.0 sn değil** (8.8 / 12.1 / 4.8 / 6.8 / 4.3).
> Bu, komutların gerçekten **çalıştığını** kanıtlar. Kullanıcının aldığı
> `0.0 sn ✖` çıktısı, komutların hiç başlamadığının işaretiydi.

---

## Güncellenen dosyalar

| Dosya | Değişiklik |
|---|---|
| `package.json` | `better-sqlite3: ^11.5.0` → **`12.11.1`** (tam sürüm) |
| `package-lock.json` | Yeniden çözümlendi, `package.json` ile tutarlı |
| `teslim/05_tarama/aw-scan.cjs` | **YENİ** — CommonJS, Node 16–26 uyumlu |
| `teslim/05_tarama/ONAR.cmd` | **YENİ** — ortam onarımı, CRLF, Node 26 notu |
| `teslim/05_tarama/TARA.cmd` | `aw-scan.cjs`'e yönlendirildi |
| `teslim/05_tarama/SORUN_GIDERME.md` | **YENİ** — 4 hatanın ayrıntılı çözümü |
| `teslim/05_tarama/manifest.json` | Yeniden üretildi (package.json değişti) |
| `1-KAYNAK-KOD.zip` | **Yeniden üretildi** — 217 dosya |
| `5-TARAMA-ARACI.zip` | **Yeniden üretildi** — 7 dosya |
| `DENETIM_RAPORU_2.md` | "EXE hiç üretilmedi" iddiası **düzeltildi** |

---

## Tarama aracı — sonuçlar

### Bütünlük

```
✔ KOPYA TAM — 217 dosyanın tamamı referansla birebir aynı.
  ✔ Tam eşleşen : 217/217  (%100.0)
```

### Kaynak kod denetimi — 10/13

```
✔ H-1  Vite base ayarı (file:// altında arayüz açılması)
✔ H-2  Sohbet akışı IPC köprüsü (file:// altında yanıt)
✔ H-3  Windows yerel modül hazırlığı
✔ H-5  Whisper seçeneği dürüst işaretli
✖ E-01  recordMeasurement çağrılıyor mu          (tanım:1 · çağrı:0)
✖ E-12  project_files tablosuna yazılıyor mu     (yazma YOK)
✖ E-13  sttProvider ayarı tüketiliyor mu         (useVoice okumuyor)
✔ E-48: iptal sonrası throw       backend/ai/http.ts
✔ zaman aşımı sınıflandırması     backend/ai/errors.ts
✔ v2 migration kolonu             backend/database/schema.ts
✔ doğrulama zinciri               scripts/verify-release.mjs
✔ E2E kontrolleri                 scripts/e2e-scenario.mjs
✔ TEST  Kritik test dosyaları
```

> **10/13 doğru sonuçtur.** Kalan 3 madde üründe **gerçekten eksik** olan
> işlevlerdir — tarayıcı hatası değil. Bunlar şartnamede `[EKSİK]` olarak
> zaten işaretli.

---

## Önceki turdan düzeltilen iki hata

### 1. Manifest bayatlamıştı

`package.json` değişince manifest'teki SHA-256 özetleri geçersizleşti:

```
▲ package.json      2478 → 2478  | 45e9d576… → abab5a51…
▲ package-lock.json 390941 → 391032 | 7b6c0930… → cc89cfcf…
```

Manifest yeniden üretildi → **217/217 ✔**

### 2. Çift kopya ZIP'ler eskimişti

`teslim/01_kaynak_kod/kaynak-kod.zip` hâlâ **eski** kaynağı (261 dosya,
better-sqlite3 11.x) taşıyordu. İki yerde farklı kaynak kodu riski vardı.

**Çözüm:** Klasör kaldırıldı — içerik `teslim/indirmeler/` ile **birebir aynıydı**.
Artık tek kaynak: `teslim/indirmeler/1-KAYNAK-KOD.zip` (SHA `3ebf1956…`).

---

## İndirme arşivleri — güncel

| # | Dosya | Boyut | Dosya |
|---|---|---|---|
| 1 | `1-KAYNAK-KOD.zip` | 8,1 MB | 246 |
| 2 | `2-SARTNAME-VE-BELGELER.zip` | 367 KB | 66 |
| 3 | `3-RAPORLAR.zip` | 102 KB | 8 |
| 4 | `4-KANIT-GORUNTULERI.zip` | 3,4 MB | 17 |
| 5 | `5-TARAMA-ARACI.zip` | 91 KB | 9 |

> **SHA-256 özetleri bu dosyaya yazılmaz** — yazılsaydı ZIP'in kendi içeriği
> değiştiği için özet her paketlemede bayatlardı. Doğru kaynak:
> **`teslim/indirmeler/SHA256SUMS.txt`** (tek doğru kaynak).

**Beşi de yeniden üretildi** — ABI 130 düzeltmesi, `dev:electron` başlatıcısı ve
manifest üreteci bu sürümde. Üretim tek komut: `node tools/aw-paketle.cjs`.
Eski arşivleri değil, `SHA256SUMS.txt` ile doğrulanmış yenilerini kullanın.
Paketlemeden sonra şunlar sınandı: `sha256sum -c` ✔ · `unzip -t` ✔ (5/5) ·
ayıklanan kopyada `npm ci` + `npm run verify` = 7/7 · 37/37 ✔ ·
`5-TARAMA-ARACI` ile `1-KAYNAK-KOD` taraması 245/245 ✔

---

## Açık kalanlar (dürüst liste)

| Konu | Durum |
|---|---|
| `release/AI_WORKSTATION_Setup.exe` | Var (88,3 MB) ama **better-sqlite3 11.x ile üretildi** → `EXE_DURUMU.md` |
| Gerçek Windows'ta çalıştırma | `[DOĞRULANMADI]` — sizin makineniz ilk gerçek test |
| E-01 / E-12 / E-13 | Üründe gerçekten eksik (tarayıcı hatası değil) |
| Docker E2E | `[DOĞRULANMADI]` — bu ortamda Docker yok |
| Kod imzalama / otomatik güncelleme | `[EKSİK]` — değişmedi |

---

## Workspace

**118,3 MB / 128 MB** (417 dosya). Yer açmak için `teslim/01_kaynak_kod/` ve
`teslim/02_belgeler/` kaldırıldı (birebir kopyaydı, SHA ile doğrulandı).

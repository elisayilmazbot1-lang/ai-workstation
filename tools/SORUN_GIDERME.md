# SORUN GİDERME — Aldığınız 4 hata ve çözümleri

Tarih: 2026-11-01 · Ortam: Windows 10.0.19045 · Node v26.13.0

---

## Hata 1 — `Cannot find module ... aw-scan_FROZEN.mjs`

```
Error: Cannot find module 'C:\Users\SERVER\Desktop\al\tarama\aw-scan_FROZEN.mjs'
  code: 'MODULE_NOT_FOUND'
```

### Neden

Dosya **ya yok** ya da Node onu yükleyemedi. Node v26, `.mjs` uzantılı bir dosyayı
`require()` yoluyla çözmeye çalıştığında bu hatayı verebiliyor (Windows'ta dosya
ilişkilendirmesi veya yol çözümü bozuksa).

### Çözüm

**Yeni `aw-scan.cjs` dosyasını kullanın** — CommonJS, her Node sürümünde çalışır.

```powershell
node C:\Users\SERVER\Desktop\al\tarama\aw-scan.cjs "C:\Users\SERVER\Desktop\al\AI_WORKSTATION" --mode all
```

`aw-scan.cjs` ve `manifest.json` **aynı klasörde** olmalı.

Kontrol:
```powershell
dir C:\Users\SERVER\Desktop\al\tarama
# aw-scan.cjs
# manifest.json
# TARA.cmd
# ONAR.cmd
```

---

## Hata 2 — `cd /d` PowerShell'de çalışmıyor

```
Set-Location : A positional parameter cannot be found that accepts argument '...'
+ cd /d C:\Users\SERVER\Desktop\al\AI_WORKSTATION
```

### Neden

`cd /d` **CMD** komutudur. PowerShell'de `/d` diye bir parametre yok.

### Çözüm

**PowerShell'de:**
```powershell
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION
```
veya
```powershell
Set-Location C:\Users\SERVER\Desktop\al\AI_WORKSTATION
```

**CMD'de** (eski yöntem hâlâ geçerli):
```cmd
cd /d C:\Users\SERVER\Desktop\al\AI_WORKSTATION
```

> Bundan sonraki kılavuzda her iki sürümü ayrı yazdım.

---

## Hata 3 — `npm ci` başarısız: better-sqlite3 derlenemiyor ⚠️ EN KRİTİK

```
prebuild-install warn install No prebuilt binaries found
  (target=26.13.0 runtime=node arch=x64 libc= platform=win32)

gyp ERR! find VS could not find a version of Visual Studio 2017 or newer
gyp ERR! find VS You need to install the latest version of Visual Studio
```

### İki katmanlı neden

| # | Sorun | Ayrıntı |
|---|---|---|
| **3a** | **`better-sqlite3@11.5` Node 26'yı desteklemiyor** | Bu sürümün `engines` alanı Node 26'yı kapsamıyor **ve** Node 26 için Windows ön-derlenmiş ikili yayınlanmamış. Paket kaynaktan derlenmeye düşüyor. **12.11.1 bunu çözer.** |
| **3b** | **Visual Studio C++ yok — artık önemsiz** | Kaynaktan derleme `node-gyp` → MSVC ister. Sizde `Visual Studio 18 BuildTools` kurulu görünüyor ama `Desktop development with C++` yükü **eksik** — node-gyp onu görmüyor. |

### Çözüm A (ÖNERİLEN) — `better-sqlite3` sürümünü yükselt  ⬅ BU TESLİMDE YAPILDI

**Suçlu Node 26 değil.** Suçlu eski `better-sqlite3@11.5.0` sürümüydü — o sürüm
Node 26 için Windows ikilisi yayınlamıyor, `engines` alanı Node 26'yı kapsamıyor.

Bu teslimde `better-sqlite3` **`^11.5.0` → `12.11.1`** (tam sürüm) yükseltildi.

**Doğrulandı (bu ortamda):**

| Kontrol | Sonuç |
|---|---|
| `engines` | `20.x \|\| 22.x \|\| 23.x \|\| 24.x \|\| 25.x \|\| 26.x` ✔ |
| **Node 26 ABI** | **147** — (önceki notta 137 yazıyordu, **yanlıştı**: 137 = Node 24) |
| `better-sqlite3-v12.11.1-node-v147-win32-x64.tar.gz` | **HTTP 200 — mevcut** ✔ |
| Node 24 (ABI 137) ikilisi | HTTP 200 ✔ |
| Electron 33 (ABI 130) ikilisi | HTTP 200 ✔ (paketleme de çalışır) |
| Yerelde tablo aç/kapa | ✔ |

### ➜ Node 26'nızda KALIN

**Node 26, 28 Ekim 2026'dan beri Active LTS** (destek: 30 Nisan 2029).
Node 22'ye düşmek sizi **geriye** götürür — Node 22 desteği 30 Nisan 2027'de bitiyor.

Yapmanız gereken tek şey: **güncellenmiş `1-KAYNAK-KOD.zip`** ile kurmak.

```powershell
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
```

> ⚠️ **Eski `1-KAYNAK-KOD.zip` ile bu çalışmaz** — o arşivde hâlâ `^11.5.0` yazıyor.
> Yeni arşivi indirdiğinizden emin olun. Kontrol:
> ```powershell
> Select-String better-sqlite3 C:\Users\SERVER\Desktop\al\AI_WORKSTATION\package.json
> # "better-sqlite3": "12.11.1"  görmelisiniz
> ```

---

### Çözüm B (YEDEK, önerilmez) — Node 22 LTS'e geç

Yalnızca Çözüm A işe yaramazsa. **Önerilmez:** Node 22 desteği 30 Nisan 2027'de
bitiyor (Node 26 → 30 Nisan 2029).

1. Node 26'yı kaldır → https://nodejs.org/en/download/releases → `v22.x.x` → Windows Installer (.msi) → x64
2. **Yeni bir PowerShell penceresi aç** (PATH güncellensin)
3. `node --version` → `v22.x.x` görmelisiniz
4. Sonra:
   ```powershell
   cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION
   npm ci
   ```

Node 22 = ABI 127 → `node-v127-win32-x64` ikilisi de **HTTP 200** ✔

> `prebuild-install ... No prebuilt binaries` mesajı hâlâ gelirse, o Node sürümü +
> platform için ikili **gerçekten** yok demektir. Bu durumda Çözüm B'ye geçin.

---

### Çözüm C — Visual Studio C++ yükünü kur (son tercih)

Yalnızca A ve B işe yaramazsa:

1. https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. **"Desktop development with C++"** yükünü seç (≈6 GB)
3. PowerShell'i yeniden aç
4. `npm ci`

> Sizde `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools` **var** ama
> C++ yükü yok. Bu yüzden node-gyp "unknown version" diyor.

---

### `npm warn cleanup ... EBUSY / EPERM`

```
EBUSY: resource busy or locked, rmdir '...\node_modules\cpu-features'
EPERM: operation not permitted, rmdir '...\node_modules\electron\node_modules\@types'
```

**Neden:** Electron veya başka bir Node süreci dosyaları kilitliyor. Windows'ta
antivirüs/OneDrive de kilitleyebilir.

**Çözüm:**
```powershell
taskkill /F /IM electron.exe
taskkill /F /IM node.exe
Start-Sleep -Seconds 3
Remove-Item -Recurse -Force node_modules
npm ci
```

Hâlâ olmuyorsa: klasörü **OneDrive dışına** taşıyın (ör. `C:\dev\AI_WORKSTATION`)
veya bilgisayarı yeniden başlatın.

---

## Hata 4 — `npm run monaco` → "monaco-editor paketi bulunamadı"

```
> node scripts/copy-monaco.mjs
monaco-editor paketi bulunamadı. Önce `npm install` çalıştırın.
```

### Neden

`npm ci` başarısız olduğu için `node_modules` **oluşmadı**. `monaco` betiği
`node_modules/monaco-editor` arıyor, bulamıyor.

### Çözüm

Bu hata **kendiliğinden düzelir** — `npm ci` başarılı olduğunda. Sıra önemli:

```powershell
npm ci            # 1) önce bu BAŞARILI olmalı
npm run monaco    # 2) sonra bu
npm run verify    # 3) en son bu
```

---

## Hata 5 (uyarı) — `npm run verify` → 5 kapı kırmızı

```
✔ Sürüm tutarlılığı
✔ Şartname tutarlılığı
✖ Tür denetimi (tsc --noEmit) (0.0 sn)
✖ Testler (vitest run) (0.0 sn)
✖ Arayüz derlemesi (vite build) (0.0 sn)
✖ Electron derlemesi (electron-vite build) (0.0 sn)
```

### Neden

**0.0 sn** süreler — komutlar hiç çalışmadı. `tsc`, `vitest`, `vite` hepsi
`node_modules` içinde. `npm ci` başarısız olduğu için yoklar.

### Çözüm

Bu bir **ürün hatası değil**, bağımlılık eksikliği. `npm ci` düzelince geçer.

`npm ci` başarılı olduğunda beklenen çıktı:
```
✔ Tüm doğrulama adımları geçti.
{ "toplam": 37, "gecen": 37, "basarisiz": 0 }
```

---

## Doğru sıra (özet)

```powershell
# 0) Node sürümünü kontrol et — v20 … v26 arası olmalı
node --version

# 1) Temizlik
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION
taskkill /F /IM electron.exe 2>$null
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 3
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 2) Kurulum  (BAŞARILI olmalı — olmazsa SORUN_GIDERME.md Çözüm B: Node 22)
npm ci

# 3) Editör dosyaları
npm run monaco

# 4) Doğrulama
npm run verify

# 5) (isteğe bağlı) Windows kurulum paketi
npm run build:win
```

---

## Ortam onarım aracı

`ONAR.cmd` dosyasına çift tıklayın. Kontrol eder ve söyler:

| Kontrol | Ne yapar |
|---|---|
| Node.js sürümü | v20–v26 uyumlu mu, değilse nasıl düzelteceğinizi yazar |
| Visual Studio C++ | Var mı, yoksa gerekli mi |
| Boş disk | ~1,5 GB var mı |
| Kilitli `node_modules` | Süreçleri sonlandırıp siler |
| `package.json` | Doğru klasörde misiniz |

---

## Doğrulama aracı (güncellenmiş)

```powershell
node C:\Users\SERVER\Desktop\al\tarama\aw-scan.cjs "C:\Users\SERVER\Desktop\al\AI_WORKSTATION"
```

Beklenen:
```
✔ KOPYA TAM — 217 dosyanın tamamı referansla birebir aynı.
```

> **NOT:** Bu teslimde `better-sqlite3` 12.11.1'e yükseltildiği için
> `package.json` ve `package-lock.json` değişti → **`1-KAYNAK-KOD.zip` yeniden üretildi.**
> Bu iki dosya "Değişmiş" olarak görünebilir; **yeni ZIP'i indirin**, eski kopyayla karşılaştırmayın.

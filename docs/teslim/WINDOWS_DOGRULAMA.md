# Windows doğrulama kaydı

Bu dosya, ürünün **gerçek bir Windows makinesinde** doğrulandığına dair kayıttır.
Kurulum ve doğrulama ilk kez Windows 10 üzerinde tamamen geçti.

---

## Ortam

| | |
|---|---|
| İşletim sistemi | Windows 10.0.19045 |
| Node.js | v26.13.0 |
| Node ABI | 147 (`node-v147-win32-x64`) |
| npm | (Node 26 ile birlikte) |
| better-sqlite3 | 12.11.1 (depodaki hazır ikili) |
| Electron | 33.4.11 |
| Commit | `1b16601` |
| Kullanıcı | `elisayilmazbot1-lang` |

---

## Kurulum çıktısı (`npm run kur`)

```
· Node sürümü  : v26.13.0
· Platform     : win32-x64
· Node ABI     : 147 (node-v147-win32-x64)
· Arşiv        : tools\prebuilds\better-sqlite3-v12.11.1-node-v147-win32-x64.tar.gz
· Boyut        : 1016 KB
· PE32+ imzası : ✔ (MZ)
✔ better_sqlite3.node yerleştirildi
  → node_modules\better-sqlite3\build\Release\better_sqlite3.node

· Electron sürümü : 33.4.11
· Deneniyor: https://npmmirror.com/mirrors/electron/33.4.11/electron-v33.4.11-win32-x64.zip
  ✔ İndirildi: 109.7 MB
· Açılıyor...
✔ Electron 33.4.11 kuruldu
  → node_modules\electron\dist
  → electron.exe: 180 MB

Monaco kopyalandı → public/monaco/vs (13.3 MB)
```

---

## Doğrulama çıktısı (`npm run verify`)

```
✔ Sürüm tutarlılığı (uygulama 1.0.0 · şartname 2.0)
✔ Şartname tutarlılığı (scripts/check-spec-consistency.mjs) (0.1 sn)
✔ Tür denetimi (tsc --noEmit) (4.8 sn)
✔ Testler (vitest run) (15.2 sn)
✔ Arayüz derlemesi (vite build) (4.0 sn)
✔ Electron derlemesi (electron-vite build) (6.7 sn)
✔ Uçtan uca senaryo (scripts/e2e-scenario.mjs) (6.2 sn)

✔ Tüm doğrulama adımları geçti.
{
 "toplam": 37,
 "gecen": 37,
 "basarisiz": 0
}
```

**7/7 kapı · E2E 37/37 · 149/149 birim/entegrasyon testi**

---

## Bu çalıştırmada kapatılan Windows hataları

Aşağıdaki hataların **hiçbiri** Linux'ta görünmüyordu. Hepsi gerçek Windows
makinesinde ortaya çıktı ve düzeltildi.

| # | Hata | Kök neden | Düzeltme | Commit |
|---|---|---|---|---|
| 1 | `Cannot find module aw-scan_FROZEN.mjs` | Bozuk .mjs yükleme | CommonJS `aw-scan.cjs` | — |
| 2 | `cd /d` PowerShell'de çalışmıyor | CMD sözdizimi | `cd` / `Set-Location` | — |
| 3 | `npm ci` → `gyp ERR! find VS` | GitHub Releases 404 → kaynaktan derleme | `npm ci --ignore-scripts` + `tools/prebuilds/` | — |
| 4 | `Error: Cannot find module …fix-native-win.mjs` | İki arşiv karışmış | Depo düzeni: `tools/` | — |
| 5 | `setlocal EnableDelayedExpansion` + `!` | `!` değişken sayıldı, JS kodu bozuldu | `KUR.cmd`'de `!` kullanılmıyor | — |
| 6 | `npx tsc` → `0.0 sn ✖` | Windows'ta `npx` bir `.cmd` | JS giriş noktası doğrudan çağrılıyor | `d20add3` |
| 7 | `EPERM` geçici klasör silme | `child.kill()` asenkron, dosya kilitli | Çıkış bekle + `maxRetries` | `2d06d9a` |
| 8 | `@electron/get` 404 | Dosya adı `v` öneki olmadan üretiliyor | Kendi indirici (`fetch` + `tar`) | `3d4ab64` |
| 9 | `'C:\Program' is not recognized` | `shell:true` args'ı tırnaklamıyor | `shell:false` | `3d4ab64` |
| 10 | `mkdtemp '/tmp/aw-term-'` ENOENT | Windows'ta `/tmp` yok | `os.tmpdir()` + `path.join` | `1b16601` |

### En öğretici olan: 6, 8, 9

**#6 ve #9** aynı hatanın iki yüzüydü:

```js
spawnSync('npx', ['tsc'], { shell: false })   // .cmd çalışmaz → sessiz 0.0 sn
spawnSync('npx', ['tsc'], { shell: true })    // args birleşir, "C:\Program" okunur
```

Çözüm ikisi de değil: aracın **JS girişini** `process.execPath` ile çağırmak.

```js
spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', ...args], { shell: false })
```

Böylece shell, `.cmd` ve boşluk sorunu ortadan kalkıyor; Windows ve Linux
**aynı kod yolunu** kullanıyor.

**#8** sessiz bir tuzaktı: `@electron/get` hata durumunda çıktıyı yutup `0`
ile çıkıyordu. Teşhis için hata yakalama eklendi, sonra indirme tamamen
kendi kodumuza alındı.

---

## Doğrulanmamış kalanlar

Bu kayıt **derleme ve test** doğrulamasıdır. Aşağıdakiler hâlâ açıktır:

| Konu | Durum |
|---|---|
| `npm run dev:electron` — arayüz penceresi açılıyor mu | **`[DOĞRULANMADI]`** |
| `npm run build:win` — EXE üretimi (Windows'ta) | **`[DOĞRULANMADI]`** |
| GitHub Actions CI | **`[DOĞRULANMADI]`** — hiç çalıştırılmadı |
| Docker özelliği | **`[DOĞRULANMADI]`** — Docker yok |
| Tarayıcı otomasyonu (Playwright) | **`[DOĞRULANMADI]`** |
| Kod imzalama / otomatik güncelleme | **`[EKSİK]`** |

Ayrıca üründe bilinen işlev eksikleri (tarayıcı hatası değil):

- **E-01** — `recordMeasurement` tanımlı ama çağrılmıyor
- **E-12** — `project_files` tablosuna yazma yok
- **E-13** — `sttProvider` ayarı `useVoice` tarafından okunmuyor

Kaynak kod denetimi: **10/13** — bu doğru sonuçtur. 13/13 görülürse bir şey yanlıştır.

---

## Tekrar üretmek için

```powershell
git clone https://github.com/elisayilmazbot1-lang/ai-workstation.git
cd ai-workstation
npm run kur
npm run verify
```

`npm run kur` şunları yapar:

1. `npm ci --ignore-scripts` — derleme yok, Visual Studio gerekmez
2. `node scripts/fix-native-win.mjs` — better-sqlite3 Windows ikilisi (ağsız, `tools/prebuilds/`)
3. `node scripts/install-electron.mjs` — Electron 33 (3 ayna, gerçek hata mesajı)
4. `node scripts/copy-monaco.mjs` — Monaco 13,3 MB

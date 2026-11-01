# GitHub'a yükleme — adım adım

Depo hazır ve commit edilmiş durumda. Bu ortamdan GitHub'a **doğrudan push
yapılamıyor** (GitHub bağlayıcısı desteklenmiyor), bu yüzden aşağıdaki komutları
kendi makinenizde çalıştırın.

**Mevcut durum:** 1 commit · 237 dosya · 6,4 MB `.git`

---

## 1. GitHub'da depo oluşturun

1. https://github.com/new adresine gidin
2. **Repository name:** `ai-workstation`
3. **Visibility:** Public veya Private (size bağlı)
4. **Initialize this repository with:**
   - ❌ README
   - ❌ .gitignore
   - ❌ license
   
   > **Önemli:** Hiçbirini işaretlemeyin. Depoda zaten README ve .gitignore var.
   > İşaretlerseniz push reddedilir ("fetch first").

5. **Create repository**

---

## 2. `elisayilmazbot1-lang` yer tutucusunu doldurun

Depoda 4 yerde `elisayilmazbot1-lang` geçiyor. Kendi kullanıcı adınızla değiştirin:

| Dosya | Satır |
|---|---|
| `package.json` | `repository.url`, `bugs.url`, `homepage` |
| `README_TR.md` | `git clone https://github.com/elisayilmazbot1-lang/...` |

PowerShell ile toplu değiştirme:

```powershell
cd C:\yol\ai-workstation
$kullanici = "SENIN_GITHUB_ADIN"

# package.json
(Get-Content package.json) -replace 'elisayilmazbot1-lang', $kullanici | Set-Content package.json -Encoding utf8

# README_TR.md
(Get-Content README_TR.md) -replace 'elisayilmazbot1-lang', $kullanici | Set-Content README_TR.md -Encoding utf8
```

---

## 3. Uzak depoyu bağlayın ve gönderin

```powershell
cd C:\yol\ai-workstation

git remote add origin https://github.com/SENIN_GITHUB_ADIN/ai-workstation.git
git branch -M main
git push -u origin main
```

Kullanıcı adı + **kişisel erişim anahtarı (PAT)** istenir. Şifre çalışmaz.

### PAT oluşturma

1. https://github.com/settings/tokens → **Generate new token (classic)**
2. **Expiration:** 90 gün
3. **Scopes:** ✅ `repo` (özel depo için) veya ✅ `public_repo`
4. **Generate token** → kopyalayın (bir daha gösterilmez)
5. `git push` sırasında şifre yerine bu anahtarı yapıştırın

---

## 4. Push sonrası kontrol

```powershell
git log --oneline          # b2e3b4e chore: ilk sürüm — AI Workstation 1.0.0
git remote -v              # origin bağlı mı
git status                 # "nothing to commit, working tree clean"
```

GitHub'da görmeniz gerekenler:

- ✅ **237 dosya**
- ✅ `README_TR.md` ana sayfada görünür
- ❌ `node_modules/` **yok**
- ❌ `dist/`, `out/`, `release/` **yok**
- ❌ `public/monaco/` **yok** (üretilen, `npm run monaco` oluşturur)
- ✅ `tools/prebuilds/*.tar.gz` **var** (2 × ~1 MB)

---

## 5. Depoda ne var, ne yok

| Klasör | İçerik | GitHub'da |
|---|---|---|
| `backend/` | Fastify sunucu, AI adaptörleri, ajanlar | ✅ |
| `src/` | React arayüz | ✅ |
| `electron/` | Ana süreç, preload, IPC | ✅ |
| `shared/` | Ortak tipler | ✅ |
| `tests/` | Birim + entegrasyon + doğrulama | ✅ |
| `spec/` | 48 eksik kaydı + şartname | ✅ |
| `docs/` | Kurulum, kullanım, ekran görüntüleri, denetim raporları | ✅ |
| `tools/` | Tarama aracı + **prebuilt ikililer** | ✅ |
| `scripts/` | Derleme, doğrulama, yerel modül hazırlığı | ✅ |
| `.github/workflows/` | Windows EXE üretimi | ✅ |
| `node_modules/` | Bağımlılıklar | ❌ `.gitignore` |
| `dist/`, `out/`, `release/` | Derleme çıktıları | ❌ |
| `public/monaco/` | 13 MB, `npm run monaco` üretir | ❌ |

---

## 6. Yeni klonlayan biri ne yapmalı

```powershell
git clone https://github.com/SENIN_GITHUB_ADIN/ai-workstation.git
cd ai-workstation
npm run kur
npm run verify
```

`npm run kur` şunları yapar:

```
npm ci --ignore-scripts          → 696 paket, Visual Studio gerekmez
node scripts/fix-native-win.mjs  → better-sqlite3 Windows ikilisi (ağsız)
node scripts/install-electron.mjs→ Electron 33 (ayna fallback)
node scripts/copy-monaco.mjs     → Monaco 13 MB
```

**Bu zincir, sizin yaşadığınız `gyp ERR! find VS` hatasını önlemek için var.**

---

## 7. CI (GitHub Actions) ne yapıyor

`.github/workflows/build-windows.yml` — **`v*` etiketi** push edilince veya
elle çalıştırılınca (`workflow_dispatch`) Windows EXE üretir.

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Adımlar:

1. Node.js **26** kur
2. `npm ci --ignore-scripts`
3. `tar` ile better-sqlite3 Windows ikilisi
4. `require('better-sqlite3')` testi — yüklenmezse **erken çıkar**
5. `npm run monaco`
6. `npm run verify` (7 adım + 37 E2E)
7. `npm run build:win`
8. EXE + SHA-256 → artifact (14 gün)

> **Not:** CI daha önce Node 20 + düz `npm ci` kullanıyordu; bu, sizin
> yaşadığınız GitHub Releases engelinde çökerdi. Düzeltildi.

---

## 8. Sık karşılaşılan hatalar

| Hata | Neden | Çözüm |
|---|---|---|
| `! [rejected] main -> main (fetch first)` | Depo README ile başlatılmış | `git push -u origin main --force` **veya** depoyu boş oluşturun |
| `Support for password authentication was removed` | Şifre kullanıldı | **PAT** kullanın (§3) |
| `remote origin already exists` | Uzak zaten bağlı | `git remote set-url origin <yeni-url>` |
| Dosyalar 100 MB üstü uyarısı | Yanlışlıkla büyük dosya | Depoda en büyük dosya 1 MB (`prebuilds`) — sorun olmamalı |
| `elisayilmazbot1-lang` görünüyor | Yer tutucu değiştirilmedi | §2 |

---

## 9. Doğrulanmış durum

Bu depo commit edilmeden önce şunlarla doğrulandı:

| Kontrol | Sonuç |
|---|---|
| Bütünlük (`aw-scan.cjs`) | **235/235 (%100)** |
| Kod denetimi | **10/13** — E-01, E-12, E-13 bilinen eksikler |
| CI YAML | Geçerli, 10 adım |
| `package.json` | Geçerli, `better-sqlite3` 12.11.1 |
| `package-lock.json` | `package.json` ile tutarlı |
| Sızıntı taraması | `.env`, `.key`, `.pem`, `node_modules` **yok** |
| En büyük dosya | 1,0 MB (`prebuilds/*.tar.gz`) |

# EXE DURUMU — önemli uyarı

Tarih: 2026-11-01

---

## `release/AI_WORKSTATION_Setup.exe`

| Özellik | Değer |
|---|---|
| Boyut | 92.572.279 bayt (88,3 MiB) |
| SHA-256 | `ef89d46da707af78cf99605e9800dbf2efea4d53c29b665b42af613d08555889` |
| Biçim | NSIS kurulum paketi, PE32 (MZ imzası doğrulandı) |
| **İçindeki better-sqlite3** | **11.x** |

---

## ⚠️ Bu EXE bayat

EXE, `better-sqlite3` **12.11.1'e yükseltilmeden ÖNCE** paketlendi.

`12.11.1` yükseltmesinin amacı **Node 26 uyumluluğuydu**. Ama EXE kendi Node
çalışma zamanını (Electron 33 içindeki Node) taşıdığı için, **EXE kullanıcısı
bu değişiklikten etkilenmez.** EXE içindeki modül `electron-v130` ikilisiyle
derlenmiş ve kendi içinde tutarlıdır.

### Yani

| Kullanım | Doğru paket |
|---|---|
| **Kaynaktan çalıştırmak** (`npm ci` → `npm run dev`) | ✅ **`1-KAYNAK-KOD.zip`** — güncel, better-sqlite3 12.11.1 |
| **Kurulum paketiyle kurmak** | ⚠️ Bu EXE **çalışır** ama eski modülü taşır. Güncel olsun isterseniz aşağıdaki komutla yeniden üretin. |

---

## Güncel EXE üretmek isterseniz

Kendi makinenizde (Node 26, Windows):

```powershell
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION
npm ci
npm run monaco
npm run build:win
```

Çıktı: `release\AI_WORKSTATION_Setup.exe`

`build:win` şunları yapar:

1. `prepare-native-win.mjs` → `better_sqlite3.node` için **Windows PE** ikilisi indirir
   (Electron ABI 130 = Electron 33). Bu adım **Linux'ta da doğru çalışır** çünkü
   çapraz derleme yapmaz, hazır ikiliyi indirir.
2. `build-all.mjs` → arayüz + Electron derlemesi
3. `electron-builder --win nsis portable --x64` → kurulum paketi

> **Not:** `prepare-native-win.mjs` içindeki ABI tablosu Electron 33 → 130 eşlemesini
> içeriyor. `electron` sürümünü yükseltirseniz bu tabloya satır eklemeniz gerekir.

---

## Neden bu EXE workspace'te kalıyor

Kullanıcı kararı: **kalsın.** Yer açmak için `teslim/01_kaynak_kod/` ve
`teslim/02_belgeler/` klasörleri kaldırıldı — içlerindeki ZIP'ler `teslim/indirmeler/`
altındakilerin **birebir kopyasıydı** (SHA eşitliği doğrulandı), yani bilgi kaybı yok.

Workspace: **118,3 MB / 128 MB** (417 dosya).

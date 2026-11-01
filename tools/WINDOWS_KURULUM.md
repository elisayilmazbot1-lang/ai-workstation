# WINDOWS — SİZİN YOLUNUZ İÇİN KURULUM

**Hedef klasör:** `C:\Users\SERVER\Desktop\al\AI_WORKSTATION`

---

## Adım 0 — Node.js kontrolü

PowerShell veya CMD açın, şunu yazın:

```cmd
node --version
```

- **`v18.x` veya üzeri** → devam edin
- **Komut bulunamadı** → https://nodejs.org adresinden **LTS** sürümü kurun, sonra pencereyi kapatıp yeniden açın

---

## Adım 1 — Dosyaları yerleştirin

`1-KAYNAK-KOD.zip`, `5-TARAMA-ARACI.zip` ve `TARA.cmd` dosyalarını indirin.

Aşağıdaki yapıyı **birebir** kurun:

```
C:\Users\SERVER\Desktop\al\
│
├── AI_WORKSTATION\          ← 1 numaralı ZIP'in içeriği BURAYA
│   ├── package.json
│   ├── src\
│   ├── backend\
│   ├── electron\
│   ├── shared\
│   ├── tests\
│   └── scripts\
│
└── tarama\                  ← 5 numaralı ZIP
    ├── TARA.cmd             ← ÇİFT TIKLA: tarama
    ├── ONAR.cmd             ← ÇİFT TIKLA: npm ci patlarsa ortamı onar
    ├── aw-scan.cjs
    ├── manifest.json
    ├── WINDOWS_KURULUM.md   ← bu dosya
    ├── NASIL_KULLANILIR.md
    └── SORUN_GIDERME.md     ← 4 hatanın çözümü
```

### Nasıl açılır

1. `1-KAYNAK-KOD.zip` → sağ tık → **Tümünü ayıkla**
2. Hedef olarak yazın: `C:\Users\SERVER\Desktop\al\AI_WORKSTATION`
3. Ayıkla

> **DİKKAT:** ZIP'in içinde `AI_WORKSTATION\` klasörü **yok** — dosyalar doğrudan kökte.
> Yani `AI_WORKSTATION\AI_WORKSTATION\package.json` gibi **iç içe** bir yapı oluşmamalı.
>
> Kontrol: `C:\Users\SERVER\Desktop\al\AI_WORKSTATION\package.json` **doğrudan** var mı?

---

## Node.js sürümü — önemli

| Sürüm | Durum |
|---|---|
| **Node 26** | ✔ **Active LTS** (28 Ekim 2026'dan beri) — **bunu kullanın** |
| Node 24 / 22 / 20 | ✔ destekleniyor |
| Node 25, 23 | ✔ destekleniyor (LTS değil) |
| Node 27+ | ✖ henüz yok |

`better-sqlite3@12.11.1` **Node 20–26'nın hepsi** için Windows ön-derlenmiş ikilisi
yayınlıyor — **Visual Studio gerekmez**.

> **Eskiden Node 22'ye düşmeniz söylenmişti — gerek yok.** O tavsiye
> `better-sqlite3@11.5` sürümünden kaynaklanıyordu; bu teslimde 12.11.1'e
> yükseltildi. Node 26'nızda kalın.

---

## Adım 2 — Tarayın

### A) Çift tıklama (en kolay)

`C:\Users\SERVER\Desktop\al\tarama\TARA.cmd` dosyasına **çift tıklayın**.

Kendi kendine:
1. Node.js sürümünü kontrol eder
2. Dosyaların yerinde olup olmadığını doğrular
3. **217 dosyayı SHA-256 ile** kıyaslar
4. **13 kaynak kod denetimi** yapar
5. Sonucu `tarama-sonucu.json` olarak yazar

### B) Komut satırı

```cmd
cd C:\Users\SERVER\Desktop\al\tarama       # PowerShell
# CMD kullaniyorsaniz: cd /d C:\Users\SERVER\Desktop\al\tarama
node aw-scan.cjs "C:\Users\SERVER\Desktop\al\AI_WORKSTATION"
```

### C) PowerShell (tek satır)

```powershell
node C:\Users\SERVER\Desktop\al\tarama\aw-scan.cjs "C:\Users\SERVER\Desktop\al\AI_WORKSTATION" --mode all
```

---

## Adım 3 — Çıktıyı okuyun

### Beklenen (iyi sonuç)

```
SONUÇ
  ✔ Tam eşleşen : 217/217  (%100.0)

✔ KOPYA TAM — 217 dosyanın tamamı referansla birebir aynı.
```

### Sorun varsa

```
EKSİK DOSYALAR (2)
  ✖ electron/ipc/handlers.ts
  ✖ src/services/api.ts

DEĞİŞMİŞ DOSYALAR (1)
  ▲ backend/ai/gateway.ts
     boyut: 12522 → 12533 | özet: abbcdb3eaea6ed29 → 405c09fde4f0ef14
```

**Çözüm:** `1-KAYNAK-KOD.zip`'i aynı yere **yeniden ayıklayın**, "Var olanı değiştir" seçin.

---

## Adım 4 — Ürünü çalıştırın

### Kurulum

```cmd
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION      # PowerShell
npm ci
npm run monaco
```

`npm ci` → 696 paket, ~20 saniye
`npm run monaco` → 13,3 MB editör dosyası (bu klasör ZIP'te yok, burada oluşur)

### Doğrulama (isteğe bağlı, önerilir)

```cmd
npm run verify
```

**7 kapı** koşar: sürüm · şartname · tip denetimi · **149 test** · arayüz derlemesi · Electron derlemesi · **37 E2E kontrol**

Beklenen son satır:
```
✔ Tüm doğrulama adımları geçti.
{ "toplam": 37, "gecen": 37, "basarisiz": 0 }
```

### Arayüzü açma (tarayıcıda, Electron'suz)

İki terminal gerekir:

**Terminal 1 — backend:**
```cmd
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION      # PowerShell
npm run dev:backend
```

**Terminal 2 — arayüz:**
```cmd
cd C:\Users\SERVER\Desktop\al\AI_WORKSTATION      # PowerShell
npm run dev
```

Açılan adrese gidin (genelde `http://localhost:5173`).

> **Not:** Arayüz `http://localhost:47110` üzerindeki backend'e proxy yapar.
> Backend'i kapatırsanız arayüz açılır ama veri gelmez.

### Windows EXE üretme (isteğe bağlı)

```cmd
npm run build:win
```

Çıktı: `C:\Users\SERVER\Desktop\al\AI_WORKSTATION\release\AI_WORKSTATION_Setup.exe`

> Bu komut `scripts/prepare-native-win.mjs` ile **doğru Windows yerel modülünü** indirir.
> Windows üzerinde çalıştığınız için `~/.wine` sorunu **yaşanmaz**.

---

## Sık karşılaşılan hatalar

| Hata | Neden | Çözüm |
|---|---|---|
| `'node' is not recognized` | Node.js kurulu değil veya PATH'te yok | https://nodejs.org LTS kur, pencereyi yeniden aç |
| `manifest.json bulunamadı` | `TARA.cmd` ile aynı klasörde değil | İkisini `tarama\` içine koy |
| `Klasör bulunamadı` | Yol yanlış | `C:\Users\SERVER\Desktop\al\AI_WORKSTATION` var mı? |
| Tüm dosyalar "Eksik" | Yanlış klasörü gösteriyorsunuz | İçinde `package.json` olan klasörü seçin |
| `npm ci` hata veriyor | `package-lock.json` yok | ZIP'i eksik ayıklamışsınız, yeniden ayıklayın |
| `npm run dev:backend` → port dolu | Eski süreç kalmış | `netstat -ano \| findstr 47110` → PID'i `taskkill /PID <pid> /F` |
| Arayüz açılıyor ama boş | Backend çalışmıyor | Terminal 1'i kontrol edin |

---

## Kontrol listesi

- [ ] Node.js v18+ kurulu (`node --version`)
- [ ] `C:\Users\SERVER\Desktop\al\AI_WORKSTATION\package.json` var
- [ ] `C:\Users\SERVER\Desktop\al\tarama\` içinde 3 dosya var
- [ ] `TARA.cmd` çalıştı → **217/217**
- [ ] `npm ci` tamamlandı
- [ ] `npm run monaco` tamamlandı
- [ ] `npm run verify` → **7/7 kapı, 37/37 E2E**

---

## Beklenen "eksik" sonuçlar — bunlar hata değil

`--mode code` çıktısında şu 3 madde **her zaman** başarısız görünecek:

```
● E-01 — recordMeasurement çağrılıyor mu
● E-12 — project_files tablosuna yazılıyor mu
● E-13 — sttProvider ayarı tüketiliyor mu
```

Bunlar **bilinen ve belgelenmiş** eksiklerdir. `3-RAPORLAR.zip` içindeki
`DENETIM_RAPORU_3.md` → Bölüm 6 "Açık Kalanlar" tablosunun 7, 8 ve 9. maddeleri.

Yani **10/13 geçmesi doğru sonuçtur.** 13/13 görürseniz bir şey yanlış demektir.

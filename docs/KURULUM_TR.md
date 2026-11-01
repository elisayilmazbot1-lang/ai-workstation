# AI Workstation — Kurulum Kılavuzu (Türkçe)

Bu belge, uygulamayı Windows bilgisayarınıza kurmanın üç yolunu ve kurulum sonrası ilk ayarları anlatır.

İçindekiler
1. [Sistem gereksinimleri](#1-sistem-gereksinimleri)
2. [Yol A — Kurulum dosyası (önerilen)](#2-yol-a--kurulum-dosyası-önerilen)
3. [Yol B — Taşınabilir sürüm](#3-yol-b--taşınabilir-sürüm-portable)
4. [Yol C — Kaynaktan çalıştırma](#4-yol-c--kaynaktan-çalıştırma-geliştirici)
5. [İlk ayarlar](#5-ilk-ayarlar)
6. [Kurulumu doğrulama](#6-kurulumu-doğrulama)
7. [Kaldırma](#7-kaldırma)
8. [Veri yedekleme ve taşıma](#8-veri-yedekleme-ve-taşıma)
9. [Sorun giderme](#9-sorun-giderme)

---

## 1. Sistem gereksinimleri

| Bileşen | En az | Önerilen |
| --- | --- | --- |
| İşletim sistemi | Windows 10 (64-bit, sürüm 1909+) | Windows 11 (64-bit) |
| İşlemci | 2 çekirdek | 4+ çekirdek |
| RAM | 4 GB | 8 GB |
| Disk | 1 GB boş alan | 3 GB (proje yedekleriyle) |
| Ekran | 1280×800 | 1920×1080 |
| İnternet | Model çağrıları için gerekli | — |
| Ek yazılım | — | Docker Desktop, Git, WSL (isteğe bağlı modüller) |

> **Önemli:** Uygulama yerel bir yapay zekâ modeli çalıştırmaz. Tüm model çağrıları bulut üzerinden yapılır; bu nedenle **GPU gerekmez** ve bilgisayarınızın RAM'i modeller tarafından tüketilmez.

---

## 2. Yol A — Kurulum dosyası (önerilen)

### 2.1 Dosyayı indirin ve doğrulayın

1. `AI_WORKSTATION_Setup.exe` ve `SHA256SUMS.txt` dosyalarını indirin.
2. PowerShell açın, dosyaların bulunduğu klasöre gidin ve doğrulayın:

```powershell
Get-FileHash .\AI_WORKSTATION_Setup.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

İki çıktıdaki özet değeri **birebir aynı olmalıdır**. Farklıysa dosyayı çalıştırmayın.

### 2.2 Kurulumu başlatın

1. `AI_WORKSTATION_Setup.exe` dosyasına çift tıklayın.
2. **"Windows korumalı bilgisayarınızı" uyarısı** çıkabilir — dosya kod imzalı değildir:
   - **Ek bilgi** → **Yine de çalıştır**.
3. Lisans metnini okuyup kabul edin.
4. Kurulum dizinini seçin (varsayılan: `%LOCALAPPDATA%\Programs\AI Workstation`).
5. **Kur** düğmesine basın. Kurulum yönetici yetkisi istemez.
6. Bittiğinde masaüstü ve başlat menüsü kısayolları oluşur.

### 2.3 İlk açılış

Uygulama açılırken:

- Veri klasörü oluşturulur: `%APPDATA%\AIWorkstation\`
  - `workstation.db` — görevler, sohbetler, ayarlar, denetim kayıtları
  - `secrets.vault` — şifrelenmiş API anahtarları (Windows DPAPI / `safeStorage`)
  - `backups\` — otomatik dosya yedekleri
- Yerel servis **yalnızca 127.0.0.1** üzerinde, rastgele seçilen boş bir bağlantı noktasında başlar. Dış ağdan erişilemez.
- Bağlantı kurulamazsa arayüzde kırmızı **"Yerel servis bağlı değil"** uyarısı görünür; bu durumda `docs/KULLANIM_TR.md` §10'a bakın.

---

## 3. Yol B — Taşınabilir sürüm (portable)

1. `AI_WORKSTATION_Portable.exe` dosyasını istediğiniz klasöre (ör. USB bellek) kopyalayın.
2. Çift tıklayıp çalıştırın. Kurulum yapılmaz, kayıt defterine yazılmaz.

> Taşınabilir sürümde veriler yine `%APPDATA%\AIWorkstation\` altında tutulur. Tamamen taşınabilir kullanım için `AW_DATA_DIR` ortam değişkenini ayarlayın:

```powershell
$env:AW_DATA_DIR = "D:\AIWorkstation\veri"
.\AI_WORKSTATION_Portable.exe
```

---

## 4. Yol C — Kaynaktan çalıştırma (geliştirici)

```powershell
# 1) Node.js 20 LTS kurulu olmalı: node --version
cd AI_WORKSTATION

# 2) Bağımlılıklar (Monaco dosyaları da kopyalanır)
npm ci

# 3) Geliştirme modunda masaüstü uygulaması
npm run dev:electron
```

Yalnızca arayüzü tarayıcıda görmek isterseniz:

```powershell
npm run dev:backend    # 1. terminal — arka uç
npm run dev            # 2. terminal — arayüz (http://localhost:5173)
```

Kurulum dosyasını kendiniz üretmek için:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```

Betik sırasıyla: testler → tür denetimi → arayüz derlemesi → Electron derlemesi → NSIS + portable paketleme → SHA-256 listesi.

---

### 4.1 Windows kurulum dosyası üretimi — ayrıntılı

`scripts\build-windows.ps1` betiği şu adımları **sırayla** çalıştırır; herhangi biri başarısız olursa paket üretilmez:

| # | Adım | Komut | Başarısızlıkta |
| --- | --- | --- | --- |
| 1 | Node.js sürüm denetimi (≥ 20) | `node --version` | Durdurur |
| 2 | Bağımlılıklar | `npm ci` | Durdurur |
| 3 | Testler | `npx vitest run` | Durdurur (paket üretilmez) |
| 4 | Monaco dosyaları | `node scripts/copy-monaco.mjs` | Durdurur |
| 5 | Tür denetimi | `npx tsc --noEmit` | Durdurur |
| 6 | Arayüz derlemesi | `npx vite build` | Durdurur |
| 7 | Electron derlemesi | `npx electron-vite build` | Durdurur |
| 8 | Paketleme | `npx electron-builder --win nsis portable --x64` | Durdurur |
| 9 | SHA-256 listesi | `Get-FileHash` | Uyarır |

Testleri atlamak için: `powershell -File scripts\build-windows.ps1 -SkipTests` (önerilmez).

**GitHub Actions ile üretim:** depo → **Actions** → **Windows kurulum dosyası** → **Run workflow**. Etiket (`v1.0.0`) gönderildiğinde de otomatik çalışır. Çıktı: `AI_WORKSTATION_windows` artefaktı (14 gün saklanır).

**Üretilen dosyalar (`release\`):**

| Dosya | Boyut (yaklaşık) | Açıklama |
| --- | --- | --- |
| `AI_WORKSTATION_Setup.exe` | ~120 MB | NSIS kurulum sihirbazı |
| `AI_WORKSTATION_Portable.exe` | ~120 MB | Kurulumsuz sürüm |
| `latest.yml`, `*.blockmap` | küçük | Otomatik güncelleme meta verisi |

## 5. İlk ayarlar

### 5.1 Bir model sağlayıcısı ekleyin (zorunlu)

1. Sol menüden **Yapay Zekâ Modelleri** → sağ üstteki **+ Sağlayıcı ekle**.
2. Sağlayıcı türünü seçin:

| Sağlayıcı | Anahtar adresi | Ücretsiz katman |
| --- | --- | --- |
| Google Gemini | `aistudio.google.com/apikey` | Var (sağlayıcının duyurduğu kotayla sınırlı) |
| OpenAI | `platform.openai.com/api-keys` | Yok |
| Anthropic | `console.anthropic.com` | Yok |
| xAI (Grok) | `console.x.ai` | Yok |
| DeepSeek | `platform.deepseek.com` | Kısmi |
| Mistral | `console.mistral.ai` | Var (deneme kotası) |
| OpenRouter | `openrouter.ai/keys` | Bazı modellerde |
| Hugging Face | `huggingface.co/settings/tokens` | Var (kotalı) |
| OpenAI uyumlu | Kendi sunucunuz | — |

3. Anahtarı yapıştırın → **Kaydet**.
4. **Bağlantıyı test et** → yeşil "Bağlantı başarılı" görmelisiniz.
5. **Kataloğu çek** → modeller listelenir.

> Anahtarınız yalnızca cihazınızda, DPAPI ile şifrelenmiş olarak saklanır. Arayüze, sohbet geçmişine veya günlüklere asla yazılmaz.

### 5.2 Proje ekleyin

**Projeler** → **Proje ekle** → çalışmak istediğiniz klasörü seçin. Uygulama yalnızca bu klasörün içine yazabilir; üst dizinlere çıkış denemeleri reddedilir.

### 5.3 Ajanları yapılandırın (isteğe bağlı)

**Ajan Merkezi** → her ajan için:

- **Birincil model** (boşsa genel varsayılan kullanılır)
- **Yedek model** (birincil hata verirse)
- **Sıcaklık** (kodlama için 0.1–0.2 önerilir)
- **Araç izinleri**: dosya değişikliği önerebilir mi, komut çalıştırabilir mi

Güvenlik açısından önerilen başlangıç: yalnızca **Kodlama** ve **Test** ajanlarına komut izni verin; **Güvenlik** ajanı yalnızca okuma yapsın.

### 5.4 Sesli iletişim (isteğe bağlı)

**Ayarlar** sayfasındaki **Ses** paneli → *Sesli iletişim* anahtarını açın. Windows mikrofon izni istendiğinde **İzin ver** seçin.

- Konuşma tanıma: tarayıcı motoru (Chromium), dil `tr-TR`
- Seslendirme: sistem ses motoru, **Asistan** balonundaki 🔊 düğmesi

---

## 6. Kurulumu doğrulama

Kurulumun sağlıklı olduğunu şu 5 adımda kontrol edebilirsiniz:

| # | Adım | Beklenen sonuç |
| --- | --- | --- |
| 1 | Uygulamayı açın | Sağ alt köşede yeşil **"Yerel servis bağlı"** |
| 2 | **Ayarlar** → en alttaki **Hakkında** paneli | Sürüm `1.0.0`, hedef platform `Windows 10/11 x64` |
| 3 | Sağlayıcı ekleyip **Bağlantıyı test et** | Yeşil onay veya net hata mesajı |
| 4 | **Sohbet**: "merhaba" yazın | Akışlı yanıt gelir |
| 5 | `Ctrl+Shift+Escape` | Kırmızı **acil durdurma** bildirimi; tekrar basınca sürer |

---

## 7. Kaldırma

- **Ayarlar → Uygulamalar → AI Workstation → Kaldır**, veya
- **Başlat menüsü → AI Workstation → Kaldır**

Kaldırma işlemi verilerinizi **silmez** (`%APPDATA%\AIWorkstation`). Tamamen temizlik için:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\AIWorkstation"
```

> Bu işlem görev geçmişini, ayarları ve şifreli anahtar kasasını kalıcı olarak siler.

---

## 8. Veri yedekleme ve taşıma

### 8.1 Uygulama içinden

**Ayarlar** sayfasının üstündeki **Yedek al** düğmesi → ZIP dosyası veri klasöründeki `backups\` altına yazılır ve yol/özet bilgisi bildirimde gösterilir.
**Yedeği geri yükle** aynı çubuktadır; geri yükleme öncesi otomatik güvenlik kopyası alınır.

### 8.2 Elle

```powershell
# Uygulama kapalıyken
Compress-Archive -Path "$env:APPDATA\AIWorkstation" -DestinationPath "$env:USERPROFILE\Desktop\ai-workstation-yedek.zip"
```

Taşıma: ZIP'i yeni bilgisayarda `%APPDATA%` altına açın. Şifreli anahtar kasası DPAPI ile bağlı olduğundan **anahtarlar yeni makinede çalışmaz**; sağlayıcı anahtarlarını yeniden girmeniz gerekir (bu bir güvenlik özelliğidir).

---

## 9. Sorun giderme

### Uygulama açılmıyor / beyaz ekran

1. `%APPDATA%\AIWorkstation\logs\main.log` dosyasını açın.
2. Antivirüsün `AI Workstation.exe` dosyasını engellemediğinden emin olun.
3. Uygulamayı yönetici olarak çalıştırmayı **denemeyin** (gerekmez ve veri yolu değişir).

### "Yerel servis bağlı değil"

```powershell
# Port çakışması veya güvenlik duvarı engeli olabilir
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -gt 1024 } | Select-Object -First 10
```

Ateş duvarı kuralı gerekmez: servis yalnızca geri döngü (loopback) arayüzünde dinler.

### "Docker kullanılamıyor"

Docker Desktop kurulu ve çalışıyor olmalı:

```powershell
docker version
```

Çalışmıyorsa Docker modülü pasif kalır; diğer modüller etkilenmez.

### Terminalde kabuk bulunamadı

Uygulama sırayla `pwsh` → `powershell` → `cmd` dener. Hiçbiri bulunamazsa **Ayarlar → Terminal → Varsayılan kabuk** listesinden sisteminizde kurulu olan kabuğu seçin. PowerShell 7 kurulu değilse `powershell` (Windows PowerShell 5.1) otomatik kullanılır.

### Model yanıt vermiyor

| Belirti | Olası neden | Çözüm |
| --- | --- | --- |
| `401` | Anahtar geçersiz | Anahtarı yeniden girin |
| `429` | Kota aşıldı | Yedek model tanımlayın veya bekleyin |
| `model bulunamadı` | Katalog eski | **Kataloğu çek** |
| Zaman aşımı | Ağ/proxy | Kurumsal proxy varsa `HTTPS_PROXY` ayarlayın |

### Testler "not-run" görünüyor

Bu **hata değil**, dürüst durumdur: projede ilgili test altyapısı (ör. `vitest`, `jest`, `tsc`) bulunamadı. `package.json` içine test betiği ekleyip tekrar çalıştırın. "Çalıştırılmadı" sonucu asla "geçti" sayılmaz.

---

**Sonraki adım:** [`KULLANIM_TR.md`](KULLANIM_TR.md) — günlük iş akışları ve ekran ekran kullanım.

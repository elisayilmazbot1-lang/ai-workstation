# E-40 — Otomatik güncelleme (imzalı kanal)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-40 |
| **Modül** | Dağıtım |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | electron-builder, CI, E-42 |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-40 |

## 1. Neden gerekli

v1.0 'otomatik güncelleme' vaat ediyor; kodda `electron-updater` yok. Kullanıcı her sürümde elle indirmek zorunda.

## 2. Teknik uygulama

1. `electron-updater` ekle; `autoUpdater.autoDownload = false` (kullanıcı onayı).
2. Sağlayıcı: GitHub Releases (`latest.yml` + `.nsis` + `.blockmap`).
3. Akış: açılışta 3 sn sonra `checkForUpdates()` → yeni sürüm varsa 'Sürüm X hazır' → indir (ilerleme) → 'Yeniden başlat ve kur'.
4. **İmza zorunlu:** `autoUpdater` imzasız paketleri reddeder; imza yoksa özellik kapalı (`AW_UPDATES=off`).
5. Güncelleme öncesi otomatik veri yedeği (E-08 şifreli).
6. Geri alma: önceki `.exe` `release/` içinde tutulur + yedekten geri dönüş.
7. Kanal: `stable` / `beta` seçimi (ayar).

## 3. Kabul kriterleri

1. Yeni sürüm algılanır, kullanıcı onayıyla indirilir.
2. İmzasız güncelleme reddedilir.
3. Güncelleme öncesi yedek oluşur.

## 4. Test kriterleri

- [ ] updater.test.ts: sürüm karşılaştırma, imza reddi (mock)

## 5. Riskler ve dikkat edilecekler

Güncelleme veri kaybına yol açabilir → yedek zorunlu ve geri dönüş testi.

## 6. Kapsam dışı

Delta güncelleme optimizasyonu.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

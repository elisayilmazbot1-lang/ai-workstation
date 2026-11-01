# E-41 — CI'da gerçek Windows .exe üretimi ve kurulum testleri

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-41 |
| **Modül** | Dağıtım |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | Actions, Windows, electron-builder |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-41 |

## 1. Neden gerekli

Kurulum dosyası hiç üretilmedi. Yapılandırma hazır ama gerçek `.exe` ve K1–K10 testleri yok; sürüm 'üretime hazır' ilan edilemez.

## 2. Teknik uygulama

1. `.github/workflows/build-windows.yml` (mevcut) → `workflow_dispatch` + tag tetikleme.
2. Adımlar: `npm ci` → `vitest` → `tsc` → `vite build` → `electron-vite build` → `electron-builder --win nsis portable --x64`.
3. Artefakt: `.exe`, `.blockmap`, `latest.yml`, `SHA256SUMS.txt`.
4. **Kurulum testi (Windows runner):** sessiz kurulum `/S` → uygulama 10 sn açık kalır → süreç listesinde görünür → kaldırma.
5. Smoke: paketlenmiş uygulama `--smoke-test` bayrağıyla açılır, sağlık uç noktası kontrol edilir, çıkar (CI'da headless).
6. Başarısızsa sürüm yayınlanmaz (kapı).

## 3. Kabul kriterleri

1. CI'da `.exe` üretilir.
2. Sessiz kurulum ve kaldırma çalışır.
3. Paketlenmiş uygulama sağlık kontrolünü geçer.

## 4. Test kriterleri

- [ ] Actions çalıştırması yeşil
- [ ] artefakt SHA-256 doğrulanır

## 5. Riskler ve dikkat edilecekler

Windows runner maliyeti; sürüm başına bir kez çalıştırılmalı.

## 6. Kapsam dışı

macOS/Linux paketleri (kapsam dışı).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

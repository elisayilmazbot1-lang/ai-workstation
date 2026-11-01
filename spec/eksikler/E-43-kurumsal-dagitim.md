# E-43 — Sessiz kurulum ve kurumsal dağıtım

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-43 |
| **Modül** | Dağıtım |
| **Öncelik** | **P3** |
| **Efor** | S |
| **Bağımlılıklar** | nsis |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-43 |

## 1. Neden gerekli

BT birimleri toplu kurulum ister; şu an yalnızca sihirbaz var.

## 2. Teknik uygulama

1. NSIS zaten `/S` destekler; `perMachine` senaryosu için ayrı yapılandırma (`oneClick: true` varyantı).
2. `/D=<yol>` ile kurulum dizini.
3. Kurumsal ayar önceden yazma: `%PROGRAMDATA%\AIWorkstation\settings.json` (ilk açılışta okunur).
4. Kaldırma: sessiz `/S`.
5. Doküman: `docs/KURUMSAL_DAGITIM.md`.

## 3. Kabul kriterleri

1. `Setup.exe /S` sessiz kurar.
2. Önceden yazılan ayarlar ilk açılışta uygulanır.

## 4. Test kriterleri

- [ ] manuel Windows testi (K-seri)

## 5. Riskler ve dikkat edilecekler

Yönetici yetkisi gerektiren kurulum ayrı paket olmalı (asInvoker kuralı çiğnenmemeli).

## 6. Kapsam dışı

Intune/SCCM paketleme.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

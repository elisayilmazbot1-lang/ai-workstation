# E-42 — Kod imzalama hattı

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-42 |
| **Modül** | Dağıtım |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | sertifika, electron-builder |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-42 |

## 1. Neden gerekli

İmzasız `.exe` SmartScreen uyarısı verir; kurumsal dağıtımda güven kırılır.

## 2. Teknik uygulama

1. Sertifika temini (OV/EV) — kullanıcı/kurum kararı.
2. `electron-builder.yml`: `win.signingHashAlgorithms`, `certificateSubjectName` veya `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` ortam değişkenleri (CI secret).
3. CI'da imzalama adımı; `signtool verify /pa` ile doğrulama.
4. Zaman damgası (RFC3161) eklenir — sertifika süresi dolsa da imza geçerli kalır.
5. İmza yoksa CI yalnızca 'imzasız' artefakt üretir ve README bunu söyler.

## 3. Kabul kriterleri

1. `.exe` imzalı, `signtool verify` geçer.
2. SmartScreen uyarısı yok (itibar birikimi sonrası).

## 4. Test kriterleri

- [ ] CI imza adımı
- [ ] Get-AuthenticodeSignature = Valid

## 5. Riskler ve dikkat edilecekler

Sertifika maliyeti ve yıllık yenileme sorumluluğu.

## 6. Kapsam dışı

Donanım güvenlik modülü (HSM) tabanlı imza.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

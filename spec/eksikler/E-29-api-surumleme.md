# E-29 — API sürümleme

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-29 |
| **Modül** | Sözleşme |
| **Öncelik** | **P3** |
| **Efor** | S |
| **Bağımlılıklar** | server, shared |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-29 |

## 1. Neden gerekli

Sözleşme değişince eski arayüz sessizce kırılır; sürüm bilgisi hem yanıtta hem yolda yok.

## 2. Teknik uygulama

1. `/api/v1/...` öneki eklenir; `/api/...` bir sürüm boyunca takma ad olarak korunur.
2. Yanıt başlığı `X-Api-Version: 1`.
3. `GET /api/v1/meta` → sürüm, uyumluluk aralığı.
4. Arayüz tek sabitten yol üretir (`API_PREFIX`).
5. Kaldırma yalnızca büyük sürümde; `CHANGELOG`'da duyurulur.

## 3. Kabul kriterleri

1. Yeni sürüm öneki çalışır, eski yol da çalışır.
2. Arayüz öneki tek yerden alır.

## 4. Test kriterleri

- [ ] api-version.test.ts: iki yol aynı sonucu verir

## 5. Riskler ve dikkat edilecekler

Takma adın unutulması → 2 sürüm sonra kaldırma planı yazılı olmalı.

## 6. Kapsam dışı

Grafik API (GraphQL).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

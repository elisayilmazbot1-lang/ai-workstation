# E-30 — Mimari kural testi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-30 |
| **Modül** | Kalite |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | tests |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-30 |

## 1. Neden gerekli

Modül sınırları yalnızca yorum satırlarıyla korunuyor; biri `security` içine `agents` import ederse kimse fark etmez.

## 2. Teknik uygulama

1. `tests/unit/architecture.test.ts`: kaynak dosyaları okur, import grafiği çıkarır.
2. Kurallar:
   - `backend/security/*` yalnızca `database` ve kendi içini import eder.
   - `backend/memory/*` yalnızca `database`.
   - `src/*` `backend/*` import etmez.
   - `shared/*` hiçbir şeyi import etmez (tip dışında).
   - Döngüsel import yok.
3. İhlal → test başarısız + hangi dosya/satır raporlanır.
4. Klasör yapısı denetimi: zorunlu klasörler var mı.

## 3. Kabul kriterleri

1. İhlal eden import eklenirse test kırmızıya döner.
2. Döngü tespiti çalışır.

## 4. Test kriterleri

- [ ] architecture.test.ts kendisi

## 5. Riskler ve dikkat edilecekler

Yanlış pozitif riski: dinamik import — yorum satırı ile muafiyet listesi tutulmalı.

## 6. Kapsam dışı

Katman sözleşmesi (interface) denetimi.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

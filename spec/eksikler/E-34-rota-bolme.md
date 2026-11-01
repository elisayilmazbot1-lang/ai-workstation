# E-34 — routes.ts bölünmesi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-34 |
| **Modül** | Kalite |
| **Öncelik** | **P3** |
| **Efor** | M |
| **Bağımlılıklar** | server |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-34 |

## 1. Neden gerekli

74 uç nokta tek dosyada (~600 satır); değişiklik çakışmaları ve okunabilirlik sorunu.

## 2. Teknik uygulama

1. `backend/server/routes/` klasörü: `providers.ts, chat.ts, tasks.ts, agents.ts, files.ts, terminal.ts, docker.ts, browser.ts, tests.ts, system.ts`.
2. Her dosya `export function registerXRoutes(app, c)`.
3. `routes.ts` yalnızca kayıt çağrılarını yapar.
4. Sözleşme testi aynı kalır (davranış değişmez).

## 3. Kabul kriterleri

1. Tüm testler değişmeden geçer.
2. Her rota dosyası < 200 satır.

## 4. Test kriterleri

- [ ] api-contract.test.ts yeniden çalışır

## 5. Riskler ve dikkat edilecekler

Saf taşıma; davranış değişikliği yasak.

## 6. Kapsam dışı

Rota tabanlı izin middleware'i (E-06 ile).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

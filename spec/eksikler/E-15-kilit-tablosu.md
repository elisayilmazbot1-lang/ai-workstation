# E-15 — Kalıcı kilit kaydı (çoklu süreç)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-15 |
| **Modül** | Orkestrasyon |
| **Öncelik** | **P3** |
| **Efor** | M |
| **Bağımlılıklar** | db, orchestrator, E-32 |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-15 |

## 1. Neden gerekli

Kilitler süreç içi `Map`. E-32 ile ağır işler çocuk sürece taşındığında kilitler süreçler arası çalışmaz; iki süreç aynı dosyaya yazabilir.

## 2. Teknik uygulama

1. `file_locks` tablosu: `path, owner_id, acquired_at, expires_at`.
2. `across processes`: `INSERT ... ON CONFLICT DO NOTHING` + `acquired_at` kontrolü.
3. Süresi geçen kilit (60 sn) temizlenir (her acquire öncesi).
4. Tek süreç modunda mevcut `Map` korunur (daha hızlı); çoklu süreç algılanırsa tablo kullanılır.

## 3. Kabul kriterleri

1. İki süreç aynı dosyayı kilitleyemez.
2. Süresi geçen kilit temizlenir.
3. Tek süreç performansı düşmez.

## 4. Test kriterleri

- [ ] locks.test.ts: çakışma, süre aşımı

## 5. Riskler ve dikkat edilecekler

DB tabanlı kilit yavaştır → yalnızca çoklu süreçte kullanılmalı.

## 6. Kapsam dışı

—

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

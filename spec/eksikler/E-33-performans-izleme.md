# E-33 — Yavaş sorgu izleme ve bellek budama

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-33 |
| **Modül** | Performans |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | db, src |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-33 |

## 1. Neden gerekli

Performans sorunları ancak kullanıcı şikâyetiyle fark ediliyor; 100 ms üstü sorgu kaydı yok.

## 2. Teknik uygulama

1. DB sarmalayıcı: her sorgu süresi ölçülür; > 100 ms ise `audit_logs`'a `perf` modülüyle yazılır (SQL kısaltılmış, parametreler maskelenmiş).
2. `GET /api/diagnostics/slow-queries` → son 50 kayıt.
3. Arayüz: store'daki olay listesi 500 ile sınırlanır; toast geçmişi 100.
4. Uzun oturumda bellek: kullanılmayan görsel önbelleği temizlenir (tarayıcı sekmeleri).

## 3. Kabul kriterleri

1. Yavaş sorgu kaydı oluşur.
2. Olay listesi sınırsız büyümez.

## 4. Test kriterleri

- [ ] slow-query.test.ts: eşik, kayıt

## 5. Riskler ve dikkat edilecekler

SQL parametreleri günlüğe yazılırsa sızıntı → maskelenmeli.

## 6. Kapsam dışı

APM entegrasyonu.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

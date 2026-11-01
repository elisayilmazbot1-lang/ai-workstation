# E-14 — Benchmark ve ölçüm geçmişi tablosu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-14 |
| **Modül** | Veritabanı |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | db, E-01 |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-14 |

## 1. Neden gerekli

Mevcut `model_measurements` yalnızca son puanı tutar; geçmiş, koşu zamanı ve istem seti sürümü kaybolur. Puanın neden değiştiği izlenemez.

## 2. Teknik uygulama

1. Yeni tablo `model_benchmarks`:
```sql
CREATE TABLE model_benchmarks (
  id TEXT PRIMARY KEY, model_id TEXT NOT NULL, capability TEXT NOT NULL,
  benchmark_version TEXT NOT NULL, score REAL NOT NULL,
  passed INTEGER NOT NULL, total INTEGER NOT NULL,
  cost_usd REAL, duration_ms INTEGER, at TEXT NOT NULL
);
CREATE INDEX idx_mb_model ON model_benchmarks(model_id, capability, at DESC);
```
2. `model_measurements` özet tablo olarak kalır (hızlı okuma); `model_benchmarks` geçmiş.
3. Migrasyon: `schema_migrations` ile 2 → 3.

## 3. Kabul kriterleri

1. Her koşu geçmişe yazılır.
2. Puan değişim grafiği çizilebilir.
3. Eski DB sorunsuz migrate olur.

## 4. Test kriterleri

- [ ] database.test.ts: migrasyon, indeks, geriye uyum

## 5. Riskler ve dikkat edilecekler

Tablo büyümesi: saklama politikası (E-25) ile sınırlanmalı.

## 6. Kapsam dışı

—

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-24 — Test iptali, kapsam raporu, karşılaştırmalı koşu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-24 |
| **Modül** | Test |
| **Öncelik** | **P2** |
| **Efor** | L |
| **Bağımlılıklar** | tests, terminal |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-24 |

## 1. Neden gerekli

Uzun test paketi iptal edilemiyor; kapsam yok; iki koşu arasındaki fark görülemiyor.

## 2. Teknik uygulama

1. İptal: koşu kimliği + `AbortController` → `POST /api/tests/runs/:id/cancel`; alt süreç sonlandırılır, sonuç `cancelled`.
2. Kapsam: `c8` varsa `--reporter=json` çıktısını ayrıştır; yoksa 'kapsam aracı yok' (uydurma yok).
3. Karşılaştırma: `GET /api/tests/runs/compare?a=<id>&b=<id>` → geçen→kalan, kalan→geçen listesi.
4. Arayüz: Test Merkezi'nde 'öncekiyle karşılaştır' düğmesi.
5. Parçalama (shard): birden çok komut tanımlanabilir, paralel (sınır 2).

## 3. Kabul kriterleri

1. Koşu iptal edilince süreç gerçekten ölür.
2. Kapsam yoksa 'yok' denir.
3. Karşılaştırma doğru fark verir.

## 4. Test kriterleri

- [ ] test-run-control.test.ts: iptal, karşılaştırma

## 5. Riskler ve dikkat edilecekler

Kapsam ayrıştırma biçimi sürüme bağlı → bilinmeyen biçimde 'ayrıştırılamadı' denir.

## 6. Kapsam dışı

Kod kapsamı görselleştirme (ısı haritası).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-07 — Ajan başına token ve maliyet bütçesi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-07 |
| **Modül** | Ajanlar |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | agents, usage_events |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-07 |

## 1. Neden gerekli

Bir ajan döngüye girer veya çok uzun bağlamla çalışırsa maliyet kontrolsüz büyür; kesme mekanizması yok.

## 2. Teknik uygulama

1. `agent_profiles`'a `maxTokensPerTask`, `maxCostPerTaskUsd` alanları.
2. Orkestratör her ajan çağrısından sonra `usage_events` toplamını karşılaştırır.
3. Aşımda: adım `failed` + neden 'bütçe aşıldı'; görev `partial`.
4. Arayüz: görev detayında bütçe çubuğu (kullanılan/limit).
5. Varsayılan: sınırsız (kullanıcı açıkça sınır koyar) — sessiz varsayılan sınır koymak davranışı bozar.

## 3. Kabul kriterleri

1. Bütçe aşıldığında ajan çağrısı yapılmaz.
2. Bütçe çubuğu doğru yüzdeyi gösterir.
3. Sınırsız bütçede davranış değişmez.

## 4. Test kriterleri

- [ ] budget.test.ts: aşım, tam sınır, sınırsız

## 5. Riskler ve dikkat edilecekler

Fiyat bilinmeyen modelde maliyet hesaplanamaz → token bazlı sınır kullanılmalı.

## 6. Kapsam dışı

Gerçek zamanlı sağlayıcı faturalama entegrasyonu.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

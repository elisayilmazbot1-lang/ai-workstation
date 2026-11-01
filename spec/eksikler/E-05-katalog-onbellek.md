# E-05 — Katalog önbelleği ve eskime uyarısı

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-05 |
| **Modül** | Model Merkezi |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | providers |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-05 |

## 1. Neden gerekli

Her açılışta tüm sağlayıcılardan katalog çekiliyor; ücretsiz kotalarda gereksiz istek. Ayrıca eski katalog sessizce gösteriliyor.

## 2. Teknik uygulama

1. `kv_store` içinde `catalog:<providerId>` → `{fetchedAt, models}`.
2. Okuma: TTL 5 dk; süre dolduysa arka planda tazele, kullanıcıya eski veri + 'güncelleniyor' göster.
3. `fetchedAt` 24 saatten eskiyse arayüzde sarı 'katalog eski' rozeti + 'Şimdi yenile' düğmesi.
4. Sağlayıcı hata verirse son başarılı katalog korunur (boş liste gösterme).

## 3. Kabul kriterleri

1. İkinci açılışta ağ isteği yapılmaz (TTL içinde).
2. Eski katalog rozeti 24 saat sonra görünür.
3. Sağlayıcı hatasında liste boşalmaz.

## 4. Test kriterleri

- [ ] catalog-cache.test.ts: TTL, eski rozet, hata sonrası koruma

## 5. Riskler ve dikkat edilecekler

Önbellek bayat fiyat gösterebilir; rozet bunu açıkça belirtmeli.

## 6. Kapsam dışı

Fiyat değişimi otomatik algılama.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

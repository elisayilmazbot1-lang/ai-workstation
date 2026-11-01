# E-04 — Sağlayıcı kimlik bilgisi rotasyonu ve çoklu anahtar

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-04 |
| **Modül** | Model Merkezi |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | security, providers |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-04 |

## 1. Neden gerekli

Anahtar sızdığında veya kotası dolduğunda kullanıcı yeni anahtar girmek zorunda; mevcut akış tek anahtar ve sessiz geçersizleşmeye açık.

## 2. Teknik uygulama

1. `provider_secrets` tablosu: `id, provider_id, alias, encrypted, created_at, last_used_at, status`.
2. Kasa birden çok anahtar tutar; `active` işaretli kullanılır.
3. `POST /api/providers/:id/keys` (ekle), `POST /api/providers/:id/keys/:keyId/activate`, `DELETE`.
4. `AUTH_FAILED` alınca sıradaki `active=false` anahtar denenmez; kullanıcıya "anahtar geçersiz, yenisini ekleyin" denir (otomatik failover **yok** — güvenlik).
5. Rotasyon hatırlatıcısı: `last_used_at` 90 günden eskiyse uyarı (bilgi amaçlı).

## 3. Kabul kriterleri

1. İki anahtar eklenir, biri seçilir; seçili olan kullanılır.
2. Anahtar değeri hiçbir yanıtta dönmez.
3. Silinen anahtar kasadan da silinir.

## 4. Test kriterleri

- [ ] providers.test.ts: çoklu anahtar, aktivasyon, silme
- [ ] E2E: anahtar yoksa çağrı reddi

## 5. Riskler ve dikkat edilecekler

Kullanıcı iki anahtarı karıştırabilir → alias zorunlu.

## 6. Kapsam dışı

Otomatik failover (kotaya göre anahtar değiştirme) — ToS ihlali riski taşır.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

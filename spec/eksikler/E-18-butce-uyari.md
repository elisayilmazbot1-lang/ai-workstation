# E-18 — Maliyet bütçesi ve uyarı eşikleri

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-18 |
| **Modül** | Model/Maliyet |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | usage_events, settings |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-18 |

## 1. Neden gerekli

Kullanıcı ne kadar harcadığını ancak sağ rayına bakarak görüyor; eşik aşımında uyarı yok.

## 2. Teknik uygulama

1. Ayarlar: `ai.dailyBudgetUsd`, `ai.monthlyBudgetUsd`, `ai.warnAtPercent` (varsayılan 80).
2. `usage_events` toplamı gün/ay bazında hesaplanır (indeksli sorgu).
3. Eşik aşıldığında: bildirim + sağ rayda kırmızı uyarı; bütçe **aşılsa bile çağrı engellenmez** (varsayılan), isteğe bağlı 'bütçede durdur' anahtarı.
4. Arayüz: Geçmiş → Maliyet sekmesinde günlük/aylık toplam ve model kırılımı.

## 3. Kabul kriterleri

1. Eşik aşımında bildirim gelir.
2. Bütçede durdur açıksa çağrı reddedilir (açık mesaj).
3. Maliyet kırılımı doğru toplanır.

## 4. Test kriterleri

- [ ] budget-alert.test.ts: eşik, durdurma, kırılım

## 5. Riskler ve dikkat edilecekler

Sağlayıcı fiyatı bilinmiyorsa maliyet eksik hesaplanır → 'bilinmeyen maliyet' ayrı gösterilmeli.

## 6. Kapsam dışı

Gerçek fatura eşleştirme.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

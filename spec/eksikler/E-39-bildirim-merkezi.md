# E-39 — Bildirim merkezi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-39 |
| **Modül** | İzleme |
| **Öncelik** | **P3** |
| **Efor** | S |
| **Bağımlılıklar** | notifications, src |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-39 |

## 1. Neden gerekli

Toast kaçırılınca bildirim kayboluyor; geçmiş yok, filtre yok.

## 2. Teknik uygulama

1. `GET /api/notifications?status=unread&limit=50` (mevcut uç nokta genişletilir).
2. `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
3. Arayüz: üst çubukta zil + açılır panel (okunmamış sayacı, filtre: hata/uyarı/bilgi).
4. Saklama: 30 gün (E-25).

## 3. Kabul kriterleri

1. Okunmamış sayacı doğru.
2. Filtre çalışır.
3. Okundu işaretleme kalıcı.

## 4. Test kriterleri

- [ ] notifications.test.ts: okuma, sayaç, filtre

## 5. Riskler ve dikkat edilecekler

—

## 6. Kapsam dışı

Push bildirimi (Windows bildirim merkezi).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-19 — Olay akışı telafisi (yeniden oynatma)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-19 |
| **Modül** | İzleme |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | events, db |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-19 |

## 1. Neden gerekli

Arayüz yeniden bağlandığında (pencere yenileme, uyku) arada olan olaylar kaybolur; görev durumu bayat kalır.

## 2. Teknik uygulama

1. Her olaya monoton `seq` (SQLite `AUTOINCREMENT` veya `kv_store` sayaç).
2. Olaylar `event_log` tablosuna yazılır (son 1 saat / 5.000 olay).
3. `GET /api/events?since=<seq>` → kaçan olaylar döner (SSE başında).
4. Arayüz abone olurken son `seq`'i saklar (localStorage); yeniden bağlanmada `since` gönderir.
5. Kayıp çok eskiyse (log kırpılmış) → arayüz tam durum yeniler (fallback).

## 3. Kabul kriterleri

1. Pencere yenilenince görev durumu doğru kalır.
2. Kırpılmış log durumunda tam yenileme yapılır.
3. Olay sırası bozulmaz.

## 4. Test kriterleri

- [ ] events-replay.test.ts: seq, since, kırpma

## 5. Riskler ve dikkat edilecekler

Olay tablosu büyümesi → saklama (E-25).

## 6. Kapsam dışı

WebSocket; şimdilik SSE yeterli.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

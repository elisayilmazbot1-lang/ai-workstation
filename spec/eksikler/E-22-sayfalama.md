# E-22 — İmleç tabanlı sayfalama

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-22 |
| **Modül** | Genel |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | server, src |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-22 |

## 1. Neden gerekli

Tüm listeler tek seferde. 10.000 görev/denetim kaydında yanıt yavaşlar, arayüz donar. Ölçeklenme sınırı §14.4'te 10.000 görev dedi; bu sayıya sayfalamasız ulaşılamaz.

## 2. Teknik uygulama

1. Sözleşme: `GET /api/tasks?limit=50&cursor=<base64(createdAt|id)>` → `{ items, nextCursor, total? }`.
2. Uygulama: `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?`.
3. Uygulanacak uç noktalar: `tasks`, `audit`, `agent-runs`, `terminal/history`, `changes`, `notifications`, `test runs`.
4. Arayüz: `usePagedList` kancası — 'daha fazla yükle' + sonsuz kaydırma (isteğe bağlı).
5. Geriye uyumluluk: `cursor` yoksa ilk sayfa döner (mevcut davranış korunur).

## 3. Kabul kriterleri

1. 10.000 kayıtta ilk sayfa < 200 ms.
2. Sayfalar arası kayıt tekrarlanmaz/atlanmaz.
3. Filtre + sayfalama birlikte çalışır.

## 4. Test kriterleri

- [ ] pagination.test.ts: sıra, sınır, filtre kombinasyonu
- [ ] perf: 10k kayıt

## 5. Riskler ve dikkat edilecekler

Sayfalama sırasında yeni kayıt eklenirse kayma olur → imleç tabanlı tasarım bunu çözer.

## 6. Kapsam dışı

Sunucu tarafı arama motoru.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

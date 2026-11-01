# E-21 — Görev öncelik kuyruğu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-21 |
| **Modül** | Görevler |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | orchestrator, tasks |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-21 |

## 1. Neden gerekli

Paralel sınır dolduğunda yeni görev 'kuyrukta' deniyor ama gerçek bir kuyruk yok; sıra rastgele.

## 2. Teknik uygulama

1. `tasks.priority` (0–9, varsayılan 5) ve `queued_at`.
2. Orkestratör boş kapasite olduğunda `ORDER BY priority DESC, queued_at ASC` ile başlatır.
3. Arayüz: görev listesinde öncelik değiştirme (yukarı/aşağı).
4. Adalet: aynı öncelikte FIFO; uzun bekleyen görev 30 dk sonra önceliği +1 (açlık önleme).

## 3. Kabul kriterleri

1. Yüksek öncelikli görev önce başlar.
2. Uzun bekleyen görev yükseltilir.
3. Sıra deterministik.

## 4. Test kriterleri

- [ ] queue.test.ts: sıralama, açlık önleme

## 5. Riskler ve dikkat edilecekler

Açlık önleme yanlış uygulanırsa öncelik anlamsızlaşır.

## 6. Kapsam dışı

Kaynak bazlı (CPU/bellek) planlama.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-32 — Ağır işler için çocuk süreç, bellek sınırı, otomatik yeniden başlatma

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-32 |
| **Modül** | Performans |
| **Öncelik** | **P1** |
| **Efor** | L |
| **Bağımlılıklar** | electron, backend |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-32 |

## 1. Neden gerekli

Proje taraması, indeksleme ve test koşuları ana süreçte; büyük projede arayüz donar. Ana süreç çökerse uygulama tamamen kapanır.

## 2. Teknik uygulama

1. `backend/workers/` — `worker_threads` ile: dosya indeksleme, hash, arama.
2. Test/komut koşuları zaten alt süreç (`spawn`); çıktı toplama ana süreçte yapılmamalı (akış).
3. Ana süreç çökme yakalama: `process.on('uncaughtException')` → günlük + `app.relaunch()` (tek seferlik, döngü koruması).
4. Bellek izleme: 30 sn'de bir `process.memoryUsage()`; 800 MB üstünde uyarı, 1,2 GB üstünde yeni ağır iş reddi.
5. Worker'lara görev gönderme sırası ve iptal desteği.

## 3. Kabul kriterleri

1. 10k dosya indeksleme sırasında arayüz donmaz (< 100 ms yanıt).
2. Çökme sonrası uygulama bir kez yeniden başlar.
3. Bellek sınırında ağır iş reddedilir, çökme olmaz.

## 4. Test kriterleri

- [ ] worker.test.ts: görev gönderme, iptal
- [ ] perf: arayüz yanıt süresi

## 5. Riskler ve dikkat edilecekler

Yeniden başlatma döngüsü riski → 3 denemede dur.

## 6. Kapsam dışı

Tam süreç ayrımı (arka uç ayrı süreç).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-26 — Yedek geri yükleme öncesi doğrulama ve geri alma

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-26 |
| **Modül** | Yedekleme |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | backup |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-26 |

## 1. Neden gerekli

Bozuk/yanlış yedek içe aktarımı mevcut veriyi bozabilir; şema doğrulaması ve geri dönüş yolu yok.

## 2. Teknik uygulama

1. İçe aktarma öncesi: başlık sürümü, tablo listesi, satır sayıları doğrulanır.
2. Mevcut DB'den otomatik güvenlik kopyası (`pre-import-<zaman>.db`).
3. Yükleme tek işlemde (transaction); hata olursa rollback + güvenlik kopyasına dönüş.
4. Uyumsuz şema sürümü: 'bu yedek daha yeni sürüme ait' hatası, veriye dokunulmaz.
5. Sonuç raporu: kaç tablo, kaç satır, süre.

## 3. Kabul kriterleri

1. Bozuk yedek reddedilir, veri değişmez.
2. Hata durumunda güvenlik kopyasına dönülür.
3. Yeni sürüm yedeği eski uygulamaya yüklenemez.

## 4. Test kriterleri

- [ ] backup-import.test.ts: bozuk, uyumsuz, başarılı

## 5. Riskler ve dikkat edilecekler

Kısmi yükleme riski → transaction zorunlu.

## 6. Kapsam dışı

Artımlı yedek.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

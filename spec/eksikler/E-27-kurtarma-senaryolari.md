# E-27 — Bozuk DB / disk dolu / eksik proje kurtarma

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-27 |
| **Modül** | Kurtarma |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | db, projects, electron |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-27 |

## 1. Neden gerekli

Uygulama açılışta DB'yi açamazsa sessizce kapanıyor; kullanıcı ne olduğunu bilmiyor. Disk dolduğunda yarım dosya kalabilir.

## 2. Teknik uygulama

1. Açılış sırası: DB aç → başarısızsa **kurtarma penceresi** (ayrı HTML): 'Veritabanı açılamadı' + seçenekler: yeniden dene / yedekten geri yükle / yeni başlat / tanılama dışa aktar.
2. DB bozuksa `PRAGMA integrity_check`; sonuç bozuksa `.db` dosyası `workstation.corrupt-<tarih>.db` olarak saklanır (silinmez).
3. Disk dolu: yazma öncesi boş alan kontrolü (< 50 MB → yazma reddi, açık mesaj).
4. Yazma atomik: `.tmp` dosyaya yaz → `rename`. Yarım dosya kalmaz.
5. Eksik proje: açılışta kök yol yoksa proje 'bağlantı kesildi' işaretlenir; kullanıcı yeni yol seçebilir (dosyalar korunur).
6. Kasa bozuksa: 'anahtarlar okunamadı' uyarısı, anahtarlar yeniden girilir (diğer veriler etkilenmez).

## 3. Kabul kriterleri

1. Bozuk DB ile açılışta kurtarma penceresi çıkar, uygulama çökmez.
2. Disk dolu senaryosunda yarım dosya kalmaz.
3. Eksik proje 'bağlantı kesildi' olur, silinmez.

## 4. Test kriterleri

- [ ] recovery.test.ts: integrity_check, atomik yazma, boş alan
- [ ] manuel: bozuk DB senaryosu

## 5. Riskler ve dikkat edilecekler

Kurtarma penceresi ana uygulamadan bağımsız olmalı (DB yokken çalışır).

## 6. Kapsam dışı

Otomatik onarım (veri kurtarma aracı).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

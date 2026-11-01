# E-25 — Veri saklama politikası, otomatik temizlik, VACUUM

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-25 |
| **Modül** | Veritabanı |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | db, settings |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-25 |

## 1. Neden gerekli

Denetim günlüğü, sohbet, komut geçmişi sınırsız büyür. 1 yıl sonra DB yavaşlar, yedekler şişer. Saklama kararı v1.0'da yoktu.

## 2. Teknik uygulama

1. `settings.retention = { auditDays:180, chatDays:365, commandDays:90, testDays:180, notificationDays:30 }`.
2. Günlük temizlik işi (açılışta + 24 saatte bir): `DELETE ... WHERE at < date('now', '-N days')`, parti başına 1.000 kayıt.
3. `retention_runs` tablosu: ne zaman, kaç kayıt silindi.
4. Aylık `VACUUM` (10 MB üzeri boş alan varsa) — WAL modunda `PRAGMA incremental_vacuum`.
5. Silme öncesi kullanıcıya bildirim (ilk seferde 'X kayıt silinecek').
6. Ayarlar ekranında saklama süreleri + 'şimdi temizle' düğmesi.

## 3. Kabul kriterleri

1. Süresi geçen kayıtlar silinir, yenileri korunur.
2. VACUUM dosya boyutunu düşürür.
3. Ayar 0 = sınırsız.

## 4. Test kriterleri

- [ ] retention.test.ts: sınırlar, sıfır=koru, parti silme

## 5. Riskler ve dikkat edilecekler

Yanlış tarih hesabı veri kaybı → test zorunlu.

## 6. Kapsam dışı

Arşivleme (silme yerine sıkıştırma).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-38 — Uzak proje (SSH) desteği

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-38 |
| **Modül** | Proje |
| **Öncelik** | **P4** |
| **Efor** | XL |
| **Bağımlılıklar** | files, terminal |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-38 |

## 1. Neden gerekli

Kod uzak sunucuda. Dosya ağacı/servis yerel varsayıyor.

## 2. Teknik uygulama

1. `RemoteProject` türü: `{ host, user, keyPath }`.
2. Dosya işlemleri SSH üzerinden (SFTP benzeri) — yerel servis arayüzü değişmez.
3. Terminal: `ssh -t host 'command'`.
4. Güvenlik: anahtar yolu kullanıcı seçer, kasa dışında tutulmaz; host anahtarı doğrulanır (TOFU + uyarı).
5. Bu kapsam **büyük**; yalnızca talep varsa.

## 3. Kabul kriterleri

1. Uzak dosya okuma/yazma çalışır.
2. Bilinmeyen host anahtarı uyarı verir.

## 4. Test kriterleri

- [ ] remote.test.ts (mock SSH)

## 5. Riskler ve dikkat edilecekler

Ağ gecikmesi ve hata yönetimi karmaşık; kapsam dışı bırakılabilir.

## 6. Kapsam dışı

Git tabanlı senkronizasyon (daha güvenli).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-08 — Yedek şifreleme (AES-256-GCM + parola türetme)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-08 |
| **Modül** | Yedekleme |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | backup, security |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-08 |

## 1. Neden gerekli

Yedek ZIP'i tüm proje geçmişini, ayarları ve sohbetleri düz metin taşır. Kullanıcı yedeği buluta/başka makineye koyduğunda veri açıkta kalır.

## 2. Teknik uygulama

1. `POST /api/backup/export` gövdesine `{ password?: string, encrypt?: boolean }`.
2. Parola verilirse: `scrypt(N=2^15,r=8,p=1, salt=16B)` → 32B anahtar.
3. Paket biçimi: `AWBAK1` başlığı + `salt(16) | iv(12) | ciphertext | tag(16)` (AES-256-GCM).
4. İçe aktarmada parola sorulur; yanlışsa 'parola hatalı' (çökme yok, veri korunur).
5. Parolasız yedek uyarı ile izinli ('şifresiz yedek — önerilmez').
6. Parola asla saklanmaz; yalnızca türetilmiş anahtar bellekte (kullanım sonrası sıfırlanır).

## 3. Kabul kriterleri

1. Şifreli yedek yanlış parola ile açılamaz.
2. Doğru parola ile geri yükleme birebir aynı veriyi verir.
3. Şifreli yedeğin içinde düz metin anahtar/sohbet bulunmaz (binary tarama testi).

## 4. Test kriterleri

- [ ] backup-crypto.test.ts: şifreleme, yanlış parola, bozuk tag
- [ ] E2E: export→import turu

## 5. Riskler ve dikkat edilecekler

Parola kaybı veri kaybıdır → arayüzde iki kez doğrulama + uyarı.

## 6. Kapsam dışı

Kasa anahtarlarının yedeğe dahil edilmesi (DPAPI makineye bağlı olduğu için zaten taşınamaz).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

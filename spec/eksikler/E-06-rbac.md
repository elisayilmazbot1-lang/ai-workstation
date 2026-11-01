# E-06 — Rol tabanlı yetkilendirme ve oturum kilidi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-06 |
| **Modül** | Güvenlik |
| **Öncelik** | **P1** |
| **Efor** | L |
| **Bağımlılıklar** | security, server, users |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-06 |

## 1. Neden gerekli

Tek kullanıcı varsayımı paylaşılan makinede tehlikeli: onay veren kişi ile proje sahibi aynı olmayabilir. 'Yetkilendirme' v1.0'da tanımsızdı.

## 2. Teknik uygulama

1. `users` tablosu: `id, name, role('owner'|'operator'|'viewer'), pin_hash, created_at`.
2. Varsayılan kurulum tek `owner`. Ayarlar → Kullanıcılar (yalnızca owner).
3. Yetki matrisi:
   - `viewer`: okuma (proje, dosya, görev, test sonuçları). Onay veremez, görev başlatamaz.
   - `operator`: görev başlatır, onay verir, terminal çalıştırır. Sağlayıcı/ayar değiştiremez.
   - `owner`: tümü + kullanıcı/anahtar yönetimi.
4. `requireRole(req, 'operator')` middleware; `routes.ts` içinde her uç noktaya rol etiketi.
5. Oturum kilidi: 15 dk hareketsizlik → `locked=true`; onay/komut uç noktaları `423 LOCKED` döner; PIN ile açılır (bcrypt, 6 hane).
6. Denetim: rol değişikliği ve kilit olayları `critical` riskle yazılır.

## 3. Kabul kriterleri

1. viewer rolüyle onay verme denemesi 403 döner.
2. Kilitliyken onay/komut reddedilir, okuma çalışır.
3. Yanlış PIN 5 denemede 1 dk bekletme uygular.
4. Tüm uç noktaların rol etiketi vardır (sözleşme testi).

## 4. Test kriterleri

- [ ] rbac.test.ts: rol matrisi tüm uç noktalar
- [ ] lock.test.ts: kilit, PIN, bekletme

## 5. Riskler ve dikkat edilecekler

Yanlış yapılandırma kullanıcıyı kilitler → 'kurtarma anahtarı' (kurulumda üretilen tek seferlik kod) gerekli.

## 6. Kapsam dışı

Ağ üzerinden çok kullanıcı / SSO / LDAP.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-37 — Git entegrasyonu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-37 |
| **Modül** | Proje |
| **Öncelik** | **P2** |
| **Efor** | L |
| **Bağımlılıklar** | terminal, projects, approvals |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-37 |

## 1. Neden gerekli

Geliştiricinin ilk beklediği özellik: değişiklikleri görmek, commit atmak, dal değiştirmek. Şu an her şey elle terminalden.

## 2. Teknik uygulama

1. `backend/git/git-service.ts`: `status`, `diff`, `log`, `branch list`, `checkout`, `commit` (yalnızca `simple-git` değil, doğrudan `git` çağrısı — bağımlılık eklemez).
2. Tüm işlemler terminal risk sınıflandırmasından geçer; `commit`, `checkout`, `push` onay ister.
3. `push` varsayılan **kapalı** (ayarla açılır) — yanlışlıkla uzak depoya yazmayı önler.
4. Arayüz: Kod Editörü → Git paneli (değişen dosyalar, diff, commit kutusu).
5. Ajan önerileri commit'e otomatik girmez; kullanıcı seçer.

## 3. Kabul kriterleri

1. status/diff doğru gösterilir.
2. commit onaylı çalışır.
3. push kapalıyken denenirse açık hata.

## 4. Test kriterleri

- [ ] git.test.ts: geçici depo ile status/diff/commit
- [ ] E2E: onaysız commit 403

## 5. Riskler ve dikkat edilecekler

Kullanıcı deposunu bozma riski: force işlemleri hiç sunulmaz.

## 6. Kapsam dışı

Uzak depo kimlik doğrulama (token saklama).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

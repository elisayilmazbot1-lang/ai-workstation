# E-09 — Tarayıcı senaryo kaydı/oynatma ve form akışı

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-09 |
| **Modül** | Tarayıcı |
| **Öncelik** | **P2** |
| **Efor** | L |
| **Bağımlılıklar** | browser, approvals, db |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-09 |

## 1. Neden gerekli

Şu an tek tek tıklama yapılıyor. Tekrarlayan akışlar (giriş formu doldurma, listeleme) her seferinde elle yapılıyor; 'otomasyon' vaadi karşılanmıyor.

## 2. Teknik uygulama

1. `browser_scenarios` tablosu: `id, name, steps_json, created_at`.
2. Adım tipleri: `goto`, `read`, `click`, `type`, `waitFor(selector, timeoutMs)`, `screenshot`, `assertText`.
3. Kayıt modu: kullanıcı işlemleri kaydeder (her adım onaylı).
4. Oynatma: adım adım, her yazma/tıklama öncesi **tek toplu onay** ('bu senaryoyu çalıştır').
5. Hata: adım başarısız → durur, ekran görüntüsü alır, hangi adımda olduğunu söyler.
6. Güvenlik: CAPTCHA/oturum duvarı tespit edilirse senaryo durur (otomasyon yapılmaz).

## 3. Kabul kriterleri

1. 5 adımlı senaryo kaydedilip oynatılabilir.
2. Başarısız adımda doğru rapor + ekran görüntüsü.
3. Onaysız oynatma çalışmaz.

## 4. Test kriterleri

- [ ] scenario.test.ts: adım yürütme, hata, durdurma
- [ ] E2E: sahte sayfa ile senaryo

## 5. Riskler ve dikkat edilecekler

Sayfa değişimi senaryoyu kırar → seçicilerin kırılganlığı; 'assertText' ile erken uyarı.

## 6. Kapsam dışı

Görsel eşleştirme / AI tabanlı seçici.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-28 — Tanılama paketi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-28 |
| **Modül** | Destek |
| **Öncelik** | **P2** |
| **Efor** | S |
| **Bağımlılıklar** | server, audit, settings |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-28 |

## 1. Neden gerekli

Kullanıcı sorun bildirdiğinde hangi bilgiyi göndereceğini bilmiyor; destek süreci spekülasyonla ilerliyor.

## 2. Teknik uygulama

1. `POST /api/diagnostics/export` → ZIP:
   - `manifest.json` (sürüm, işletim sistemi, modül durumları, son 20 hata kimliği)
   - `logs/tail.log` (son 500 satır, maskelenmiş)
   - `settings.json` (anahtarlar hariç)
   - `audit-tail.json` (son 50 kayıt)
   - `system.json` (RAM, disk, node/electron sürümleri)
2. Boyut sınırı 5 MB; aşılırsa kırpılır ve manifest'te belirtilir.
3. Anahtar/parola taraması: paket oluşturulmadan önce `redactText` + regex taraması; eşleşme varsa üretim iptal edilir (fail-closed).

## 3. Kabul kriterleri

1. Pakette anahtar/parola bulunmaz (test ile).
2. Paket 5 MB'ı geçmez.
3. Sürüm ve modül durumları eksiksiz.

## 4. Test kriterleri

- [ ] diagnostics.test.ts: maskeleme, boyut, manifest

## 5. Riskler ve dikkat edilecekler

Maskeleme kaçırırsa veri sızıntısı → fail-closed ve test.

## 6. Kapsam dışı

Otomatik gönderim (gizlilik nedeniyle yok).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

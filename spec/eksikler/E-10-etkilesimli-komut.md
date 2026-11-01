# E-10 — Etkileşimli komut desteği (stdin)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-10 |
| **Modül** | Terminal |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | terminal, approvals |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-10 |

## 1. Neden gerekli

`npm init`, `gh auth login`, `az login` gibi komutlar stdin bekler ve şu an zaman aşımına uğruyor. Kullanıcı bunu 'bozuk' olarak algılıyor.

## 2. Teknik uygulama

1. `POST /api/terminal/sessions` ile oturum açılır (mevcut).
2. `POST /api/terminal/sessions/:id/input` → `{ data: string }` (satır sonu dahil).
3. `GET /api/terminal/sessions/:id/stream` (SSE) canlı çıktı.
4. Güvenlik: stdin yalnızca **kullanıcı** gönderebilir; ajanlar gönderemez (onaylı olsa bile).
5. Risk: etkileşimli oturum açmak `medium` onayı gerektirir; oturum 30 dk sonra kapanır.
6. Kayıt: tüm girdi/çıktı maskelenerek saklanır.

## 3. Kabul kriterleri

1. Etkileşimli komut çıktısını canlı gösterir.
2. Ajan stdin gönderemez (403).
3. Oturum zaman aşımında kapanır.

## 4. Test kriterleri

- [ ] interactive.test.ts: oturum, input, akış, yetki

## 5. Riskler ve dikkat edilecekler

Ajanın stdin'e veri yazması enjeksiyon vektörüdür; kesinlikle kapalı tutulmalı.

## 6. Kapsam dışı

Tam PTY (satır düzenleme, renk) — şimdilik düz boru.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-36 — Eklenti/araç kayıt sistemi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-36 |
| **Modül** | Genişletme |
| **Öncelik** | **P4** |
| **Efor** | XL |
| **Bağımlılıklar** | agents, security |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-36 |

## 1. Neden gerekli

Yeni araç eklemek her seferinde çekirdek koda dokunmayı gerektiriyor. Üçüncü taraf genişletme imkânsız.

## 2. Teknik uygulama

1. `ToolRegistry`: `register({name, schema, risk, handler, permissions})`.
2. Ajan istemi araç şemalarını alır; model araç çağrısı yapar → doğrulama → onay → çalıştırma.
3. Eklenti klasörü `%APPDATA%/AIWorkstation/plugins/*.js` — **imzalı** ve kullanıcı onaylı yüklenir.
4. Eklenti sandbox: ayrı worker, yalnızca izinli API'ler.
5. Risk: eklenti = kod çalıştırma → varsayılan kapalı.

## 3. Kabul kriterleri

1. Kayıtlı araç ajan tarafından çağrılabilir.
2. İzinsiz eklenti yüklenmez.

## 4. Test kriterleri

- [ ] registry.test.ts: kayıt, izin, risk

## 5. Riskler ve dikkat edilecekler

Güvenlik yüzeyi çok büyür; imza zorunlu olmadan yayınlanmamalı.

## 6. Kapsam dışı

Pazaryeri / uzaktan eklenti indirme.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

# E-44 — Yerel kullanım telemetrisi (isteğe bağlı)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-44 |
| **Modül** | İzleme |
| **Öncelik** | **P4** |
| **Efor** | M |
| **Bağımlılıklar** | usage_events, settings |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-44 |

## 1. Neden gerekli

Hangi özellik kullanılıyor bilinmiyor; iyileştirme körlemesine. Ancak gizlilik nedeniyle dışarı gönderim yapılmamalı.

## 2. Teknik uygulama

1. Yalnızca **yerel** sayaçlar: sayfa açılma, görev başlatma, test koşusu, hata sayısı.
2. `usage_events` benzeri `feature_usage` tablosu; kişisel veri/dosya adı yok.
3. `GET /api/usage/features` → özet; Ayarlar'da 'kullanım istatistikleri' ekranı.
4. **Dışarı gönderim yok** (varsayılan ve tek seçenek). Kullanıcı dilerse JSON dışa aktarır.
5. Kapatma anahtarı.

## 3. Kabul kriterleri

1. Sayaçlar doğru artar.
2. Hiçbir ağ isteği yapılmaz.

## 4. Test kriterleri

- [ ] usage.test.ts: sayaç, dışa aktarma

## 5. Riskler ve dikkat edilecekler

Gizlilik algısı: 'telemetri' kelimesi korkutabilir → 'yerel kullanım istatistikleri' olarak adlandırılmalı.

## 6. Kapsam dışı

Anonim toplu gönderim (kullanıcı onayıyla).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

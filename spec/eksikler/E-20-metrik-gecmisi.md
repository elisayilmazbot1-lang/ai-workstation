# E-20 — Metrik geçmişi ve grafikler

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-20 |
| **Modül** | İzleme |
| **Öncelik** | **P3** |
| **Efor** | M |
| **Bağımlılıklar** | usage_events, test_runs |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-20 |

## 1. Neden gerekli

'Neden yavaşladı', 'hangi model daha çok harcıyor' soruları yanıtsız; yalnızca anlık değer var.

## 2. Teknik uygulama

1. Toplama işi (günde bir): `metrics_daily` tablosu — tarih, token, maliyet, görev sayısı, test geçme oranı, ortalama süre.
2. `GET /api/metrics?from&to&groupBy=day|model`.
3. Arayüz: Geçmiş → Grafikler; hafif SVG çizim (harici kütüphane yok).
4. Sınırlar: en fazla 180 gün, 3 seri.

## 3. Kabul kriterleri

1. Günlük seri doğru toplanır.
2. 180 günden uzun aralık reddedilir.

## 4. Test kriterleri

- [ ] metrics.test.ts: toplama, aralık

## 5. Riskler ve dikkat edilecekler

Yanlış toplama yanlış karar verdirir → test zorunlu.

## 6. Kapsam dışı

Gerçek zamanlı dashboard (E-33 ile).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

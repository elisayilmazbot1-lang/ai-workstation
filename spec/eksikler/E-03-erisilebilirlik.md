# E-03 — Erişilebilirlik (klavye, ARIA, odak)

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-03 |
| **Modül** | Arayüz |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | src |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-03 |

## 1. Neden gerekli

Şu an fare olmadan uygulama kullanılamıyor; ekran okuyucu etiketleri yok. Kurumsal/kamu kullanımında erişilebilirlik şart.

## 2. Teknik uygulama

1. Tüm etkileşim öğeleri `button`/`a`/`input` yerine doğru semantikle; `div onClick` yasak.
2. Odak halkası: `focus-visible` stili (koyu temada kontrast ≥ 3:1).
3. Sayfa geçişinde `tabIndex={-1}` başlığa odak + `aria-live` duyuru.
4. Modallar: odak tuzağı, `Esc` kapat, `aria-modal`.
5. Durum rozetlerine `aria-label` (ör. risk seviyesi).
6. Renk tek başına anlam taşımayacak (risk ikonu + metin).

## 3. Kabul kriterleri

1. 14 sayfa klavyeyle gezilebilir (Tab sırası mantıklı).
2. Kontrast denetimi WCAG AA (4.5:1 metin).
3. Modal açıkken odak dışına çıkılmaz.

## 4. Test kriterleri

- [ ] axe-core otomatik denetim (0 kritik ihlal)
- [ ] manuel klavye senaryosu

## 5. Riskler ve dikkat edilecekler

Mevcut koyu tema renklerinin kontrastı yetersiz olabilir; palet revizyonu gerekebilir.

## 6. Kapsam dışı

Tam WCAG AAA.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

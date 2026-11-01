# E-02 — React hata sınırları ve kurtarma ekranı

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-02 |
| **Modül** | Arayüz |
| **Öncelik** | **P1** |
| **Efor** | S |
| **Bağımlılıklar** | src, useAppStore |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-02 |

## 1. Neden gerekli

Herhangi bir bileşende oluşan hata tüm uygulamayı beyaz ekrana düşürür. Denetimde `RightRail` hatası tam olarak bunu yapmıştı (sayfa tamamen boş kaldı).

## 2. Teknik uygulama

1. `src/components/ErrorBoundary.tsx`: `componentDidCatch` + `getDerivedStateFromError`.
2. Sayfa düzeyinde `<ErrorBoundary key={page}>` — hata durumunda yalnızca o sayfa kurtarma kartı gösterir, menü çalışmaya devam eder.
3. Kök düzeyde ikinci bir sınır: tam çökmede "Yeniden yükle" + "Tanılama paketi indir" düğmesi.
4. Hata kimliği (`nanoid`) üretilir, `POST /api/diagnostics/client-error` ile günlüğe yazılır (mesaj maskelenir).
5. Geliştirme modunda yığın izi, üretimde yalnızca kimlik + kısa mesaj gösterilir.

## 3. Kabul kriterleri

1. Bir bileşen hata fırlattığında menü ve diğer sayfalar çalışır.
2. Kök sınır hatayı yakalar, beyaz ekran oluşmaz.
3. Hata kimliği günlükte bulunabilir.

## 4. Test kriterleri

- [ ] error-boundary.test.tsx: hata fırlatan bileşen → kurtarma kartı

## 5. Riskler ve dikkat edilecekler

Geliştirme sırasında gizlenen hatalar: yığın izi geliştirme modunda görünmeli.

## 6. Kapsam dışı

—

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

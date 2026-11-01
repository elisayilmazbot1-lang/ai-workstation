# E-16 — Görev şablonları

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-16 |
| **Modül** | Görevler |
| **Öncelik** | **P3** |
| **Efor** | M |
| **Bağımlılıklar** | tasks, orchestrator |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-16 |

## 1. Neden gerekli

Her seferinde aynı uzun açıklama yazılıyor ('yeni özellik ekle', 'hata ayıkla'). Şablon, plan kalitesini ve tekrar kullanımı artırır.

## 2. Teknik uygulama

1. `task_templates` tablosu: `id, name, kind, prompt_template, default_files, created_at`.
2. Yerleşik şablonlar: 'Yeni özellik', 'Hata düzeltme', 'Refactor', 'Test kapsamı', 'Bağımlılık güncelle'.
3. Arayüz: Görevler → Yeni görev → şablon seç → alanlar doldurulur.
4. Değişkenler: `{{dosya}}`, `{{hata_metni}}`, `{{hedef}}`; boş bırakılırsa uyarı.

## 3. Kabul kriterleri

1. Şablondan görev oluşturulunca plan doğru üretilir.
2. Bilinmeyen değişken görev oluşturmayı engeller.

## 4. Test kriterleri

- [ ] template.test.ts: değişken doldurma, doğrulama

## 5. Riskler ve dikkat edilecekler

Şablonlar eskiyebilir → sürüm alanı.

## 6. Kapsam dışı

Şablon paylaşımı (dışa aktarma).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

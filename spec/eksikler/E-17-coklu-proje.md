# E-17 — Çoklu proje bağlamı

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-17 |
| **Modül** | Proje |
| **Öncelik** | **P3** |
| **Efor** | L |
| **Bağımlılıklar** | projects, files, orchestrator |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-17 |

## 1. Neden gerekli

Gerçek işlerde (frontend + backend) iki proje birlikte ele alınır. Şu an görev tek projeye bağlı.

## 2. Teknik uygulama

1. `tasks.project_id` yanına `project_ids_json` eklenir (geriye uyumlu: eski alan korunur).
2. Plan adımlarında `projectId` alanı zorunlu hale gelir (tek projede varsayılan).
3. Dosya kilidi ve yol doğrulaması proje bazında yapılır (aynı göreli yol iki projede çakışmaz).
4. Bağlam toplama her proje için ayrı bütçe ile çalışır (toplam sabit).
5. Rapor dosyaları `proje:yol` biçiminde gösterilir.

## 3. Kabul kriterleri

1. İki projeli görev planı doğru üretilir.
2. Aynı göreli yol iki projede çakışmaz.
3. Tek projeli görevler etkilenmez.

## 4. Test kriterleri

- [ ] multi-project.test.ts: plan, kilit, rapor

## 5. Riskler ve dikkat edilecekler

Karmaşıklık artışı: kullanıcıya proje seçimi zorunlu kılınmalı.

## 6. Kapsam dışı

Uzak/depo dışı projeler.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

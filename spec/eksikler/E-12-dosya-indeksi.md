# E-12 — Kalıcı dosya indeksi ve artımlı bağlam

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-12 |
| **Modül** | Proje/Dosya |
| **Öncelik** | **P1** |
| **Efor** | L |
| **Bağımlılıklar** | files, projects, db |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-12 |

## 1. Neden gerekli

Bağlam her istekte dosya sistemini tarıyor. 10.000+ dosyalı projede bu saniyeler sürer ve ana süreci bloklar. `project_files` tablosu var ama boş.

## 2. Teknik uygulama

1. `POST /api/projects/:id/index` → arka plan işi (E-32 çocuk süreç): ağaç taraması, `project_files` doldurma (`path, size, mtime, hash, language, is_binary`).
2. Artımlı: `mtime+size` değişmediyse hash hesaplanmaz.
3. `project.indexedAt` alanı; arayüzde 'indekslendi — n dosya' göstergesi.
4. Bağlam toplama artık indeksten aday seçer, yalnızca seçilenleri okur (hedef: < 300 ms).
5. Sınır: 50.000 dosya; aşarsa kısmi indeks + uyarı. `.gitignore` kurallarına saygı (basit glob).
6. İndeks silinince/bozulunca tam tarama yapılır (idempotent).

## 3. Kabul kriterleri

1. 10.000 dosyalı projede indeksleme < 60 sn.
2. İkinci bağlam toplama < 300 ms (indeksli).
3. Değişen dosya indekste güncellenir.
4. Hassas dosyalar indekse girmez.

## 4. Test kriterleri

- [ ] index.test.ts: tarama, artımlı, limit, .gitignore
- [ ] perf: 10k dosya senaryosu

## 5. Riskler ve dikkat edilecekler

Hash hesaplama CPU tüketir → yalnızca değişen dosyada.

## 6. Kapsam dışı

Semantik (vektör) arama.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

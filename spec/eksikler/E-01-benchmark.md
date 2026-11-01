# E-01 — Gerçek model benchmark koşucusu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-01 |
| **Modül** | Model Merkezi |
| **Öncelik** | **P1** |
| **Efor** | L |
| **Bağımlılıklar** | providers, gateway, tests, model_measurements |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-01 |

## 1. Neden gerekli

v1.0 'gerçek test sonuçlarına göre sıralama' diyor; ancak ölçümü üreten bir koşucu yok. `model_measurements` tablosu boş kaldığı sürece sıralama ölü özelliktir; kullanıcı modele güvenmek için hiçbir kanıt göremez.

## 2. Teknik uygulama

1. `spec/benchmarks/*.json` altına yetenek başına 5 deterministik istem yaz (coding, reasoning, tools, vision, general).
2. `backend/ai/benchmark-service.ts`:
   - `run(modelId, capability)` → istemleri sırayla gönderir (temperature=0, max_tokens sabit).
   - Her istem için `expect` alanı: `contains`, `regex`, `json_keys`, `exact`.
   - `score = geçen / toplam × 100`, `samples` artırılır.
3. `POST /api/models/:id/benchmark` (onay: low risk, maliyet uyarısı ile) ve `POST /api/models/benchmark-all` (kuyruk, sınır 3 eşzamanlı).
4. Ağırlıklı ortalama: `score_new = (score_old*samples + score_run)/(samples+1)`.
5. Arayüz: model kartında "ölçüldü/ölçülmedi" ve puan; sıralama seçeneğinde yalnızca `samples>0` kullanılır.
6. Maliyet öncesi tahmini token × fiyat gösterilir; kullanıcı onayı olmadan koşulmaz.

## 3. Kabul kriterleri

1. Model kartında puan yalnızca `samples>0` ise görünür; aksi hâlde 'ölçülmedi'.
2. Benchmark koşusu onay isteği üretir (maliyet gerekçeli).
3. Aynı istem seti iki kez koşulduğunda puan ±5 dışında sapmaz (deterministik).
4. Sağlayıcı 429 dönerse koşu `partial` işaretlenir, puan hesaplanmaz.

## 4. Test kriterleri

- [ ] benchmark-service.test.ts: puan hesabı, ağırlıklı ortalama, determinizm
- [ ] e2e: sahte sağlayıcı ile benchmark → sıralama değişir

## 5. Riskler ve dikkat edilecekler

Yanlış puanlama kullanıcıyı yanlış modele yönlendirir. Ücretsiz kota tüketimi: benchmark maliyetli olabilir, bu yüzden onay zorunlu.

## 6. Kapsam dışı

Tüm modelleri otomatik gece koşusu (kota tüketir) — yalnızca manuel/planlı.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

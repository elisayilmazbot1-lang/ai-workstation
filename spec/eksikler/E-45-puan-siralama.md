# E-45 — Model puanına göre sıralama (arayüz) ve ölçüm kaydı bağlantısı

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-45 |
| **Modül** | Model Merkezi / Arayüz |
| **Öncelik** | **P1** |
| **Efor** | S |
| **Bağımlılıklar** | E-01 (benchmark koşucusu), provider-service, ModelsPage |
| **Durum** | `[EKSİK]` — denetimde tespit edildi |
| **Şartname maddesi** | §4.5 / §26 / §32 |

## 1. Neden gerekli

Denetimde **belge ile kod arasında gerçek bir uyuşmazlık** bulundu:

- `README_TR.md` §6: "Sıralama: ad, bağlam penceresi, giriş/çıkış fiyatı, **gerçek test sonucu**" diyor.
- Gerçek durum (`src/pages/ModelsPage.tsx:42`):
  ```ts
  const [sort, setSort] = useState<'name' | 'cost' | 'context'>('name');
  ```
  Yani **puan sıralaması yok**.
- `provider-service.recordMeasurement()` tanımlı ama **hiçbir yerden çağrılmıyor** (tek referans tanımın kendisi). Dolayısıyla `model_measurements` tablosu her zaman boş kalır; `coding_score` alt sorgusu daima `NULL` döner.

Sonuç: v1.0'ın "gerçek test sonuçlarına göre sıralama" maddesi **hem veri hem arayüz tarafında karşılanmıyor**. Bu, A1 (kanıtsız "tamamlandı" yok) ilkesinin ihlalidir ve düzeltilmeden belge doğru sayılamaz.

## 2. Teknik uygulama

1. **Veri bağlantısı (E-01 ile):** benchmark koşucusu her koşuda `recordMeasurement()` çağırır; `model_benchmarks` geçmişi (E-14) de yazılır.
2. **API:** `GET /api/models?sort=rating&capability=coding` desteklenir.
   - `ORDER BY (SELECT score FROM model_measurements WHERE model_id=m.id AND capability=?) DESC NULLS LAST`.
   - SQLite'ta `NULLS LAST` için `ORDER BY score IS NULL, score DESC`.
3. **Sözleşme:** `Routes['GET /api/models']` `sort` alanı `'name'|'cost'|'context'|'rating'` birleşimine daraltılır (bugün serbest `string`).
4. **Arayüz:** `ModelsPage` sıralama listesine **"Puan (ölçülen)"** seçeneği eklenir.
   - Kart üzerinde puan rozeti: `82` + `samples` (kaç koşu).
   - `samples === 0` ise rozet **"ölçülmedi"** (0 puan gösterilmez — yanıltıcı olur).
5. **Boş durum:** hiç ölçüm yoksa sıralama seçeneği pasif + "önce benchmark çalıştırın" açıklaması + E-01 düğmesine bağlantı.
6. **Belge düzeltmesi:** README'deki cümle, özellik tamamlanana kadar "planlanan" olarak işaretlenir (bu kayıt kapanınca düzeltilir).

## 3. Kabul kriterleri

1. `samples > 0` olan modeller puana göre azalan sıralanır.
2. `samples === 0` modeller listenin sonunda ve "ölçülmedi" rozetiyle görünür; sayısal puan gösterilmez.
3. Hiç ölçüm yokken sıralama seçeneği pasif ve nedeni yazılı.
4. Puan sıralaması, yetenek filtresiyle birlikte doğru çalışır (`coding` seçiliyken `coding` puanı).
5. API `sort=rating` geçersiz yetenek adı verilirse 400 döner (sessiz yok sayma yok).

## 4. Test kriterleri

- [ ] `models-sort.test.ts`: rating sıralaması, NULL sona, yetenek eşleşmesi
- [ ] `models-sort.test.ts`: ölçüm yokken boş durum
- [ ] sözleşme testi: `sort` birleşim tipi geçersiz değeri reddeder
- [ ] E2E: benchmark → sıralama değişir → rozet görünür

## 5. Riskler ve dikkat edilecekler

- Puanı olmayan modeli "0" göstermek kullanıcıyı yanıltır → **"ölçülmedi"** metni zorunlu.
- Tek koşuya dayalı puan güvenilmez → `samples < 3` ise rozet "düşük güven" ipucu taşımalı.
- Yanlış sıralama, kullanıcıyı pahalı modele yönlendirebilir; fiyat sıralaması her zaman ayrı seçenek olarak kalır.

## 6. Kapsam dışı

- Otomatik gece benchmark koşusu (kota tüketir) — E-01 kapsamında manuel/planlı.
- Kullanıcı bazlı puan ağırlıklandırma.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

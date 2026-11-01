# E-48 — İptal işaretleme: test ve sohbet sonuçlarında `cancelled` durumu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-48 |
| **Modül** | Test Merkezi / Sohbet / Güvenlik |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | `shared/types/runtime.ts`, `backend/testing/test-service.ts`, `backend/ai/chat-service.ts`, `backend/ai/gateway.ts`, `backend/database/schema.ts` |
| **Durum** | **`[KOD]`** — uygulandı ve test edildi (9 yeni test) |
| **Şartname maddesi** | §15.2 / §15.3 / §15.4 / §32 U10 |

## 1. Neden gerekli

Denetimde **iki ayrı ama aynı kökli** kusur bulundu (§32 U10):

**(a) Test tarafı — tür sözleşmesi eksikti.**

```ts
// ÖNCE (shared/types/runtime.ts:185)
export type TestOutcome = 'passed' | 'failed' | 'skipped' | 'not-run';
```

Şartname §15.2 `error` ve `cancelled` durumlarını tanımlıyordu ama tür bunları taşımıyordu. Sonuç: altyapı hatası (`exitCode === null`, süreç hiç başlamadı) **`failed`**, kullanıcı iptali **`failed`** olarak raporlanıyordu. Bir testin "başarısız" olması ile "çalıştırılamaması" aynı kutuya düşüyordu — bu, hata ayıklamayı yanıltır ve "test geçmedi" suçlamasını yanlış yere yöneltir.

**(b) Sohbet tarafı — iptal işaretlenmiyordu.**

Akış iptal edildiğinde (`AbortController.abort()`) yarım yanıt **hiç kaydedilmiyordu**. Kullanıcı "Durdur"a bastığında yazılan yarım yanıt kayboluyor, sohbet geçmişinde hiçbir iz kalmıyordu. Şartname §5.1 "kısmi yanıt `cancelled` kaydedilir" diyordu; kod bunu yapmıyordu.

Ayrıca **acil durdurma** yalnızca orkestratördeki ajan görevlerini durduruyordu; **sohbet/model akışları çalışmaya devam ediyordu**. Bu bir güvenlik boşluğudur: kullanıcı "her şeyi durdur" dediğinde buluta giden istekler sürüyordu.

## 2. Teknik uygulama

### 2.1 Tek veri sözleşmesi (madde 7)

`shared/types/runtime.ts`:

```ts
export type TestOutcome = 'passed' | 'failed' | 'error' | 'skipped' | 'cancelled' | 'not-run';
```

Anlam sözleşmesi (yorum olarak kodda da yazılı):

| Değer | Anlam | "Geçti" sayılır mı |
| --- | --- | --- |
| `passed` | Test çalıştı ve geçti | Evet |
| `failed` | Test çalıştı ve başarısız oldu | Hayır |
| `error` | Komut çalıştı ama altyapı hatası (ayrıştırma/izin/çökme/süreç başlamadı) | Hayır |
| `skipped` | Test bilinçli atlandı (`.skip`) | Hayır |
| `cancelled` | Kullanıcı / acil durdurma / zaman aşımı iptal etti | Hayır |
| `not-run` | Hiç denenmedi (altyapı yok, onay bekliyor, komut tanımsız) | Hayır |

Ek alanlar: `TestCaseResult.cancelReason?: 'user' | 'emergency-stop' | 'timeout'`, `TestRunReport.cancelReason`.

`ChatThreadMessage` (shared/types/app.ts):

```ts
status?: 'complete' | 'cancelled' | 'failed' | 'streaming';
cancelReason?: 'user' | 'emergency-stop' | 'timeout';
```

### 2.2 Genel durum hesabı — öncelik sırası

`backend/testing/test-service.ts`:

```
cancelled > failed > error > passed > not-run > skipped
```

Kural: **`cancelled` ve `error` hiçbir koşulda `passed` üretmez.** İptal edilen bir koşu "yeşil" görünemez.

### 2.3 Altyapı hatası ≠ başarısızlık

```ts
if (flags.cancelled)  → outcome: 'cancelled', cancelReason, cases: []
if (exitCode === null) → outcome: 'error', notRunReason: 'Test komutu çalıştırılamadı (altyapı hatası).'
```

### 2.4 Sohbet iptali kaydı

`backend/ai/chat-service.ts → stream()`:

1. Gelen parçalar (`delta`) `chunks[]` dizisinde biriktirilir.
2. Akış `AbortError` ile biterse mesaj **yine kaydedilir**: `status: 'cancelled'`, yarım içerik korunur, `cancelReason` acil durdurmadan mı kullanıcıdan mı geldiğine göre yazılır.
3. Diğer hatalar `status: 'failed'` olarak yazılır (hata metni `error` alanında).
4. Her iptal/hata `audit_logs`'a yazılır: `chat.cancelled` / `chat.failed`.

Veritabanı: yeni migration **v2** (`SCHEMA_VERSION = 2`), `messages` tablosuna `status TEXT NOT NULL DEFAULT 'complete'` ve `cancel_reason TEXT` kolonları. Migration **idempotent** (`duplicate column name` yutulur) ve **eski kurulumları yükseltir** (v1 → v2 testi: `tests/unit/migration.test.ts`).

> Not: Kolonlar `CREATE TABLE` içine **eklenmedi**; tek yol migration'dır. Böylece yeni kurulum ile eski kurulum yükseltmesi **aynı** kod yolundan geçer (tek kaynak).

### 2.5 Acil durdurma artık model akışlarını da durduruyor

`backend/ai/gateway.ts`:

```ts
abortAll(reason: 'emergency-stop' | 'user'): number  // tüm AbortController'ları iptal eder
resume(): void                                        // trafiği yeniden açar
isAborting(): boolean
```

- `chatStream()` yerel bir `AbortController` üretir, adaptöre `signal` olarak geçirir (adaptörler `request.signal`'i zaten kullanıyordu).
- **İptal edilen istek yedek modele düşmez** (fallback zinciri atlanır) — aksi hâlde "durdur" dedikten sonra başka bir sağlayıcıya istek giderdi.
- Acil durdurma etkinken yeni `chat()` / `chatStream()` çağrıları `AbortError` ile reddedilir.
- `POST /api/emergency-stop` → orkestratör + `gateway.abortAll('emergency-stop')`; yanıt `{ stopped, affected, abortedStreams }`.
- `POST /api/emergency-resume` → `gateway.resume()`.

### 2.6 Arayüz

- `ChatPage`: iptal edilen mesajda **"İptal edildi"** rozeti; yarım içerik soluk gösterilir + "Yanıt iptal edildi — tamamlanmadı." (acil durdurmada "(acil durdurma)" eklenir).
- `TestsPage`: `error` → kırmızı "Hata", `cancelled` → sarı "İptal edildi". Rozet/ikon/titreşim eşlemeleri altı durumu kapsar.

## 3. Kabul kriterleri

1. `TestOutcome` altı değeri taşır; `error` ve `cancelled` `passed` ile karışmaz.
2. İptal edilen test koşusu `overall: 'cancelled'` döner ve yeşil görünmez.
3. Çalıştırılamayan komut `outcome: 'error'` + `notRunReason` döner.
4. İptal edilen sohbet yanıtı **kaybolmaz**; `status: 'cancelled'`, yarım içerik korunur, geçmişte görünür.
5. Acil durdurma **tüm** model akışlarını iptal eder (`abortedStreams` sayısı yanıtta döner) ve iptal edilen istek yedek modele geçmez.
6. Acil durdurma etkinken yeni model isteği başlamaz; `resume()` sonrası başlar.
7. v1 veritabanı v2'ye veri kaybı olmadan yükseltilir; eski mesajlar `complete` sayılır.
8. İptal/hata olayları denetim kaydına yazılır.

## 4. Test kriterleri (gerçek çıktı)

| Test dosyası | Test sayısı | Durum |
| --- | --- | --- |
| `tests/unit/test-outcome.test.ts` | 4 | ✅ geçti |
| `tests/unit/chat-cancel.test.ts` | 4 | ✅ geçti |
| `tests/unit/migration.test.ts` | 2 | ✅ geçti |
| `tests/integration/gateway.test.ts` (yeni iptal testi dahil) | 10 | ✅ geçti |

Kapsanan davranışlar:

- [x] Tür altı durumu kapsar, başka değer yok
- [x] İptal edilen koşu `passed` değil
- [x] Çalıştırılamayan komut `error` + neden
- [x] Genel durum önceliği kaynak düzeyinde kilitli (`cancelled > failed > error > passed`)
- [x] Kullanıcı iptali → `cancelled` / `cancelReason: 'user'`, yarım içerik korunur
- [x] Acil durdurma iptali → `cancelReason: 'emergency-stop'`
- [x] Normal mesaj → `complete`; hatalı mesaj → `failed`
- [x] v1 → v2 migration: kolonlar eklenir, eski satır `complete` olur
- [x] Acil durdurma akışı iptal eder, yedek modele geçmez, yeni istek reddedilir, `resume()` açar
- [x] API sözleşmesi `abortedStreams: number` alanını doğrular

**Genel test tablosu:** `npx vitest run` → **20 dosya / 143 test geçti** (bu kayıt öncesi 18/133).

## 5. Riskler ve dikkat edilecekler

- **"İptal = başarısız" yanlış okuması:** `cancelled` ayrı tutuldu; kullanıcı iptali test kalitesini düşürmüş gibi gösterilmez.
- **Yarım yanıtın tam sanılması:** Arayüzde "tamamlanmadı" cümlesi zorunlu; rozet olmadan yarım içerik gösterilmez.
- **Yedekleme tuzağı:** İptal edilen isteğin yedek modele düşmesi sessizce maliyet üretir → kod bunu engelliyor, testle kilitli.
- **Migration çift çalışması:** Idempotent yapıldı; `duplicate column name` dışındaki hatalar yutulmaz (gerçek şema bozukluğu görünür kalır).
- **Zaman aşımı:** `cancelReason: 'timeout'` türü hazır; adaptör zaman aşımını `AbortError`'a çeviren yol test edilmedi → bu alt durum `[KISMİ]` kabul edilir (kayıt kapanışında belirtilir).

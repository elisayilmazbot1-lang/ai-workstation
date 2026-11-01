# E-47 — Sürüm kimliği ayrımı: uygulama sürümü ≠ şartname sürümü ≠ yayın durumu

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-47 |
| **Modül** | Süreç / Dağıtım |
| **Öncelik** | **P1** |
| **Efor** | S |
| **Bağımlılıklar** | `shared/constants.ts`, `package.json`, `/api/health`, `scripts/verify-release.mjs`, E-46 |
| **Durum** | **`[KOD]`** — uygulandı, `npm run verify` kapısı + `tests/unit/version.test.ts` ve `tests/unit/release-status.test.ts` ile kilitli |
| **Şartname maddesi** | §20.1 / §29 / §32.2 |

## 1. Neden gerekli

Birinci denetimin en sık karışan kavramı buydu: **"sürüm 2.0"**. Üç ayrı şey aynı sayıyla anılıyordu:

| Karışan kavram | Gerçek anlamı | Karışıklığın sonucu |
| --- | --- | --- |
| "v2.0" | **şartname** sürümü (`AWS-SPEC-2.0`) | Uygulamanın 2.0 olduğu sanıldı |
| "v1.0" | **uygulama** sürümü (`package.json`) | Şartname 2.0 iken uygulama hâlâ 1.0.0 |
| "üretime hazır" | **yayın durumu** | EXE/imza/güncelleme yokken "hazır" denildi |

Bu karışıklık somut bir yanlış beyana dönüştü: README "otomatik güncelleme altyapısına hazır" diyordu ama `electron-updater` bağımlılıklarda yoktu (§32 U6). Ayrıca **EXE üretimi**, **CI**, **kod imzalama** ve **otomatik güncelleme** tek satırda "durum" olarak toplanmıştı; biri doğrulanmadan diğerleri de doğrulanmış gibi okunuyordu.

## 2. Teknik uygulama

### 2.1 Üç ayrı sürüm alanı (kodda tek kaynak)

`shared/constants.ts`:

```ts
export const APP_VERSION = '1.0.0';        // package.json ile BİREBİR aynı olmak zorunda
export const SPEC_VERSION = '2.0';         // şartname sürümü, uygulamadan bağımsız
export const SPEC_ID = 'AWS-SPEC-2.0';     // belge kimliği
export const IMPLEMENTS_SPEC = '2.0';      // bu uygulama sürümünün hedeflediği şartname
```

Kural: `APP_VERSION` yalnızca **kod/dağıtım** değişince artar; `SPEC_VERSION` yalnızca **belge** değişince artar. İkisi birbirine bağlanmaz.

### 2.2 API yüzeyi

`GET /api/health` artık ikisini **ayrı alanlarda** döner:

```json
{ "status": "ok", "version": "1.0.0", "specVersion": "2.0", "specId": "AWS-SPEC-2.0", ... }
```

Sözleşme (`shared/types/api.ts → Routes['GET /api/health']`) `specVersion` ve `specId` alanlarını **zorunlu** kılar; sözleşme testi bunu denetler.

### 2.3 Arayüz

- `Sidebar`: iki ayrı satır — "Uygulama v1.0.0", "Şartname 2.0".
- `StatusBar`: `v1.0.0 · şartname 2.0` (ipucunda tam kimlik).
- Hiçbir ekranda tek başına "v2.0" yazmaz; şartname sürümü her zaman "şartname" sözcüğüyle geçer.

### 2.4 Otomatik kapı

`scripts/verify-release.mjs → checkVersions()` (yeni, ilk adım):

1. `package.json.version === APP_VERSION` — değilse çıkış kodu 1.
2. `spec/AI_WORKSTATION_SPEC_v2.md` başlığındaki `vX.Y` === `SPEC_VERSION` — değilse çıkış kodu 1.
3. `SPEC_VERSION` tanımsızsa çıkış kodu 1.
4. Rapor `artifacts/verify-report.json` içine `surumler: { uygulama, sartname }` yazar.

Gerçek çıktı:

```
✔ Sürüm tutarlılığı (uygulama 1.0.0 · şartname 2.0)
✔ Tür denetimi (tsc --noEmit) (6.2 sn)
✔ Testler (vitest run) (5.0 sn)
...
```

### 2.5 Dört bağımsız yayın durumu

`README_TR.md` §8 "Bilinen sınırlar" tablosunda **tek satırdan dörde** bölündü; her biri kendi etiketi ve kendi doğrulama adımıyla:

| Satır | Etiket | Dayanak (kanıt) |
| --- | --- | --- |
| **Windows EXE üretimi** | `[DOĞRULANMADI]` | `electron-builder.yml` + `scripts/build-windows.ps1` var; `.exe` hiç üretilmedi, Windows'ta hiç denenmedi |
| **CI (GitHub Actions)** | `[DOĞRULANMADI]` | `.github/workflows/build-windows.yml` var; koşu günlüğü yok |
| **Kod imzalama** | `[EKSİK]` | `electron-builder.yml`'de `certificateFile` / `azureSignOptions` / `signingHashAlgorithms` yok |
| **Otomatik güncelleme** | `[EKSİK]` | `electron-updater` `package.json`'da yok; `publish` bloğu yok |

Kural: bu dört satırdan **hiçbiri** diğerini "kurtarmaz". CI yeşil olsa bile EXE doğrulanmış sayılmaz; EXE üretilse bile imza doğrulanmış sayılmaz.

## 3. Kabul kriterleri

1. `APP_VERSION === package.json.version` — otomatik denetlenir.
2. Şartname başlığı `SPEC_VERSION` ile aynı — otomatik denetlenir.
3. `/api/health` `version`, `specVersion`, `specId` alanlarını döner; sözleşmede zorunlu.
4. README'de dört yayın durumu **ayrı satır** ve **ayrı etiket** taşır.
5. Hiçbir belgede "sürüm 2.0" tek başına uygulama sürümü anlamında kullanılmaz.
6. Sürüm uyuşmazlığı yaratıldığında `npm run verify` **çıkış kodu 1** verir.

## 4. Test kriterleri

- [x] `tests/unit/version.test.ts` — `APP_VERSION` = package.json (✅ 5 test geçti)
- [x] `tests/unit/version.test.ts` — şartname başlığı = `SPEC_VERSION` ✅
- [x] `tests/unit/version.test.ts` — sözleşmede `specVersion`/`specId` zorunlu ✅
- [x] `tests/unit/version.test.ts` — `verify-release.mjs` sürüm kapısını çalıştırıyor ✅
- [x] `tests/unit/release-status.test.ts` — dört durum ayrı satır + `electron-updater` yok + imza yapılandırması yok (✅ 5 test geçti)
- [x] `node scripts/verify-release.mjs` — "✔ Sürüm tutarlılığı (uygulama 1.0.0 · şartname 2.0)" ✅
- [ ] Negatif test: `package.json` sürümü elle bozulduğunda kapı 1 döner (CI'da yapılacak)
- [ ] Windows'ta EXE üretildiğinde satır `[DOĞRULANMADI]` → `[KOD]` (E-41 kapanışı; bu kayıt kapatmaz)

## 5. Riskler ve dikkat edilecekler

- **İki değeri tekrar birleştirme cazibesi:** "Nasılsa ikisi de 2.0/1.0" denip alan birleştirilirse karışıklık geri gelir. Ayrı alanlar `[KOD]` testlerle kilitli.
- **Etiket enflasyonu:** `[KOD]` yalnızca çalıştırılmış kanıtla verilir. Windows EXE satırı, Windows'ta denenmeden **asla** `[KOD]` olamaz — bu testle değil, insan kuralıyla korunur (README'de yazılı).
- **Kısmi doğrulama yanılgısı:** CI yeşil olması EXE'nin çalıştığını kanıtlamaz; runner'da üretilen dosyanın indirilip kurulması gerekir (E-41).
- **Sürüm atlama:** `SPEC_VERSION` artırılıp `IMPLEMENTS_SPEC` güncellenmezse izlenebilirlik kopar; `version.test.ts` `IMPLEMENTS_SPEC === SPEC_VERSION` eşitliğini denetler.

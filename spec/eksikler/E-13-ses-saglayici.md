# E-13 — Whisper/bulut STT-TTS ve sesli komutlar

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-13 |
| **Modül** | Ses |
| **Öncelik** | **P2** |
| **Efor** | M |
| **Bağımlılıklar** | voice, providers, security |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-13 |

## 1. Neden gerekli

Ayarlar ekranı `whisper-api` seçeneğini sunuyor ama arkasında kod yok — şu an **çalışmayan bir seçenek** var. Ayrıca uzun konuşma 60 sn'de kesiliyor.

## 2. Teknik uygulama

1. `backend/voice/stt-service.ts`: `transcribe(buffer, mime)` → sağlayıcı adaptörü (OpenAI `/v1/audio/transcriptions`, model `whisper-1`).
2. Kayıt: `MediaRecorder` ile 30 sn'lik parçalar; parçalar sırayla gönderilir, metin birleştirilir (uzun konuşma desteği).
3. TTS: `POST /v1/audio/speech` (opsiyonel); sistem sesi varsayılan kalır.
4. Sesli komutlar: `yeni görev <metin>`, `testleri çalıştır`, `dur` → yalnızca **onaylı** eylemler (komut çalıştırma yok).
5. Anahtar yoksa: seçenek pasif + 'sağlayıcı anahtarı gerekir' açıklaması (sessiz başarısızlık yok).

## 3. Kabul kriterleri

1. Whisper anahtarı yokken seçenek pasif ve nedenini yazar.
2. 30 sn'den uzun konuşma parçalanarak yazıya dökülür.
3. Ses dosyası istek sonrası silinir, diskte kalmaz.

## 4. Test kriterleri

- [ ] stt.test.ts: adaptör, parçalama, hata
- [ ] E2E: anahtar yok → pasif

## 5. Riskler ve dikkat edilecekler

Maliyet: Whisper dakika başına ücretlidir → kullanıcıya tahmini maliyet gösterilmeli.

## 6. Kapsam dışı

Gerçek zamanlı akış STT (realtime API).

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

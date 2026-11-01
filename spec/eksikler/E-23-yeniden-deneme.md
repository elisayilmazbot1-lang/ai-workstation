# E-23 — Yeniden deneme politikası ve zaman aşımı yapılandırması

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-23 |
| **Modül** | Orkestrasyon |
| **Öncelik** | **P1** |
| **Efor** | M |
| **Bağımlılıklar** | orchestrator, settings |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-23 |

## 1. Neden gerekli

Ağ hatasında veya 429'da kullanıcı elle tekrar ediyor; çökme sonrası `running` görevler `paused` kalıyor (denetimde açık).

## 2. Teknik uygulama

1. `settings.agents.retry = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000, retryOn: ['TIMEOUT','RATE_LIMITED','UPSTREAM_ERROR','NETWORK'] }`.
2. Üstel geri çekilme + ±%20 jitter; `AUTH_FAILED` ve `VALIDATION_ERROR` **yeniden denenmez**.
3. Her deneme `agent_runs`'a yazılır; raporda '3 denemede başarılı' görünür.
4. Zaman aşımı: adım (120 sn), görev (45 dk) ayarlanabilir.
5. Açılış kurtarma: `planning|running` durumundaki görevler açılışta `paused` işaretlenir + 'kaldığı yerden devam et' düğmesi.
6. İş kimliği: aynı adım iki kez çalışmasın diye `step_runs` idempotency anahtarı.

## 3. Kabul kriterleri

1. 429'da 3 deneme sonrası hata raporlanır.
2. AUTH_FAILED tek denemede durur.
3. Çökme sonrası görev paused olur, çift çalışmaz.

## 4. Test kriterleri

- [ ] retry.test.ts: geri çekilme, seçici deneme, idempotency

## 5. Riskler ve dikkat edilecekler

Sonsuz döngü riski: deneme sayısı mutlak sınırlı olmalı.

## 6. Kapsam dışı

Ajan seviyesinde otomatik 'plan revizyonu'.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

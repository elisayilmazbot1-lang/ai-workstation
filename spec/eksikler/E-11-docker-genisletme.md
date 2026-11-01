# E-11 — Docker: exec, volume/network, imaj çekme ilerlemesi

| Alan | Değer |
| --- | --- |
| **Kayıt no** | E-11 |
| **Modül** | Docker |
| **Öncelik** | **P2** |
| **Efor** | L |
| **Bağımlılıklar** | docker, approvals |
| **Durum** | `[EKSİK]` — uygulanmadı |
| **Şartname maddesi** | §26 / E-11 |

## 1. Neden gerekli

Konteyner içinde komut çalıştırmak ve volume/network yönetmek gerçek iş akışlarında zorunlu; imaj çekme şu an sessiz ve ilerlemesiz.

## 2. Teknik uygulama

1. `POST /api/docker/containers/:id/exec` → `{ command: string[] }`, onay **high**.
2. `GET /api/docker/volumes`, `POST /api/docker/volumes/:name/remove` (high), `GET /api/docker/networks`.
3. `POST /api/docker/images/pull` → SSE ilerleme (`{layer, status, percent}`).
4. Tümü `docker_actions` tablosuna yazılır (komut maskelenmiş).
5. Exec çıktısı 1 MB ile sınırlı; zaman aşımı 5 dk.

## 3. Kabul kriterleri

1. Exec onaylı çalışır, onaysız 403.
2. Volume silme onay ister.
3. Pull ilerlemesi akış olarak gelir.

## 4. Test kriterleri

- [ ] docker-ext.test.ts: exec/volume/pull (Docker yoksa skip)
- [ ] E2E: 503 davranışı korunur

## 5. Riskler ve dikkat edilecekler

Docker yoksa testler atlanır — CI'da Docker'lı bir job gerekir.

## 6. Kapsam dışı

Docker Swarm / Kubernetes.

---

**İzlenebilirlik:** Bu kayıt uygulandığında (1) kod, (2) test, (3) `CHANGELOG.md` satırı, (4) ana şartnamede `[EKSİK]` → `[KOD]` güncellemesi birlikte yapılmalıdır (§28.2).

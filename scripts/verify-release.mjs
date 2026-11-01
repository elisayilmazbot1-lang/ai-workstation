/**
 * Teslim öncesi doğrulama kapısı.
 *
 *   node scripts/verify-release.mjs
 *
 * Sırayla: tür denetimi → testler → arayüz derlemesi → Electron derlemesi →
 * uçtan uca API senaryosu (sahte sağlayıcı ile) → sonuç raporu.
 * Herhangi bir adım başarısız olursa çıkış kodu 1 olur ve rapor üretilmez.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const steps = [];
const started = Date.now();

function run(label, command, args, opts = {}) {
  const t0 = Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...opts });
  const ms = Date.now() - t0;
  const ok = result.status === 0;
  steps.push({ label, ok, ms, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() });
  console.log(`${ok ? '✔' : '✖'} ${label} (${(ms / 1000).toFixed(1)} sn)`);
  return ok ? result.stdout ?? '' : null;
}

/**
 * Sürüm tutarlılığı kapısı (madde 8): uygulama sürümü package.json ile
 * shared/constants.ts içinde BİREBİR aynı olmalı; şartname sürümü ayrı tutulur.
 */
function checkVersions() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const constants = fs.readFileSync(path.join(root, 'shared', 'constants.ts'), 'utf8');
  const appVersion = /export const APP_VERSION = '([^']+)'/.exec(constants)?.[1];
  const specVersion = /export const SPEC_VERSION = '([^']+)'/.exec(constants)?.[1];
  const problems = [];
  if (!appVersion) problems.push('shared/constants.ts içinde APP_VERSION bulunamadı.');
  else if (appVersion !== pkg.version) {
    problems.push(`Uygulama sürümü uyuşmuyor: package.json=${pkg.version} ≠ APP_VERSION=${appVersion}`);
  }
  if (!specVersion) problems.push('shared/constants.ts içinde SPEC_VERSION bulunamadı.');
  const specHeader = fs.readFileSync(path.join(root, 'spec', 'AI_WORKSTATION_SPEC_v2.md'), 'utf8');
  const specTitle = /#\s+AI WORKSTATION .*?v(\d+\.\d+)/.exec(specHeader)?.[1];
  if (specVersion && specTitle && specVersion !== specTitle) {
    problems.push(`Şartname sürümü uyuşmuyor: başlık=v${specTitle} ≠ SPEC_VERSION=${specVersion}`);
  }
  const ok = problems.length === 0;
  steps.push({ label: 'Sürüm tutarlılığı (uygulama ≠ şartname)', ok, ms: 0, output: problems.join('\n') });
  console.log(`${ok ? '✔' : '✖'} Sürüm tutarlılığı (uygulama ${appVersion ?? '?'} · şartname ${specVersion ?? '?'})`);
  if (!ok) problems.forEach((p) => console.error(`   - ${p}`));
  return ok;
}

const versions = checkVersions();
const specConsistency = run('Şartname tutarlılığı (scripts/check-spec-consistency.mjs)', process.execPath, ['scripts/check-spec-consistency.mjs']);
const typecheck = run('Tür denetimi (tsc --noEmit)', 'npx', ['tsc', '-p', 'tsconfig.json', '--noEmit']);
const tests = run('Testler (vitest run)', 'npx', ['vitest', 'run']);
const renderer = run('Arayüz derlemesi (vite build)', 'npx', ['vite', 'build']);
const electron = run('Electron derlemesi (electron-vite build)', 'npx', ['electron-vite', 'build']);
const e2e = run('Uçtan uca senaryo (scripts/e2e-scenario.mjs)', process.execPath, ['scripts/e2e-scenario.mjs']);

if ([versions, specConsistency, typecheck, tests, renderer, electron, e2e].some((v) => v === null || v === false)) {
  console.error('\n✖ Doğrulama başarısız. Ayrıntı için yukarıdaki adımlara bakın.');
  for (const step of steps.filter((s) => !s.ok)) {
    console.error(`\n--- ${step.label} ---\n${step.output.slice(-4000)}`);
  }
  process.exit(1);
}

const testSummary = (tests.match(/Tests\s+(\d+) passed/) ?? [])[1] ?? '?';
const testFiles = (tests.match(/Test Files\s+(\d+) passed/) ?? [])[1] ?? '?';
const e2eJson = JSON.parse(e2e.trim().split('\n').filter((l) => l.startsWith('{')).pop() ?? '{}');

const report = {
  tarih: new Date().toISOString(),
  toplamSureSn: Number(((Date.now() - started) / 1000).toFixed(1)),
  adimlar: steps.map(({ label, ok, ms }) => ({ label, ok, ms })),
  surumler: { uygulama: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, sartname: /export const SPEC_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'shared', 'constants.ts'), 'utf8'))?.[1] },
  testler: { dosya: Number(testFiles), test: Number(testSummary) },
  e2e: e2eJson,
};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'verify-report.json'), JSON.stringify(report, null, 2));

console.log('\n✔ Tüm doğrulama adımları geçti.');
console.log(JSON.stringify(report.e2e, null, 1));

#!/usr/bin/env node
/**
 * AI WORKSTATION — TESLİM DOĞRULAMA TARAYICISI  (CommonJS sürüm)
 * ==============================================================
 *
 * NEDEN .cjs?  Node v26, uzantısı `.mjs` olan bir dosyayı `require()` ile
 * yüklemeye çalıştığında `MODULE_NOT_FOUND` fırlatabiliyor (Windows'ta dosya
 * ilişkilendirmesi / yol çözümü bozuksa). `.cjs` + `require()` her Node
 * sürümünde (16 → 26) sorunsuz çalışır. Bu sürüm o yüzden yazıldı.
 *
 * KULLANIM
 *   node aw-scan.cjs <klasör>
 *   node aw-scan.cjs <klasör> --mode code
 *   node aw-scan.cjs <klasör> --mode all --json rapor.json
 *
 * npm install GEREKMEZ. Yalnız Node.js 16+.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MANIFEST_FILE = path.join(__dirname, 'manifest.json');

/* ------------------------------------------------------------------ */
/* Renkler                                                            */
/* ------------------------------------------------------------------ */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  reset: useColor ? '\x1b[0m' : '', bold: useColor ? '\x1b[1m' : '',
  red: useColor ? '\x1b[31m' : '', green: useColor ? '\x1b[32m' : '',
  yellow: useColor ? '\x1b[33m' : '', cyan: useColor ? '\x1b[36m' : '',
  gray: useColor ? '\x1b[90m' : '',
};

/* ------------------------------------------------------------------ */
/* Argümanlar                                                         */
/* ------------------------------------------------------------------ */
function parseArgs(argv) {
  const args = { target: null, mode: 'scan', json: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--help' || a === '-h') args.mode = 'help';
    else if (!a.startsWith('--')) args.target = a;
  }
  return args;
}

/* ------------------------------------------------------------------ */
/* Yürüme                                                             */
/* ------------------------------------------------------------------ */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', 'coverage', 'target',
  '__pycache__', '.cache', '.cache-native', '.data', '.npm', '.venv',
  'release', 'artifacts',
]);
const SKIP_FILE = /(\.db|\.db-wal|\.db-shm|\.map|\.log|\.tmp|\.bak)$/i;

function walk(root, onFile, rel) {
  rel = rel || '';
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch (err) {
    return { errors: [rel + ': okunamadı (' + err.code + ')'] };
  }
  let errors = [];
  const sorted = entries.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  for (const e of sorted) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (r === 'public/monaco' || r.indexOf('public/monaco/') === 0) continue;
      const sub = walk(root, onFile, r);
      if (sub.errors) errors = errors.concat(sub.errors);
    } else if (e.isFile()) {
      if (SKIP_FILE.test(e.name)) continue;
      onFile(r, path.join(root, r));
    }
  }
  return { errors: errors };
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * YALNIZCA yorumları ayıklar; dize sabitleri KORUNUR.
 * (Naif arama hem yanlış pozitif hem yanlış negatif üretmişti — bkz. aw-scan_FROZEN.mjs)
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code';
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (ch === '/' && next === '/') { state = 'line'; i += 2; continue; }
      if (ch === '/' && next === '*') { state = 'block'; i += 2; continue; }
      if (ch === "'") { state = 'single'; out += ch; i += 1; continue; }
      if (ch === '"') { state = 'double'; out += ch; i += 1; continue; }
      if (ch === '`') { state = 'template'; out += ch; i += 1; continue; }
      out += ch; i += 1; continue;
    }
    if (state === 'line') { if (ch === '\n') { state = 'code'; out += ch; } i += 1; continue; }
    if (state === 'block') { if (ch === '*' && next === '/') { state = 'code'; i += 2; } else i += 1; continue; }
    out += ch;
    if (ch === '\\') { if (i + 1 < n) out += src[i + 1]; i += 2; continue; }
    if (state === 'single' && ch === "'") { state = 'code'; i += 1; continue; }
    if (state === 'double' && ch === '"') { state = 'code'; i += 1; continue; }
    if (state === 'template' && ch === '`') { state = 'code'; i += 1; continue; }
    i += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* MOD 1 — BÜTÜNLÜK                                                   */
/* ------------------------------------------------------------------ */
function scanIntegrity(target) {
  if (!fs.existsSync(MANIFEST_FILE)) {
    return { error: 'manifest.json bulunamadı — aw-scan.cjs ile aynı klasörde olmalı.' };
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  if (!fs.existsSync(target)) return { error: 'Klasör yok: ' + target };

  const expected = new Map();
  for (const f of manifest.files) expected.set(f.p, f);

  const missing = [];
  const changed = [];
  const present = [];
  const readErrors = [];

  walk(target, function (rel, abs) {
    const exp = expected.get(rel);
    if (!exp) return;
    try {
      const buf = fs.readFileSync(abs);
      const h = sha(buf);
      if (buf.length !== exp.s || h.slice(0, 16) !== exp.h) {
        changed.push({
          file: rel, beklenenBoyut: exp.s, gercekBoyut: buf.length,
          beklenenOzet: exp.h, gercekOzet: h.slice(0, 16),
        });
      } else {
        present.push(rel);
      }
    } catch (err) {
      readErrors.push(rel + ' (' + err.code + ')');
    }
  });

  for (const p of expected.keys()) {
    if (present.indexOf(p) === -1
      && !changed.some(function (x) { return x.file === p; })
      && !readErrors.some(function (x) { return x.indexOf(p) === 0; })) {
      missing.push(p);
    }
  }

  const extra = [];
  const expectedPaths = new Set(expected.keys());
  walk(target, function (rel) { if (!expectedPaths.has(rel)) extra.push(rel); });

  return { manifest: manifest, present: present, missing: missing, changed: changed, extra: extra, readErrors: readErrors };
}

function printIntegrity(r, target) {
  if (r.error) { console.log(c.red + '✖ ' + r.error + c.reset); return 1; }

  const total = r.manifest.files.length;
  const okCount = r.present.length;
  const pct = ((okCount / total) * 100).toFixed(1);
  let expectedBytes = 0;
  for (const f of r.manifest.files) expectedBytes += f.s;

  console.log('\n' + c.bold + '═══ BÜTÜNLÜK TARAMASI ═══' + c.reset);
  console.log(c.gray + 'Klasör :' + c.reset + ' ' + path.resolve(target));
  console.log(c.gray + 'Ürün   :' + c.reset + ' ' + r.manifest.product + ' v' + r.manifest.version + ' · ' + r.manifest.spec);
  console.log(c.gray + 'Referans:' + c.reset + ' manifest.json · ' + total + ' dosya · ' + (expectedBytes / 1024).toFixed(0) + ' KB\n');

  console.log(c.bold + 'SONUÇ' + c.reset);
  console.log('  ' + (okCount === total ? c.green + '✔' : c.yellow + '○') + ' Tam eşleşen : ' + c.bold + okCount + '/' + total + c.reset + '  (%' + pct + ')');
  if (r.missing.length) console.log('  ' + c.red + '✖ Eksik       : ' + r.missing.length + c.reset);
  if (r.changed.length) console.log('  ' + c.yellow + '▲ Değişmiş    : ' + r.changed.length + c.reset);
  if (r.readErrors.length) console.log('  ' + c.red + '✖ Okunamadı   : ' + r.readErrors.length + c.reset);
  if (r.extra.length) console.log('  ' + c.gray + '+ Fazla       : ' + r.extra.length + c.reset);

  if (r.missing.length) {
    console.log('\n' + c.bold + c.red + 'EKSİK DOSYALAR (' + r.missing.length + ')' + c.reset);
    for (const m of r.missing.slice(0, 50)) console.log('  ' + c.red + '✖' + c.reset + ' ' + m);
    if (r.missing.length > 50) console.log('  ' + c.gray + '... ve ' + (r.missing.length - 50) + ' tane daha' + c.reset);
  }

  if (r.changed.length) {
    console.log('\n' + c.bold + c.yellow + 'DEĞİŞMİŞ DOSYALAR (' + r.changed.length + ')' + c.reset);
    for (const ch of r.changed.slice(0, 50)) {
      console.log('  ' + c.yellow + '▲' + c.reset + ' ' + ch.file);
      console.log('     ' + c.gray + 'boyut: ' + ch.beklenenBoyut + ' → ' + ch.gercekBoyut + ' | özet: ' + ch.beklenenOzet + ' → ' + ch.gercekOzet + c.reset);
    }
    if (r.changed.length > 50) console.log('  ' + c.gray + '... ve ' + (r.changed.length - 50) + ' tane daha' + c.reset);
  }

  if (r.readErrors.length) {
    console.log('\n' + c.bold + c.red + 'OKUNAMAYAN (' + r.readErrors.length + ')' + c.reset);
    for (const e of r.readErrors.slice(0, 20)) console.log('  ' + c.red + '✖' + c.reset + ' ' + e);
  }

  if (r.extra.length) {
    console.log('\n' + c.bold + c.gray + 'FAZLA DOSYALAR (' + r.extra.length + ') — hata değil, bilgi' + c.reset);
    for (const e of r.extra.slice(0, 15)) console.log('  ' + c.gray + '+' + c.reset + ' ' + e);
    if (r.extra.length > 15) console.log('  ' + c.gray + '... ve ' + (r.extra.length - 15) + ' tane daha' + c.reset);
  }

  const healthy = r.missing.length === 0 && r.changed.length === 0 && r.readErrors.length === 0;
  console.log('');
  if (healthy) {
    console.log(c.green + c.bold + '✔ KOPYA TAM — ' + total + ' dosyanın tamamı referansla birebir aynı.' + c.reset);
    return 0;
  }
  console.log(c.red + c.bold + '✖ KOPYA EKSİK/BOZUK — yukarıdaki dosyaları yeniden kopyalayın.' + c.reset);
  console.log(c.gray + '  Kaynak ZIP: 1-KAYNAK-KOD.zip' + c.reset);
  return 1;
}

/* ------------------------------------------------------------------ */
/* MOD 2 — KAYNAK KOD DENETİMİ                                        */
/* ------------------------------------------------------------------ */
function codeChecks(target) {
  const readRaw = function (rel) {
    try { return fs.readFileSync(path.join(target, rel), 'utf8'); } catch (e) { return null; }
  };
  const exists = function (rel) { return fs.existsSync(path.join(target, rel)); };
  const readCode = function (rel) {
    const s = readRaw(rel);
    return s === null ? null : stripComments(s);
  };
  const has = function (rel, re) {
    const s = readCode(rel);
    if (s === null) return { state: 'yok', detail: 'dosya yok' };
    return re.test(s) ? { state: 'var', detail: '' } : { state: 'yok', detail: 'kalıp bulunamadı' };
  };

  const checks = [];

  checks.push({
    id: 'H-1', name: 'Vite base ayarı (file:// altında arayüz açılması)',
    expect: "vite.config.ts içinde kök düzeyde base: './'",
    run: function () {
      const s = readRaw('vite.config.ts');
      if (s === null) return { ok: false, detail: 'vite.config.ts yok' };
      const m = s.match(/^\s{0,2}base:\s*['"]\.\/['"]/m);
      return m ? { ok: true, detail: "base: './' kök düzeyde bulundu" }
               : { ok: false, detail: 'base ayarı YOK veya yanlış yerde' };
    },
  });

  checks.push({
    id: 'H-2', name: 'Sohbet akışı IPC köprüsü (file:// altında yanıt)',
    expect: 'aw:stream kanalı + preload stream() + api.ts kullanımı',
    run: function () {
      const a = has('electron/ipc/handlers.ts', /aw:stream/);
      const b = has('electron/preload/index.ts', /stream\s*[:(]/);
      const d = has('src/services/api.ts', /aiWorkstation\??\.stream/);
      return {
        ok: a.state === 'var' && b.state === 'var' && d.state === 'var',
        detail: 'handlers:' + a.state + ' · preload:' + b.state + ' · api:' + d.state,
      };
    },
  });

  checks.push({
    id: 'H-3', name: 'Windows yerel modül hazırlığı',
    expect: 'prepare-native-win.mjs + build:win betiği',
    run: function () {
      const f = exists('scripts/prepare-native-win.mjs');
      const s = readRaw('package.json');
      const b = s ? /"build:win"\s*:\s*"[^"]*prepare-native-win/.test(s) : false;
      return { ok: f && b, detail: 'betik:' + (f ? 'var' : 'yok') + ' · build:win bağlı:' + (b ? 'evet' : 'hayır') };
    },
  });

  checks.push({
    id: 'H-5', name: 'Whisper seçeneği dürüst işaretli',
    expect: 'SettingsPage içinde whisper-api seçeneği disabled',
    run: function () {
      const s = readRaw('src/pages/SettingsPage.tsx');
      if (s === null) return { ok: false, detail: 'SettingsPage.tsx yok' };
      return /value="whisper-api"[^>]*disabled/.test(s)
        ? { ok: true, detail: 'seçenek disabled olarak işaretli' }
        : { ok: false, detail: 'whisper-api seçeneği AKTİF görünüyor' };
    },
  });

  checks.push({
    id: 'E-01', name: 'recordMeasurement çağrılıyor mu',
    expect: 'backend/ içinde tanım DIŞINDA en az 1 çağrı',
    run: function () {
      let defs = 0, calls = 0;
      const dirs = ['backend', 'src'];
      function walkJs(dir) {
        const full = path.join(target, dir);
        if (!fs.existsSync(full)) return;
        for (const e of fs.readdirSync(full, { withFileTypes: true })) {
          const r = dir + '/' + e.name;
          if (e.isDirectory()) walkJs(r);
          else if (/\.(ts|tsx)$/.test(e.name)) {
            const s = stripComments(readRaw(r) || '');
            for (const line of s.split('\n')) {
              if (line.indexOf('recordMeasurement') === -1) continue;
              if (/^\s*(private\s+|public\s+)?recordMeasurement\s*\(|recordMeasurement\s*\([^)]*\)\s*:\s*\w+\s*\{/.test(line)) defs += 1;
              else calls += 1;
            }
          }
        }
      }
      dirs.forEach(walkJs);
      return { ok: calls > 0, detail: 'tanım:' + defs + ' · çağrı:' + calls + (calls === 0 ? ' → İŞLEVSİZ' : '') };
    },
  });

  checks.push({
    id: 'E-12', name: 'project_files tablosuna yazılıyor mu',
    expect: 'backend/ içinde INSERT/UPDATE project_files',
    run: function () {
      const s = (readCode('backend/projects/project-service.ts') || '')
              + (readCode('backend/files/file-service.ts') || '');
      const w = /INSERT\s+INTO\s+project_files|UPDATE\s+project_files/i.test(s);
      return { ok: w, detail: w ? 'yazma bulundu' : 'yazma YOK → İŞLEVSİZ' };
    },
  });

  checks.push({
    id: 'E-13', name: 'sttProvider ayarı tüketiliyor mu',
    expect: 'useVoice veya başka yerde sttProvider okunuyor',
    run: function () {
      const v = readCode('src/hooks/useVoice.ts') || '';
      const used = /sttProvider/.test(v);
      return { ok: used, detail: used ? 'okunuyor' : 'useVoice sttProvider OKUMUYOR → seçenek işlevsiz (E-13 EKSİK)' };
    },
  });

  const structural = [
    ['backend/ai/http.ts', /throwIfAborted/, 'E-48: iptal sonrası throw'],
    ['backend/ai/errors.ts', /'timeout'/, 'zaman aşımı sınıflandırması'],
    ['backend/database/schema.ts', /cancel_reason/, 'v2 migration kolonu'],
    ['scripts/verify-release.mjs', /e2e-scenario/, 'doğrulama zinciri'],
    ['scripts/e2e-scenario.mjs', /check\(/, 'E2E kontrolleri'],
  ];
  structural.forEach(function (item) {
    const file = item[0], re = item[1], label = item[2];
    checks.push({
      id: label, name: file, expect: 'kalıp mevcut',
      run: function () {
        const r = has(file, re);
        return { ok: r.state === 'var', detail: r.state === 'var' ? 'bulundu' : r.detail };
      },
    });
  });

  const expectedTests = [
    'tests/integration/emergency-stop-all-streams.test.ts',
    'tests/integration/chat-stream-electron-path.test.ts',
    'tests/verify/e48-timeout-independent.ts',
    'tests/verify/emergency-stop-independent.ts',
    'tests/verify/migration-independent.ts',
  ];
  const missingTests = expectedTests.filter(function (t) { return !exists(t); });
  checks.push({
    id: 'TEST', name: 'Kritik test dosyaları', expect: expectedTests.length + ' dosya',
    run: function () {
      return { ok: missingTests.length === 0,
        detail: missingTests.length ? 'eksik: ' + missingTests.join(', ') : 'hepsi mevcut' };
    },
  });

  return checks.map(function (ch) {
    let result;
    try { result = ch.run(); }
    catch (e) { result = { ok: false, detail: 'denetim hatası: ' + e.message }; }
    return { id: ch.id, name: ch.name, expect: ch.expect, result: result };
  });
}

function printCode(target) {
  const results = codeChecks(target);
  console.log('\n' + c.bold + '═══ KAYNAK KOD DENETİMİ ═══' + c.reset);
  console.log(c.gray + 'Klasör:' + c.reset + ' ' + path.resolve(target) + '\n');

  let passed = 0;
  for (const r of results) {
    if (r.result.ok) passed += 1;
    const mark = r.result.ok ? c.green + '✔' + c.reset : c.red + '✖' + c.reset;
    console.log(mark + ' ' + c.bold + r.id + c.reset + '  ' + r.name);
    if (!r.result.ok) {
      console.log('    ' + c.gray + 'beklenen: ' + r.expect + c.reset);
      console.log('    ' + c.red + 'gerçek  : ' + r.result.detail + c.reset);
    } else if (r.result.detail) {
      console.log('    ' + c.gray + r.result.detail + c.reset);
    }
  }

  console.log('');
  const allOk = passed === results.length;
  console.log((allOk ? c.green : c.yellow) + c.bold + passed + '/' + results.length + ' denetim geçti.' + c.reset);

  const failed = results.filter(function (r) { return !r.result.ok; });
  if (failed.length) {
    console.log('\n' + c.bold + 'EKSİK OLAN TARAF — ' + failed.length + ' madde' + c.reset);
    for (const r of failed) console.log('  ' + c.red + '●' + c.reset + ' ' + r.id + ' — ' + r.name);
    console.log('\n' + c.gray + 'Bu maddeler bilinen/belgelenmiş eksiklerdir:' + c.reset);
    console.log(c.gray + '  3-RAPORLAR.zip → DENETIM_RAPORU_3.md → Bölüm 6 (Açık Kalanlar)' + c.reset);
    console.log(c.gray + '  E-01 → madde 7 · E-12 → madde 8 · E-13 → madde 9' + c.reset);
    console.log(c.gray + '  NOT: 10/13 geçmesi DOĞRU sonuçtur. 13/13 görürseniz bir şey yanlış.' + c.reset);
  }
  return failed.length === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* Ana                                                                */
/* ------------------------------------------------------------------ */
const args = parseArgs(process.argv.slice(2));

if (args.mode === 'help' || !args.target) {
  console.log('\n' + c.bold + 'AI Workstation — Teslim Doğrulama Tarayıcısı' + c.reset + '\n');
  console.log('Kullanım:');
  console.log('  node aw-scan.cjs <klasör>                 Bütünlük taraması');
  console.log('  node aw-scan.cjs <klasör> --mode code     Kaynak kod denetimi');
  console.log('  node aw-scan.cjs <klasör> --mode all      İkisi birlikte');
  console.log('  node aw-scan.cjs <klasör> --json r.json   JSON çıktı');
  console.log('  node aw-scan.cjs --help                   Bu metin\n');
  console.log('Örnek:');
  console.log('  node aw-scan.cjs "C:\\\\Users\\\\SERVER\\\\Desktop\\\\al\\\\AI_WORKSTATION"\n');
  console.log('Node sürümünüz: ' + process.version);
  console.log('Dosya konumu  : ' + __dirname + '\n');
  process.exit(args.mode === 'help' ? 0 : 2);
}

if (!fs.existsSync(args.target)) {
  console.error(c.red + '✖ Klasör bulunamadı: ' + args.target + c.reset);
  console.error(c.gray + '  Kontrol: 1-KAYNAK-KOD.zip dosyasını açtığınız yer doğru mu?' + c.reset);
  process.exit(2);
}

if (['scan', 'code', 'all'].indexOf(args.mode) === -1) {
  console.error(c.red + '✖ Geçersiz mod: ' + args.mode + ' (scan | code | all)' + c.reset);
  process.exit(2);
}

const report = { target: path.resolve(args.target), mode: args.mode, at: new Date().toISOString(), node: process.version };
let exitCode = 0;

if (args.mode === 'scan' || args.mode === 'all') {
  const r = scanIntegrity(args.target);
  exitCode = Math.max(exitCode, printIntegrity(r, args.target));
  report.integrity = r.error ? { error: r.error } : {
    total: r.manifest.files.length,
    ok: r.present.length,
    missing: r.missing,
    changed: r.changed,
    extra: r.extra,
    readErrors: r.readErrors,
  };
}

if (args.mode === 'code' || args.mode === 'all') {
  const code = printCode(args.target);
  exitCode = Math.max(exitCode, code);
  report.code = code;
}

if (args.json) {
  fs.writeFileSync(args.json, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n' + c.gray + 'JSON rapor yazıldı: ' + args.json + c.reset);
}

process.exit(exitCode);

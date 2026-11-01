#!/usr/bin/env node
/**
 * AI WORKSTATION — MANİFEST ÜRETİCİSİ  (CommonJS)
 * ================================================
 *
 * `aw-scan.cjs` bütünlük denetimini `manifest.json` ile yapar. Manifest'i
 * elle güncellemek hataya açıktı (bu depoda bir kez `GITHUB_YUKLEME.md`
 * manifeste hiç girmedi). Bu araç, aw-scan.cjs'in `walk()` kurallarını
 * BİREBİR uygulayarak manifest'i üretir — ikisi ayrışırsa tarama yanlış
 * "eksik/fazla" der.
 *
 * KURAL: aw-scan.cjs içindeki SKIP_DIRS, SKIP_FILE ve public/monaco atlaması
 * değişirse BURASI DA değişmeli. (Kural tek kaynak: aw-scan.cjs.)
 *
 * KULLANIM
 *   node tools/aw-manifest.cjs                 # depo kökünü tara, manifest.json'u yaz
 *   node tools/aw-manifest.cjs --dry           # yazma, yalnızca rapor
 *   node tools/aw-manifest.cjs --dir <klasör>  # başka klasörü tara
 *
 * npm install GEREKMEZ. Yalnız Node.js 16+.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEPO_KOKU = path.resolve(__dirname, '..');
const MANIFEST_FILE = path.join(__dirname, 'manifest.json');

/* aw-scan.cjs ile BİREBİR aynı atlama kuralları */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', 'coverage', 'target',
  '__pycache__', '.cache', '.cache-native', '.data', '.npm', '.venv',
  'release', 'artifacts',
]);
const SKIP_FILE = /(\.db|\.db-wal|\.db-shm|\.map|\.log|\.tmp|\.bak)$/i;

/* Manifest'in kendisi listeye giremez (kendi özetini içeremez). */
const MANIFEST_REL = 'tools/manifest.json';

function parseArgs(argv) {
  const a = { dir: DEPO_KOKU, dry: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry') a.dry = true;
    else if (argv[i] === '--dir') a.dir = path.resolve(argv[++i]);
    else if (argv[i] === '--help' || argv[i] === '-h') a.help = true;
  }
  return a;
}

/** aw-scan.cjs walk() ile aynı sıra ve atlama kuralları. */
function topla(kok, rel, out) {
  rel = rel || '';
  let entries;
  try {
    entries = fs.readdirSync(path.join(kok, rel), { withFileTypes: true });
  } catch (err) {
    console.error('okunamadı: ' + (rel || '.') + ' (' + err.code + ')');
    return;
  }
  const sorted = entries.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  for (const e of sorted) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (r === 'public/monaco' || r.indexOf('public/monaco/') === 0) continue;
      topla(kok, r, out);
    } else if (e.isFile()) {
      if (SKIP_FILE.test(e.name)) continue;
      out.push(r);
    }
  }
}

function uret(kok) {
  const yollar = [];
  topla(kok, '', yollar);

  const kayitlar = [];
  for (const p of yollar) {
    if (p === MANIFEST_REL) continue;      // kendini özetleyemez
    const abs = path.join(kok, p);
    const buf = fs.readFileSync(abs);
    kayitlar.push({
      p: p,
      s: buf.length,
      h: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16),
    });
  }
  kayitlar.sort(function (a, b) { return a.p < b.p ? -1 : a.p > b.p ? 1 : 0; });
  return kayitlar;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('\n  node tools/aw-manifest.cjs [--dry] [--dir <klasör>]\n');
    return 0;
  }

  let eski = null;
  if (fs.existsSync(MANIFEST_FILE)) {
    try { eski = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')); } catch (err) { eski = null; }
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(DEPO_KOKU, 'package.json'), 'utf8'));
  const kayitlar = uret(args.dir);

  const dok = {
    product: (eski && eski.product) || 'AI Workstation',
    version: pkg.version || (eski && eski.version) || '0.0.0',
    spec: (eski && eski.spec) || 'AWS-SPEC-2.0',
    generated: new Date().toISOString(),
    fileCount: kayitlar.length,
    files: kayitlar,
  };

  if (eski && Array.isArray(eski.files)) {
    const ma = new Map(eski.files.map(function (f) { return [f.p, f]; }));
    const mb = new Map(kayitlar.map(function (f) { return [f.p, f]; }));
    const eklenen = kayitlar.filter(function (f) { return !ma.has(f.p); }).map(function (f) { return f.p; });
    const dusen = eski.files.filter(function (f) { return !mb.has(f.p); }).map(function (f) { return f.p; });
    const degisen = kayitlar.filter(function (f) {
      const e = ma.get(f.p);
      return e && (e.s !== f.s || e.h !== f.h);
    }).map(function (f) { return f.p; });

    console.log('  Eski : ' + eski.files.length + ' dosya');
    console.log('  Yeni : ' + kayitlar.length + ' dosya');
    if (eklenen.length) console.log('  + ' + eklenen.join('\n  + '));
    if (dusen.length) console.log('  - ' + dusen.join('\n  - '));
    if (degisen.length) console.log('  ~ ' + degisen.join('\n  ~ '));
    if (!eklenen.length && !dusen.length && !degisen.length) console.log('  Değişiklik yok.');
  } else {
    console.log('  Yeni manifest: ' + kayitlar.length + ' dosya');
  }

  if (args.dry) {
    console.log('\n  --dry: yazılmadı.\n');
    return 0;
  }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(dok, null, 2) + '\n');
  console.log('\n  Yazıldı: tools/manifest.json (' + kayitlar.length + ' dosya)\n');
  return 0;
}

process.exit(main());

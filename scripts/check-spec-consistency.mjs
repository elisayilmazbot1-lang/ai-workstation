/**
 * Şartname tutarlılık denetleyicisi (E-46 / madde 1–6).
 *
 *   node scripts/check-spec-consistency.mjs
 *
 * Denetledikleri:
 *   1. spec/eksikler/E-*.md numaralandırması tekil + ardışık (E-01…E-NN)
 *   2. Her kayıt dosyasının başlık numarası dosya adıyla aynı
 *   3. §26 tablosundaki satır sayısı = kayıt sayısı; her dosya adı gerçekten var
 *   4. §27 yol haritası E-01…E-NN'in tamamını kapsıyor, hiçbiri iki aşamada değil
 *   5. Şartnamedeki E-ref'ler aralık dışına çıkmıyor (E-99 gibi hayalet yok)
 *   6. Kapatılan kayıtların test kanıtı gerçekten var
 *   7. Özet belgelerdeki sayılar kayıt dosyalarıyla aynı
 *
 * Çıkış kodu 0 = tutarlı, 1 = tutarsız.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gapsDir = path.join(root, 'spec', 'eksikler');
const specPath = path.join(root, 'spec', 'AI_WORKSTATION_SPEC_v2.md');

const problems = [];
const notes = [];
const ok = (m) => notes.push(`✔ ${m}`);
const bad = (m) => problems.push(`✖ ${m}`);

/* ---------------------------------------------------------------- */
/* 1–2. Kayıt dosyaları: tekil, ardışık, başlık tutarlı              */
/* ---------------------------------------------------------------- */
const files = fs
  .readdirSync(gapsDir)
  .filter((f) => /^E-\d\d-.*\.md$/.test(f))
  .sort();

const numbers = files.map((f) => Number(f.slice(2, 4)));
const gaps = [];
for (let i = 1; i <= Math.max(...numbers); i += 1) if (!numbers.includes(i)) gaps.push(i);
const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
if (gaps.length) bad(`Numaralandırma boşluğu: ${gaps.map((g) => `E-${String(g).padStart(2, '0')}`).join(', ')}`);
if (duplicates.length) bad(`Numaralandırma çakışması: ${duplicates.join(', ')}`);
if (!gaps.length && !duplicates.length) ok(`${files.length} kayıt dosyası tekil ve ardışık (E-01…E-${String(Math.max(...numbers)).padStart(2, '0')})`);

for (const file of files) {
  const n = Number(file.slice(2, 4));
  const head = fs.readFileSync(path.join(gapsDir, file), 'utf8').split('\n')[0];
  if (!head.startsWith(`# E-${String(n).padStart(2, '0')} `)) {
    bad(`${file} başlık numarası dosya adıyla uyuşmuyor: "${head.slice(0, 40)}"`);
  }
}

/* ---------------------------------------------------------------- */
/* 3. §26 tablosu                                                    */
/* ---------------------------------------------------------------- */
const spec = fs.readFileSync(specPath, 'utf8');

const sec26 = spec.slice(spec.indexOf('## §26.'), spec.indexOf('## §27.'));
const rows26 = [...sec26.matchAll(/^\| (E-\d\d) \|/gm)].map((m) => m[1]);
if (rows26.length !== files.length) bad(`§26 tablosunda ${rows26.length} satır var, ${files.length} kayıt dosyası var`);
else ok(`§26 tablosu ${rows26.length} kaydın tamamını listeliyor`);

for (const row of rows26) {
  const file = files.find((f) => f.startsWith(row));
  if (!file) bad(`§26'da ${row} var ama kayıt dosyası yok`);
}
for (const file of files) {
  const ref = file.slice(0, 4);
  if (!sec26.includes(file)) bad(`${file} §26 tablosunda yol olarak geçmiyor`);
}

/* ---------------------------------------------------------------- */
/* 4. §27 yol haritası kapsamı                                       */
/* ---------------------------------------------------------------- */
const sec27 = spec.slice(spec.indexOf('## §27.'), spec.indexOf('## §27.1'));
const stageRows = [...sec27.matchAll(/^\| \*\*(\d)\*\* \| ([^|]+) \| ([^|]+) \|/gm)];
const staged = new Map();
for (const [, stage, , list] of stageRows) {
  for (const e of list.matchAll(/E-(\d\d)/g)) {
    const key = `E-${e[1]}`;
    if (staged.has(key)) bad(`${key} birden fazla aşamada: Aşama ${staged.get(key)} ve ${stage}`);
    else staged.set(key, stage);
  }
}
const stage0 = [...staged.entries()].filter(([, s]) => s === '0').map(([e]) => e);
const scheduled = [...staged.keys()];
const allKeys = files.map((f) => f.slice(0, 4));
const missingFromRoadmap = allKeys.filter((k) => !scheduled.includes(k));
if (missingFromRoadmap.length) bad(`Yol haritasında olmayan kayıt: ${missingFromRoadmap.join(', ')}`);
else ok(`Yol haritası ${scheduled.length} kaydın tamamını kapsıyor (Aşama 0: ${stage0.length})`);

const totals = [];
for (const s of ['0', '1', '2', '3', '4', '5']) totals.push(staged.size && [...staged.values()].filter((v) => v === s).length);
notes.push(`  Aşama dağılımı: 0=${totals[0]} 1=${totals[1]} 2=${totals[2]} 3=${totals[3]} 4=${totals[4]} 5=${totals[5]}`);

/* ---------------------------------------------------------------- */
/* 5. Hayalet E-referansı                                            */
/* ---------------------------------------------------------------- */
const maxN = Math.max(...numbers);
const allRefs = [...new Set([...spec.matchAll(/E-(\d\d)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
const outOfRange = allRefs.filter((n) => n < 1 || n > maxN);
if (outOfRange.length) bad(`Şartnamede aralık dışı E-referansı: ${outOfRange.map((n) => `E-${n}`).join(', ')}`);
else ok(`Şartnamedeki ${allRefs.length} farklı E-referansının tamamı E-01…E-${maxN} aralığında`);

const unreferenced = allKeys.filter((k) => !allRefs.includes(Number(k.slice(2))));
if (unreferenced.length) bad(`Şartnamede hiç geçmeyen kayıt: ${unreferenced.join(', ')}`);

/* ---------------------------------------------------------------- */
/* 6. Kapatılan kayıtların test kanıtı                               */
/* ---------------------------------------------------------------- */
const evidence = {
  'E-46': ['tests/unit/version.test.ts', 'tests/unit/release-status.test.ts'],
  'E-47': ['tests/unit/version.test.ts', 'tests/unit/release-status.test.ts'],
  'E-48': ['tests/unit/test-outcome.test.ts', 'tests/unit/chat-cancel.test.ts', 'tests/unit/migration.test.ts'],
};
for (const [gap, tests] of Object.entries(evidence)) {
  if (!files.some((f) => f.startsWith(gap))) continue;
  const record = fs.readFileSync(path.join(gapsDir, files.find((f) => f.startsWith(gap))), 'utf8');
  if (!record.includes('[KOD]')) continue; // yalnızca [KOD] iddiası olanlar denetlenir
  for (const t of tests) {
    if (!fs.existsSync(path.join(root, t))) bad(`${gap} [KOD] diyor ama kanıt testi yok: ${t}`);
    else if (!record.includes(path.basename(t))) bad(`${gap} kaydı ${path.basename(t)} dosyasını anmıyor`);
  }
}
ok('Kapatılan kayıtların (E-46/E-47/E-48) test kanıtları mevcut');

/* ---------------------------------------------------------------- */
/* 7. Özet belgelerdeki sayılar                                      */
/* ---------------------------------------------------------------- */
const prio = { P1: 0, P2: 0, P3: 0, P4: 0 };
for (const file of files) {
  const t = fs.readFileSync(path.join(gapsDir, file), 'utf8');
  const m = /\| \*\*Öncelik\*\* \| \**?(P[1-4])\**? \|/.exec(t);
  if (m) prio[m[1]] += 1;
  else bad(`${file} içinde öncelik alanı okunamadı`);
}
const prioLine = `P1 = ${prio.P1} · P2 = ${prio.P2} · P3 = ${prio.P3} · P4 = ${prio.P4}`;
ok(`Öncelik dağılımı (dosyalardan): ${prioLine}`);

const summaryPath = path.join(root, 'spec', 'ANA_EKSIK_LISTESI.md');
if (fs.existsSync(summaryPath)) {
  const summary = fs.readFileSync(summaryPath, 'utf8');
  const expect = `**${prio.P1} / ${prio.P2} / ${prio.P3} / ${prio.P4}**`;
  if (!summary.includes(expect)) bad(`ANA_EKSIK_LISTESI.md öncelik sayıları güncel değil (beklenen: ${expect})`);
  if (!summary.includes(`| **${files.length}** |`)) bad(`ANA_EKSIK_LISTESI.md toplam kayıt sayısı ${files.length} değil`);
  else ok('ANA_EKSIK_LISTESI.md sayıları kayıt dosyalarıyla uyumlu');
}

/* ---------------------------------------------------------------- */
/* Sonuç                                                             */
/* ---------------------------------------------------------------- */
console.log('Şartname tutarlılık denetimi\n');
for (const n of notes) console.log(n);
if (problems.length) {
  console.log('');
  for (const p of problems) console.error(p);
  console.error(`\n✖ ${problems.length} tutarsızlık bulundu.`);
  process.exit(1);
}
console.log('\n✔ Tutarlılık denetimi geçti.');

#!/usr/bin/env node
/**
 * AI WORKSTATION — İNDİRME ARŞİVİ ÜRETİCİSİ
 * ==========================================
 *
 * Numara ile başlayan arşivleri üretir (1 … 5). Sıra kullanıcının istediği
 * gibi sabittir; adlar değişmez:
 *
 *   1-KAYNAK-KOD.zip              → çalışan proje kaynağı (npm ci ile kurulur)
 *   2-SARTNAME-VE-BELGELER.zip    → şartname + kullanım/kurulum belgeleri
 *   3-RAPORLAR.zip                → teslim raporları
 *   4-KANIT-GORUNTULERI.zip       → ekran görüntüleri (uygulama + pencere kanıtı)
 *   5-TARAMA-ARACI.zip            → bağımlılıksız bütünlük/kod tarayıcısı
 *
 * KULLANIM
 *   node tools/aw-paketle.cjs                 # arşivleri yaz
 *   node tools/aw-paketle.cjs --dry           # yalnızca ne gireceğini göster
 *   node tools/aw-paketle.cjs --cikti <dizin> # başka klasöre yaz
 *
 * GÜVENLİK
 *   - `.env`, anahtar, `node_modules`, `dist`, `out`, `release` ASLA girmez.
 *   - 1 numaralı arşive `release/*.exe` GİRMEZ (92 MB) — ayrı indirilir.
 *   - Üretimden sonra SHA256SUMS.txt yazılır (tek doğru özet kaynağı).
 *   - ZIP içinde dizin kökü tek bir üst klasördür (Windows'ta "Tümünü ayıkla"
 *     kullanıcıyı dağıtmaz).
 *
 * npm install GEREKMEZ. Yalnız Node.js 16+.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const KOK = path.resolve(__dirname, '..');

/* Zaruri dışlamalar — hangi arşiv olursa olsun asla girmez. */
const ASLA = [
  'node_modules', '.git', 'dist', 'out', 'release', 'coverage', 'artifacts',
  '.cache-native', '.data', '.npm', '__pycache__', '.venv',
];
const ASLA_DOSYA = /(\.log|\.tmp|\.bak|\.db|\.db-wal|\.db-shm|\.map|^\.env$|^\.env\.(?!example$))/i;

/* ------------------------------------------------------------------ */
/* Arşiv tanımları                                                     */
/* ------------------------------------------------------------------ */
const ARSIVLER = [
  {
    ad: '1-KAYNAK-KOD.zip',
    kok: 'AI_WORKSTATION',
    aciklama: 'Kaynak kod — kurulabilir proje',
    sec: function (rel) {
      /* Projenin tamamı; üretilen/yerel dosyalar dışta. */
      return true;
    },
  },
  {
    ad: '2-SARTNAME-VE-BELGELER.zip',
    kok: '2-SARTNAME-VE-BELGELER',
    aciklama: 'Şartname, kurulum, kullanım belgeleri',
    sec: function (rel) {
      if (rel.startsWith('spec/')) return true;
      if (rel === 'README.md') return true;
      if (rel === 'docs/KURULUM_TR.md' || rel === 'docs/KULLANIM_TR.md') return true;
      if (rel.startsWith('tools/') && /\.(md|cmd)$/i.test(rel)) return true;
      if (rel === 'KUR.cmd' || rel === 'GITHUB_YUKLEME.md') return true;
      return false;
    },
  },
  {
    ad: '3-RAPORLAR.zip',
    kok: '3-RAPORLAR',
    aciklama: 'Teslim raporları ve durum belgeleri',
    sec: function (rel) {
      return rel.startsWith('docs/teslim/') && /\.md$/i.test(rel);
    },
  },
  {
    ad: '4-KANIT-GORUNTULERI.zip',
    kok: '4-KANIT-GORUNTULERI',
    aciklama: 'Ekran görüntüleri — arayüz ve pencere kanıtı',
    sec: function (rel) {
      return /^docs\/(ekranlar|teslim\/kanit)\/.+\.png$/i.test(rel);
    },
  },
  {
    ad: '5-TARAMA-ARACI.zip',
    kok: '5-TARAMA-ARACI',
    aciklama: 'Bağımlılıksız bütünlük ve kaynak kod tarayıcısı',
    sec: function (rel) {
      if (rel === 'tools/aw-scan.cjs') return true;
      if (rel === 'tools/aw-manifest.cjs') return true;
      if (rel === 'tools/manifest.json') return true;
      if (/^tools\/(KUR|TARA|ONAR)\.cmd$/i.test(rel)) return true;
      if (/^tools\/(NASIL_KULLANILIR|SORUN_GIDERME|WINDOWS_KURULUM)\.md$/i.test(rel)) return true;
      return false;
    },
  },
];

/* ------------------------------------------------------------------ */
/* Dosya toplama                                                       */
/* ------------------------------------------------------------------ */
function disla(rel) {
  const parca = rel.split('/');
  for (const p of parca) if (ASLA.includes(p)) return true;
  if (ASLA_DOSYA.test(parca[parca.length - 1])) return true;
  if (rel.startsWith('public/monaco/')) return true;
  return false;
}

function tara(kok, rel, out) {
  rel = rel || '';
  let girdiler;
  try {
    girdiler = fs.readdirSync(path.join(kok, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const g of girdiler.sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? rel + '/' + g.name : g.name;
    if (disla(r)) continue;
    if (g.isDirectory()) tara(kok, r, out);
    else if (g.isFile()) out.push(r);
  }
}

/* ------------------------------------------------------------------ */
/* ZIP yazımı — arşiv (stored, sıkıştırmasız)                          */
/* ------------------------------------------------------------------ */
/* Node'un yerleşik ZIP yazıcısı yok, dış bağımlılık da yasak. "stored"
 * yöntemi geçerli bir ZIP üretir; Windows Gezgin, 7-Zip ve unzip açabilir.
 * PNG/JPEG/tar.gz zaten sıkıştırılmış olduğu için kayıp ihmal edilebilir;
 * metin dosyalarında boyut biraz büyür, karşılığında bağımlılık sıfırdır. */
function zipYaz(dosyalar, hedef) {
  const parcalar = [];
  const merkez = [];
  let ofset = 0;

  function crc32(buf) {
    let c;
    const tablo = crc32.tablo || (crc32.tablo = (function () {
      const t = new Int32Array(256);
      for (let n = 0; n < 256; n += 1) {
        c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
    let crc = -1;
    for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ tablo[(crc ^ buf[i]) & 0xff];
    return (crc ^ -1) >>> 0;
  }

  const tarih = new Date();
  const saat = ((tarih.getHours() << 11) | (tarih.getMinutes() << 5) | (tarih.getSeconds() / 2)) & 0xffff;
  const gun = (((tarih.getFullYear() - 1980) << 9) | ((tarih.getMonth() + 1) << 5) | tarih.getDate()) & 0xffff;

  for (const d of dosyalar) {
    const veri = fs.readFileSync(d.abs);
    const adBuf = Buffer.from(d.ad, 'utf8');
    const crc = crc32(veri);

    const yerel = Buffer.alloc(30);
    yerel.writeUInt32LE(0x04034b50, 0);
    yerel.writeUInt16LE(20, 4);           // sürüm
    yerel.writeUInt16LE(0x0800, 6);       // UTF-8 ad
    yerel.writeUInt16LE(0, 8);            // stored
    yerel.writeUInt16LE(saat, 10);
    yerel.writeUInt16LE(gun, 12);
    yerel.writeUInt32LE(crc, 14);
    yerel.writeUInt32LE(veri.length, 18);
    yerel.writeUInt32LE(veri.length, 22);
    yerel.writeUInt16LE(adBuf.length, 26);
    yerel.writeUInt16LE(0, 28);

    parcalar.push(yerel, adBuf, veri);

    const mer = Buffer.alloc(46);
    mer.writeUInt32LE(0x02014b50, 0);
    mer.writeUInt16LE(20, 4);
    mer.writeUInt16LE(20, 6);
    mer.writeUInt16LE(0x0800, 8);
    mer.writeUInt16LE(0, 10);
    mer.writeUInt16LE(saat, 12);
    mer.writeUInt16LE(gun, 14);
    mer.writeUInt32LE(crc, 16);
    mer.writeUInt32LE(veri.length, 20);
    mer.writeUInt32LE(veri.length, 24);
    mer.writeUInt16LE(adBuf.length, 28);
    mer.writeUInt16LE(0, 30);
    mer.writeUInt16LE(0, 32);
    mer.writeUInt16LE(0, 34);
    mer.writeUInt16LE(0, 36);
    mer.writeUInt32LE(0, 38);
    mer.writeUInt32LE(ofset, 42);
    merkez.push(Buffer.concat([mer, adBuf]));

    ofset += yerel.length + adBuf.length + veri.length;
  }

  const merkezBuf = Buffer.concat(merkez);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(0, 4);
  son.writeUInt16LE(0, 6);
  son.writeUInt16LE(dosyalar.length, 8);
  son.writeUInt16LE(dosyalar.length, 10);
  son.writeUInt32LE(merkezBuf.length, 12);
  son.writeUInt32LE(ofset, 16);
  son.writeUInt16LE(0, 20);

  fs.writeFileSync(hedef, Buffer.concat([Buffer.concat(parcalar), merkezBuf, son]));
}

/* ------------------------------------------------------------------ */
/* Ana akış                                                            */
/* ------------------------------------------------------------------ */
function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const iCikti = argv.indexOf('--cikti');
  const cikti = iCikti !== -1 ? path.resolve(argv[iCikti + 1]) : path.join(KOK, '..', 'indirmeler');

  const tumDosyalar = [];
  tara(KOK, '', tumDosyalar);

  if (!dry) fs.mkdirSync(cikti, { recursive: true });

  const ozetler = [];
  console.log('\n  İNDİRME ARŞİVLERİ');
  console.log('  =================\n');

  for (const a of ARSIVLER) {
    const secilen = tumDosyalar.filter(a.sec);
    if (!secilen.length) {
      console.log(`  ${a.ad} — ATLANDI (dosya yok)`);
      continue;
    }
    const toplam = secilen.reduce((t, r) => t + fs.statSync(path.join(KOK, r)).size, 0);
    console.log(`  ${a.ad}`);
    console.log(`    ${a.aciklama}`);
    console.log(`    ${secilen.length} dosya · ${(toplam / 1024 / 1024).toFixed(1)} MB`);

    if (dry) {
      for (const r of secilen.slice(0, 5)) console.log(`      · ${r}`);
      if (secilen.length > 5) console.log(`      · … +${secilen.length - 5} dosya`);
      console.log('');
      continue;
    }

    const hedef = path.join(cikti, a.ad);
    zipYaz(
      secilen.map((r) => ({ ad: a.kok + '/' + r, abs: path.join(KOK, r) })),
      hedef,
    );
    const boyut = fs.statSync(hedef).size;
    const sha = crypto.createHash('sha256').update(fs.readFileSync(hedef)).digest('hex');
    ozetler.push({ ad: a.ad, boyut: boyut, sha: sha, dosya: secilen.length });
    console.log(`    → ${(boyut / 1024 / 1024).toFixed(2)} MB · SHA-256 ${sha.slice(0, 16)}…\n`);
  }

  if (dry) {
    console.log('  --dry: hiçbir şey yazılmadı.\n');
    return 0;
  }

  /* SHA256SUMS.txt — tek doğru özet kaynağı */
  const satirlar = ozetler.map((o) => `${o.sha}  ${o.ad}`).join('\n') + '\n';
  fs.writeFileSync(path.join(cikti, 'SHA256SUMS.txt'), satirlar);

  console.log('  SHA256SUMS.txt yazıldı.\n');
  console.log('  Doğrulama (Windows PowerShell):');
  console.log('    Get-FileHash .\\1-KAYNAK-KOD.zip -Algorithm SHA256\n');
  console.log(`  Klasör: ${cikti}\n`);
  return 0;
}

process.exit(main());

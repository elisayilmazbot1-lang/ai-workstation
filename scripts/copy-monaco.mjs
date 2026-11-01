/**
 * Monaco Editor'ün çalışma zamanı dosyalarını `public/monaco/vs` altına kopyalar.
 *
 * Neden paketlemiyoruz: Monaco'yu ESM olarak paketlemek 5+ MB'lık dev bir
 * yığın üretir ve düşük bellekli makinelerde derlemeyi kilitler. AMD
 * dağıtımını statik dosya olarak sunmak hem daha küçük hem çevrimdışı
 * çalışmaya daha uygundur (masaüstü uygulaması internet olmadan açılır).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const target = path.join(root, 'public', 'monaco', 'vs');

if (!fs.existsSync(source)) {
  console.error('monaco-editor paketi bulunamadı. Önce `npm install` çalıştırın.');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });

const size = (dir) => {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? size(full) : fs.statSync(full).size;
  }
  return total;
};

console.log(`Monaco kopyalandı → public/monaco/vs (${(size(target) / 1024 / 1024).toFixed(1)} MB)`);

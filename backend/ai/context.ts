/**
 * Bağlam seçimi ve kısıtlama.
 *
 * Şartname §8.5: bütün proje içeriği her istekte modele gönderilmez;
 * ilgili dosya, fonksiyon, bağımlı modül ve testler önceliklendirilir.
 * Gizli dosyalar bağlamdan çıkarılır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { shouldRedactFromContext, toRelative } from '../security/paths.js';
import { IGNORED_DIRECTORIES, BINARY_EXTENSIONS } from '../../shared/types/projects.js';

export interface ContextFile {
  path: string;
  content: string;
  score: number;
  reason: string;
}

export interface ContextOptions {
  maxFiles: number;
  maxCharsPerFile: number;
  maxTotalChars: number;
  /** Kullanıcı sorgusundaki anahtar sözcükler. */
  keywords: string[];
}

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'py', 'go', 'rs', 'java', 'cs', 'php', 'rb', 'kt', 'swift',
  'css', 'scss', 'html', 'md', 'yml', 'yaml', 'toml', 'sql', 'sh', 'ps1', 'dockerfile', 'txt', 'ini', 'env',
]);

const TEST_PATTERNS = [/\.(test|spec)\.[a-z]+$/i, /(^|\/)tests?\//i, /__tests__/i];
const DOC_PATTERNS = [/readme/i, /(^|\/)docs?\//i, /\.md$/i];

export function collectProjectContext(root: string, options: ContextOptions): { files: ContextFile[]; skipped: string[]; totalChars: number } {
  const files: ContextFile[] = [];
  const skipped: string[] = [];
  let totalChars = 0;
  const keywords = (options.keywords ?? []).map((k) => k.toLowerCase()).filter((k) => k.length > 2);

  const walk = (dir: string, depth: number): void => {
    if (depth > 6 || files.length >= options.maxFiles * 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= options.maxFiles * 4) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.includes(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = toRelative(root, full);
      if (shouldRedactFromContext(rel)) {
        skipped.push(`${rel} (hassas dosya)`);
        continue;
      }
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (BINARY_EXTENSIONS.includes(ext)) continue;
      const isDockerfile = /^dockerfile$/i.test(entry.name);
      if (!CODE_EXTENSIONS.has(ext) && !isDockerfile) continue;

      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.size > 512 * 1024) {
        skipped.push(`${rel} (çok büyük)`);
        continue;
      }

      const score = scoreFile(rel, keywords);
      if (score <= 0) continue;
      let content: string;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      files.push({
        path: rel,
        content: content.slice(0, options.maxCharsPerFile),
        score,
        reason: scoreReason(rel, keywords, score),
      });
    }
  };

  walk(root, 0);
  files.sort((a, b) => b.score - a.score);

  const selected: ContextFile[] = [];
  for (const file of files) {
    if (selected.length >= options.maxFiles) break;
    if (totalChars + file.content.length > options.maxTotalChars) {
      const remaining = options.maxTotalChars - totalChars;
      if (remaining > 2000) {
        selected.push({ ...file, content: `${file.content.slice(0, remaining)}\n… (kısaltıldı)` });
        totalChars += remaining;
      }
      break;
    }
    selected.push(file);
    totalChars += file.content.length;
  }
  return { files: selected, skipped, totalChars };
}

function scoreFile(relPath: string, keywords: string[]): number {
  const lower = relPath.toLowerCase();
  let score = 1;
  for (const kw of keywords) if (lower.includes(kw)) score += 6;
  if (TEST_PATTERNS.some((p) => p.test(relPath))) score += 1.5;
  if (DOC_PATTERNS.some((p) => p.test(relPath))) score += 1;
  if (/^(package\.json|tsconfig\.json|vite\.config\.ts|docker-compose\.ya?ml)$/i.test(relPath)) score += 3;
  if (/index\.(ts|js|tsx|jsx)$/i.test(relPath)) score += 0.5;
  if (lower.split('/').length > 5) score -= 0.5;
  return score;
}

function scoreReason(relPath: string, keywords: string[], _score: number): string {
  const matched = keywords.filter((k) => relPath.toLowerCase().includes(k));
  if (matched.length) return `Sorgu ile eşleşiyor: ${matched.join(', ')}`;
  if (TEST_PATTERNS.some((p) => p.test(relPath))) return 'Test dosyası';
  if (DOC_PATTERNS.some((p) => p.test(relPath))) return 'Dokümantasyon';
  if (/^(package\.json|tsconfig\.json)/i.test(relPath)) return 'Yapılandırma';
  return 'Genel bağlam';
}

export function keywordsFromText(text: string): string[] {
  const stop = new Set([
    've', 'ile', 'için', 'bir', 'bu', 'şu', 'olan', 'olarak', 'daha', 'çok', 'the', 'and', 'for', 'with', 'this', 'that',
    'proje', 'projeyi', 'dosya', 'dosyayı', 'kodu', 'kod', 'lütfen', 'bana', 'tüm', 'bütün', 'analiz', 'et', 'yap',
  ]);
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s._\-/]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w)),
  )].slice(0, 14);
}

export function buildContextBlock(files: ContextFile[]): string {
  if (!files.length) return '';
  return files
    .map((f) => `--- DOSYA: ${f.path} (${f.reason}) ---\n${f.content}\n--- DOSYA SONU ---`)
    .join('\n\n');
}

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildContextBlock, collectProjectContext, keywordsFromText } from '../../backend/ai/context.js';
import { writeProjectFixture } from '../helpers.js';

describe('Bağlam seçimi', () => {
  it('anahtar sözcükleri çıkarır ve Türkçe dolgu sözcüklerini atar', () => {
    const kw = keywordsFromText('Bu projeyi baştan sona analiz et ve hataları düzelt');
    expect(kw).toContain('hataları');
    expect(kw).not.toContain('ve');
    expect(kw).not.toContain('bu');
    expect(kw).not.toContain('analiz');
    expect(kw).not.toContain('projeyi');
  });

  it('hassas dosyaları bağlamdan çıkarır', () => {
    const root = writeProjectFixture();
    const ctx = collectProjectContext(root, { maxFiles: 20, maxCharsPerFile: 5000, maxTotalChars: 50000, keywords: ['index'] });
    const paths = ctx.files.map((f) => f.path);
    expect(paths).not.toContain('.env');
    expect(ctx.skipped.some((s) => s.includes('.env'))).toBe(true);
  });

  it('node_modules gibi dizinleri atlar', () => {
    const root = writeProjectFixture();
    const ctx = collectProjectContext(root, { maxFiles: 20, maxCharsPerFile: 5000, maxTotalChars: 50000, keywords: [] });
    expect(ctx.files.every((f) => !f.path.includes('node_modules'))).toBe(true);
  });

  it('sorguyla eşleşen dosyaları öne çıkarır', () => {
    const root = writeProjectFixture();
    const ctx = collectProjectContext(root, { maxFiles: 3, maxCharsPerFile: 5000, maxTotalChars: 50000, keywords: ['index'] });
    expect(ctx.files[0]?.path).toContain('index');
  });

  it('toplam karakter sınırını aşmaz', () => {
    const root = writeProjectFixture();
    const ctx = collectProjectContext(root, { maxFiles: 50, maxCharsPerFile: 100_000, maxTotalChars: 120, keywords: [] });
    expect(ctx.totalChars).toBeLessThanOrEqual(200);
  });

  it('bağlam bloğu dosya başlıkları içerir', () => {
    const block = buildContextBlock([{ path: 'a.ts', content: 'x', score: 1, reason: 'genel' }]);
    expect(block).toContain('--- DOSYA: a.ts');
  });

  it('boş bağlam boş metin döndürür', () => {
    expect(buildContextBlock([])).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { extractJsonBlock, extractSummary, parseFileWrites, parsePlan, parseReview } from '../../backend/agents/parser.js';

describe('Ajan çıktı ayrıştırıcıları', () => {
  it('JSON bloğunu kod çitinden çıkarır', () => {
    const json = extractJsonBlock('İşte plan:\n```json\n{"a":1}\n```\n');
    expect(json).toEqual({ a: 1 });
  });

  it('bozuk JSON u onarır (sondaki virgül)', () => {
    expect(extractJsonBlock('{"plan":[{"role":"coder",}],}')).toBeTruthy();
  });

  it('geçerli planı ayrıştırır', () => {
    const raw = JSON.stringify({
      plan: [
        { role: 'researcher', title: 'Araştır', instruction: 'Kaynak bul', dependsOn: [] },
        { role: 'coder', title: 'Yaz', instruction: 'Dosya üret', dependsOn: [0], files: ['src/a.ts'] },
      ],
      risks: ['belirsizlik'],
      needsApproval: true,
    });
    const result = parsePlan(raw, 't', 'd');
    expect(result.parseMode).toBe('strict');
    expect(result.plan).toHaveLength(2);
    expect(result.plan[1]?.dependsOn).toEqual([0]);
    expect(result.needsApproval).toBe(true);
  });

  it('geçersiz plan JSON unda güvenli varsayılana düşer', () => {
    const result = parsePlan('Plan yapamadım, özür dilerim.', 'Başlık', 'Açıklama');
    expect(result.parseMode).toBe('fallback');
    expect(result.plan.length).toBeGreaterThanOrEqual(3);
    expect(result.plan.some((p) => p.role === 'coder')).toBe(true);
    expect(result.plan.some((p) => p.role === 'security')).toBe(true);
  });

  it('bilinmeyen rolü mimar olarak kabul eder', () => {
    const raw = JSON.stringify({ plan: [{ role: 'hacker', title: 'x', instruction: 'y' }] });
    expect(parsePlan(raw, 't', 'd').plan[0]?.role).toBe('architect');
  });

  it('dosya bloklarını ayrıştırır', () => {
    const text = '```file:src/a.ts\nexport const a = 1;\n```\nmetin\n```file:test/b.spec.ts\nit("x", () => {});\n```';
    const writes = parseFileWrites(text);
    expect(writes).toHaveLength(2);
    expect(writes[0]?.path).toBe('src/a.ts');
    expect(writes[0]?.content).toContain('export const a = 1;');
  });

  it('üst dizin içeren dosya yollarını yok sayar', () => {
    const writes = parseFileWrites('```file:../../etc/passwd\nx\n```');
    expect(writes).toHaveLength(0);
  });

  it('dosya bloğu yoksa boş döner', () => {
    expect(parseFileWrites('Sadece açıklama.')).toHaveLength(0);
  });

  it('denetim kararını ayrıştırır', () => {
    const v = parseReview('```json\n{"verdict":"revise","issues":[{"severity":"high","description":"SQL enjeksiyonu"}],"confidence":80}\n```');
    expect(v.verdict).toBe('revise');
    expect(v.issues[0]?.severity).toBe('high');
    expect(v.parseMode).toBe('strict');
  });

  it('bozuk denetim yanıtında temkinli davranır', () => {
    const v = parseReview('Bence güzel olmuş.');
    expect(v.verdict).toBe('revise');
    expect(v.confidence).toBeLessThan(50);
  });

  it('özeti çıkarır', () => {
    expect(extractSummary('kod...\n\nÖZET: İki dosya güncellendi.')).toBe('İki dosya güncellendi.');
  });
});

describe('Ayrıştırıcı dayanıklılığı', () => {
  it('denetim yanıtında kod bloğu olsa bile JSON kararını bulur', () => {
    const text = 'İncelenen kod:\n```\nexport const a = 1;\n```\n\n```json\n{"verdict":"approve","issues":[],"suggestions":[],"confidence":90}\n```';
    const j = extractJsonBlock(text) as { verdict?: string };
    expect(j.verdict).toBe('approve');
    expect(parseReview(text).verdict).toBe('approve');
  });

  it('çoklu kod bloğunda JSON içereni seçer', () => {
    const text = '```ts\nconst x = 1;\n```\n```json\n{"plan":[{"role":"coder","title":"t","instruction":"i"}]}\n```';
    const plan = parsePlan(text, 'a', 'b');
    expect(plan.parseMode).toBe('strict');
    expect(plan.plan[0]?.role).toBe('coder');
  });
});

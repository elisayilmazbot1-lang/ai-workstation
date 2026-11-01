import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createContainer, type Container } from '../../backend/server/container.js';
import { makeTempDir, writeProjectFixture } from '../helpers.js';

describe('Dosya servisi', () => {
  let c: Container;
  let projectId: string;
  let root: string;

  beforeEach(() => {
    c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    root = writeProjectFixture();
    projectId = c.projects.create({ rootPath: root }).id;
  });

  it('dizin ağacını üretir ve node_modules işaretler', () => {
    const tree = c.files.tree(projectId, 2);
    const names = (tree.children ?? []).map((n) => n.name);
    expect(names).toContain('src');
    const nm = (tree.children ?? []).find((n) => n.name === 'node_modules');
    expect(nm?.ignored).toBe(true);
  });

  it('dosya okur ve dil algılar', () => {
    const result = c.files.read(projectId, 'src/index.ts');
    expect(result.language).toBe('typescript');
    expect(result.content).toContain('topla');
  });

  it('ikili dosyada içerik döndürmez', () => {
    fs.writeFileSync(path.join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = c.files.read(projectId, 'logo.png');
    expect(result.encoding).toBe('binary');
    expect(result.content).toBe('');
  });

  it('yazma öncesi yedek alır ve değişiklik kaydı üretir', () => {
    const { change, backup } = c.files.write({ projectId, relativePath: 'src/index.ts', content: 'export const x = 1;\n' });
    expect(change.operation).toBe('update');
    expect(backup).toBeTruthy();
    expect(fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8')).toContain('export const x = 1');
    expect(c.files.listBackups(projectId, 'src/index.ts')).toHaveLength(1);
  });

  it('değişiklik geri alınabilir', () => {
    const original = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
    const { change } = c.files.write({ projectId, relativePath: 'src/index.ts', content: 'değişti\n' });
    const reverted = c.files.revertChange(change.id);
    expect(reverted.status).toBe('reverted');
    expect(fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8')).toBe(original);
  });

  it('önerilen değişikliği onay sonrası uygular', () => {
    const change = c.files.recordChange({
      projectId,
      path: 'yeni/dosya.ts',
      operation: 'create',
      oldContent: '',
      newContent: 'export {};\n',
      summary: 'öneri',
      status: 'proposed',
    });
    expect(fs.existsSync(path.join(root, 'yeni/dosya.ts'))).toBe(false);

    // Onay olmadan yazma reddedilir (güvenlik kapısı).
    expect(() => c.files.applyChange(change.id)).toThrow(/onayı gerekiyor/i);
    expect(fs.existsSync(path.join(root, 'yeni/dosya.ts'))).toBe(false);

    const approval = c.files.requestChangeApproval([change.id]);
    expect(approval?.approvalId).toBeTruthy();
    c.approvals.approve(approval!.approvalId);

    c.files.applyChange(change.id);
    expect(fs.existsSync(path.join(root, 'yeni/dosya.ts'))).toBe(true);
    c.files.revertChange(change.id);
    expect(fs.existsSync(path.join(root, 'yeni/dosya.ts'))).toBe(false);
  });

  it('onaydan sonra içerik değişirse yazma reddedilir (TOCTOU)', () => {
    const change = c.files.recordChange({
      projectId,
      path: 'toctou.ts',
      operation: 'create',
      oldContent: '',
      newContent: 'export const guvenli = true;\n',
      summary: 'öneri',
      status: 'proposed',
    });
    const approval = c.files.requestChangeApproval([change.id]);
    c.approvals.approve(approval!.approvalId);

    // Onaydan sonra kayıt değiştirilir (saldırgan senaryosu)
    c.db.db.prepare('UPDATE file_changes SET new_content = ? WHERE id = ?').run('zararli();\n', change.id);

    expect(() => c.files.applyChange(change.id)).toThrow(/onayı gerekiyor/i);
    expect(fs.existsSync(path.join(root, 'toctou.ts'))).toBe(false);
  });

  it('hassas dosyaya değişiklik önerisi reddedilir', () => {
    expect(() =>
      c.files.recordChange({
        projectId,
        path: '.env',
        operation: 'update',
        oldContent: 'A=1',
        newContent: 'A=2',
        summary: 'sızıntı',
        status: 'proposed',
      }),
    ).toThrow(/Hassas/i);
  });

  it('proje dışına yazmayı engeller', () => {
    expect(() => c.files.write({ projectId, relativePath: '../../kacak.txt', content: 'x' })).toThrow();
  });

  it('içerik arama yapar ve hassas dosyaları atlar', () => {
    const results = c.files.search(projectId, 'topla');
    expect(results.length).toBeGreaterThan(0);
    const envResults = c.files.search(projectId, 'OPENAI_API_KEY');
    expect(envResults).toHaveLength(0);
  });

  it('diff üretir', () => {
    const diff = c.files.diff(projectId, 'src/index.ts', 'export const degisti = true;\n');
    expect(diff.additions).toBeGreaterThan(0);
    expect(diff.removals).toBeGreaterThan(0);
    expect(diff.unified).toContain('önce');
  });

  it('değişmeyen içerikte yazmayı reddeder', () => {
    const content = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    expect(() => c.files.write({ projectId, relativePath: 'README.md', content })).toThrow(/değişmedi/);
  });

  it('yedekten geri yükleme yapar', () => {
    const { backup } = c.files.write({ projectId, relativePath: 'README.md', content: 'yeni içerik\n' });
    c.files.restoreBackup(projectId, backup!.id);
    expect(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('Fixture proje');
  });
});

/**
 * E-46 — Windows EXE, CI, kod imzalama ve otomatik güncelleme durumları
 * BİRBİRİNDEN BAĞIMSIZ ve kanıta dayalı raporlanır.
 *
 * Bu test, belgelerin bu dört konuyu tek satırda birleştirmesini engeller ve
 * "yapılandırma var" ile "doğrulandı" arasındaki farkı makinece denetler.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const readme = fs.readFileSync(path.resolve('README_TR.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  build?: unknown;
};
const builder = fs.readFileSync(path.resolve('electron-builder.yml'), 'utf8');

describe('dört bağımsız yayın durumu', () => {
  it('README dört konuyu AYRI satırlarda ve etiketlerle bildirir', () => {
    expect(readme).toMatch(/\| \*\*Windows EXE üretimi\*\* `\[DOĞRULANMADI\]` \|/);
    expect(readme).toMatch(/\| \*\*CI \(GitHub Actions\)\*\* `\[DOĞRULANMADI\]` \|/);
    expect(readme).toMatch(/\| \*\*Kod imzalama\*\* `\[EKSİK\]` \|/);
    expect(readme).toMatch(/\| \*\*Otomatik güncelleme\*\* `\[EKSİK\]` \|/);
    // Tek satırda birleştirilmiş eski iddia geri gelmemeli.
    expect(readme).not.toMatch(/\| Otomatik güncelleme \| `electron-updater` altyapısına hazır/);
  });

  it('otomatik güncelleme gerçekten yoktur (doc-code kanıtı)', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['electron-updater']).toBeUndefined();
    expect(readme).toContain('`electron-updater` **`package.json` bağımlılıklarında yok**');
  });

  it('kod imzalama yapılandırılmamıştır (doc-code kanıtı)', () => {
    expect(builder).not.toMatch(/certificateFile|certificateSubjectName|azureSignOptions|signingHashAlgorithms/);
  });

  it('CI iş akışı vardır ama yalnızca elle/etiketle tetiklenir', () => {
    const workflow = fs.readFileSync(path.resolve('.github/workflows/build-windows.yml'), 'utf8');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain("tags:");
    expect(workflow).toContain('runs-on: windows-latest');
  });

  it('EXE üretimi Windows betiğiyle tanımlıdır, doğrulanmış sayılmaz', () => {
    expect(fs.existsSync(path.resolve('scripts/build-windows.ps1'))).toBe(true);
    expect(builder).toContain('target: nsis');
    expect(readme).toContain('hiç üretilmedi ve Windows');
  });
});

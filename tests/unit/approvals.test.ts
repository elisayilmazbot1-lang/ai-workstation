import { describe, expect, it } from 'vitest';
import { createContainer } from '../../backend/server/container.js';
import { makeTempDir, writeProjectFixture } from '../helpers.js';

describe('Onay yığılması', () => {
  it('aynı komut için tek bekleyen onay oluşur', async () => {
    const c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    const root = writeProjectFixture();
    const projectId = c.projects.create({ rootPath: root }).id;
    const first = await c.terminal.run({ command: 'git commit -am "test"', cwd: root, proposedBy: 'user' });
    const second = await c.terminal.run({ command: 'git commit -am "test"', cwd: root, proposedBy: 'user' });
    expect(first.requiresApproval?.approvalId).toBeTruthy();
    expect(second.requiresApproval?.approvalId).toBe(first.requiresApproval?.approvalId);
    const pending = c.approvals.list('pending').filter((a) => a.kind === 'command' && (a.payload as { cwd?: string }).cwd === root);
    expect(pending.length).toBe(1);
    expect(projectId).toBeTruthy();
  });

  it('onaylanan komut yalnızca onaylanan metinle çalışır', async () => {
    const c = createContainer({ dataDir: makeTempDir(), inMemoryDb: true });
    const root = writeProjectFixture();
    c.projects.create({ rootPath: root });
    const first = await c.terminal.run({ command: 'git commit -am "bir"', cwd: root, proposedBy: 'user' });
    const approvalId = first.requiresApproval?.approvalId;
    expect(approvalId).toBeTruthy();
    c.approvals.approve(approvalId!);
    await expect(c.terminal.run({ command: 'git push --force', cwd: root, proposedBy: 'user', approvalId })).rejects.toThrow(/uyuşmuyor/i);
  });
});

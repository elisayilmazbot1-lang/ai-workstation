/**
 * Ajan profilleri (şartname §6.9).
 *
 * Her ajana bağımsız model atanabilir. Model atanmamışsa ayarlardaki
 * varsayılan model kullanılır; o da yoksa ilk ücretsiz model.
 */
import type { Db } from '../database/db.js';
import { parseJson, toBool } from '../database/db.js';
import type { AgentProfile, AgentRole } from '../../shared/types/agents.js';
import { AGENT_ROLES, AGENT_ROLE_LABELS } from '../../shared/types/agents.js';

export const DEFAULT_PROFILES: Record<AgentRole, Omit<AgentProfile, 'modelId' | 'fallbackModelId'>> = {
  manager: {
    role: 'manager',
    displayName: AGENT_ROLE_LABELS.manager,
    description: 'Talebi analiz eder, görevi uzman ajanlara böler ve sonuçları birleştirir.',
    enabled: true,
    maxParallelRuns: 1,
    temperature: 0.1,
    allowedTools: [],
    canWriteFiles: false,
    canProposeCommands: false,
  },
  researcher: {
    role: 'researcher',
    displayName: AGENT_ROLE_LABELS.researcher,
    description: 'İnternet ve doküman araştırması, sürüm karşılaştırması, kaynak doğrulaması yapar.',
    enabled: true,
    maxParallelRuns: 2,
    temperature: 0.3,
    allowedTools: ['web-search', 'read-file'],
    canWriteFiles: false,
    canProposeCommands: false,
  },
  architect: {
    role: 'architect',
    displayName: AGENT_ROLE_LABELS.architect,
    description: 'Mimari analiz, modül planlaması ve veri akışı tasarımı yapar.',
    enabled: true,
    maxParallelRuns: 2,
    temperature: 0.2,
    allowedTools: ['read-file', 'list-files'],
    canWriteFiles: false,
    canProposeCommands: false,
  },
  coder: {
    role: 'coder',
    displayName: AGENT_ROLE_LABELS.coder,
    description: 'Kod üretir, düzenler ve refactor eder. Dosya değişikliklerini öneri olarak hazırlar.',
    enabled: true,
    maxParallelRuns: 1,
    temperature: 0.15,
    allowedTools: ['read-file', 'write-file-proposal'],
    canWriteFiles: true,
    canProposeCommands: false,
  },
  tester: {
    role: 'tester',
    displayName: AGENT_ROLE_LABELS.tester,
    description: 'Birim/entegrasyon/E2E testlerini planlar ve çalıştırılmasını önerir.',
    enabled: true,
    maxParallelRuns: 1,
    temperature: 0.1,
    allowedTools: ['run-tests', 'propose-command'],
    canWriteFiles: false,
    canProposeCommands: true,
  },
  security: {
    role: 'security',
    displayName: AGENT_ROLE_LABELS.security,
    description: 'Kimlik bilgisi, komut güvenliği, bağımlılık ve prompt injection risklerini inceler.',
    enabled: true,
    maxParallelRuns: 2,
    temperature: 0.05,
    allowedTools: ['scan-security', 'read-file'],
    canWriteFiles: false,
    canProposeCommands: false,
  },
  performance: {
    role: 'performance',
    displayName: AGENT_ROLE_LABELS.performance,
    description: 'Bellek, CPU, yanıt süresi ve gereksiz çağrıları analiz eder.',
    enabled: false,
    maxParallelRuns: 1,
    temperature: 0.2,
    allowedTools: ['read-file'],
    canWriteFiles: false,
    canProposeCommands: false,
  },
  docs: {
    role: 'docs',
    displayName: AGENT_ROLE_LABELS.docs,
    description: 'README, kurulum ve kullanım dokümantasyonu üretir.',
    enabled: true,
    maxParallelRuns: 1,
    temperature: 0.3,
    allowedTools: ['read-file', 'write-file-proposal'],
    canWriteFiles: true,
    canProposeCommands: false,
  },
  browser: {
    role: 'browser',
    displayName: AGENT_ROLE_LABELS.browser,
    description: 'Tarayıcı üzerinden sayfa analizi ve etkileşim planlar.',
    enabled: false,
    maxParallelRuns: 1,
    temperature: 0.2,
    allowedTools: ['browser-read', 'browser-click'],
    canWriteFiles: false,
    canProposeCommands: false,
  },
};

export class AgentProfileService {
  constructor(private readonly db: Db) {
    this.seed();
  }

  private seed(): void {
    const insert = this.db.prepare(
      `INSERT INTO agent_profiles (role, display_name, description, enabled, max_parallel_runs, temperature, allowed_tools, can_write_files, can_propose_commands)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(role) DO NOTHING`,
    );
    const tx = this.db.transaction(() => {
      for (const role of AGENT_ROLES) {
        const p = DEFAULT_PROFILES[role];
        insert.run(
          p.role,
          p.displayName,
          p.description,
          p.enabled ? 1 : 0,
          p.maxParallelRuns,
          p.temperature,
          JSON.stringify(p.allowedTools),
          p.canWriteFiles ? 1 : 0,
          p.canProposeCommands ? 1 : 0,
        );
      }
    });
    tx();
  }

  list(): AgentProfile[] {
    const rows = this.db.prepare('SELECT * FROM agent_profiles').all() as Array<Record<string, unknown>>;
    const order = new Map(AGENT_ROLES.map((r, i) => [r, i]));
    return rows
      .map((r) => this.mapRow(r))
      .sort((a, b) => (order.get(a.role) ?? 99) - (order.get(b.role) ?? 99));
  }

  get(role: AgentRole): AgentProfile {
    const row = this.db.prepare('SELECT * FROM agent_profiles WHERE role = ?').get(role) as Record<string, unknown> | undefined;
    if (!row) return { ...DEFAULT_PROFILES[role] };
    return this.mapRow(row);
  }

  update(role: AgentRole, patch: Partial<AgentProfile>): AgentProfile {
    const current = this.get(role);
    this.db
      .prepare(
        `UPDATE agent_profiles SET display_name = ?, description = ?, model_id = ?, fallback_model_id = ?, enabled = ?,
           max_parallel_runs = ?, temperature = ?, allowed_tools = ?, can_write_files = ?, can_propose_commands = ? WHERE role = ?`,
      )
      .run(
        patch.displayName ?? current.displayName,
        patch.description ?? current.description,
        patch.modelId ?? current.modelId ?? null,
        patch.fallbackModelId ?? current.fallbackModelId ?? null,
        (patch.enabled ?? current.enabled) ? 1 : 0,
        patch.maxParallelRuns ?? current.maxParallelRuns,
        patch.temperature ?? current.temperature,
        JSON.stringify(patch.allowedTools ?? current.allowedTools),
        (patch.canWriteFiles ?? current.canWriteFiles) ? 1 : 0,
        (patch.canProposeCommands ?? current.canProposeCommands) ? 1 : 0,
        role,
      );
    return this.get(role);
  }

  /**
   * Ajan için kullanılacak modeli çözer: profil modeli → varsayılan →
   * ücretsiz/kullanılabilir ilk model.
   */
  resolveModel(role: AgentRole, deps: { defaultModelId?: string; listModels: () => Array<{ id: string; availability: string }> }): string | undefined {
    const profile = this.get(role);
    if (profile.modelId) return profile.modelId;
    if (deps.defaultModelId) return deps.defaultModelId;
    return deps.listModels().find((m) => m.availability !== 'unavailable')?.id;
  }

  private mapRow(r: Record<string, unknown>): AgentProfile {
    return {
      role: r.role as AgentRole,
      displayName: String(r.display_name),
      description: String(r.description),
      modelId: (r.model_id as string) ?? undefined,
      fallbackModelId: (r.fallback_model_id as string) ?? undefined,
      enabled: toBool(r.enabled),
      maxParallelRuns: Number(r.max_parallel_runs ?? 1),
      temperature: Number(r.temperature ?? 0.2),
      allowedTools: parseJson<string[]>(r.allowed_tools, []),
      canWriteFiles: toBool(r.can_write_files),
      canProposeCommands: toBool(r.can_propose_commands),
    };
  }
}

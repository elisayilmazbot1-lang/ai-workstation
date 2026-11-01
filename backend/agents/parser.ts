/**
 * Ajan çıktılarını ayrıştırıcılar.
 *
 * Modeller her zaman geçerli JSON veya biçimli kod döndürmez. Bu modül
 * hoşgörülü ayrıştırma yapar ve ayrıştırılamayan kısmı kaybetmeden raporlar.
 */
import type { AgentRole } from '../../shared/types/agents.js';

export interface PlannedStep {
  role: AgentRole;
  title: string;
  instruction: string;
  dependsOn: number[];
  files: string[];
}

export interface PlanResult {
  plan: PlannedStep[];
  risks: string[];
  needsApproval: boolean;
  parseMode: 'strict' | 'repaired' | 'fallback';
  raw: string;
}

const ALLOWED_ROLES: AgentRole[] = ['researcher', 'architect', 'coder', 'tester', 'security', 'performance', 'docs', 'browser'];

/** JSON bloğunu metin içinden çıkarır (```json ... ``` veya süslü parantezler). */
export function extractJsonBlock(text: string): unknown | undefined {
  if (!text) return undefined;
  const candidates: string[] = [];

  // 1) Kod blokları. Dikkat: yanıtın içinde de kod blokları olabilir (ör.
  // denetçi modelin incelediği dosya). Bu yüzden TÜM bloklar denenir, en
  // sondaki blok önce gelir.
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const fence of fences.reverse()) {
    const body = (fence[1] ?? '').trim();
    if (body.startsWith('{') || body.startsWith('[')) candidates.push(body);
  }

  // 2) Düz JSON gövdesi (en dıştaki süslü parantezler).
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Kaba onarım: sondaki virgülleri ve akıllı tırnakları temizle.
      const repaired = candidate
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");
      try {
        return JSON.parse(repaired);
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

export function parsePlan(raw: string, taskTitle: string, description: string): PlanResult {
  const parsed = extractJsonBlock(raw) as
    | { plan?: unknown; risks?: unknown; needsApproval?: unknown }
    | undefined;

  if (parsed && Array.isArray(parsed.plan)) {
    const plan: PlannedStep[] = [];
    for (const item of parsed.plan as Array<Record<string, unknown>>) {
      const roleRaw = String(item.role ?? '').toLowerCase().trim() as AgentRole;
      const role = ALLOWED_ROLES.includes(roleRaw) ? roleRaw : 'architect';
      const dependsOnRaw = Array.isArray(item.dependsOn) ? item.dependsOn : [];
      plan.push({
        role,
        title: String(item.title ?? `${role} adımı`).slice(0, 200),
        instruction: String(item.instruction ?? item.description ?? '').slice(0, 8000),
        dependsOn: dependsOnRaw.filter((d) => Number.isInteger(d) && (d as number) >= 0).map((d) => Number(d)),
        files: Array.isArray(item.files) ? item.files.map(String).filter((f) => f && !f.includes('..')).slice(0, 40) : [],
      });
    }
    if (plan.length) {
      return {
        plan,
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
        needsApproval: Boolean(parsed.needsApproval),
        parseMode: 'strict',
        raw,
      };
    }
  }

  // Yönetici JSON üretmediyse: güvenli, sabit bir iş akışına düş.
  // Bu bir "fallback" planıdır ve raporda açıkça belirtilir.
  return {
    plan: [
      {
        role: 'architect',
        title: 'Talebi ve projeyi analiz et',
        instruction: `Görevi analiz et ve uygulama planı çıkar.\nBaşlık: ${taskTitle}\nAçıklama: ${description}`,
        dependsOn: [],
        files: [],
      },
      {
        role: 'coder',
        title: 'Değişiklikleri hazırla',
        instruction: `Analiz sonucuna göre gerekli dosya değişikliklerini tam içerik olarak üret.\nGörev: ${description}`,
        dependsOn: [0],
        files: [],
      },
      {
        role: 'tester',
        title: 'Doğrulama planı ve testleri hazırla',
        instruction: 'Üretilen değişiklikler için çalıştırılacak test komutlarını ve beklenen sonuçları listele.',
        dependsOn: [1],
        files: [],
      },
      {
        role: 'security',
        title: 'Güvenlik incelemesi',
        instruction: 'Üretilen değişikliklerde kimlik bilgisi sızıntısı, komut enjeksiyonu ve yol güvenliği risklerini incele.',
        dependsOn: [1],
        files: [],
      },
    ],
    risks: ['Yönetici ajan geçerli bir plan döndürmedi; varsayılan iş akışı kullanıldı.'],
    needsApproval: true,
    parseMode: 'fallback',
    raw,
  };
}

export interface ParsedFileWrite {
  path: string;
  content: string;
}

const FILE_BLOCK = /```(?:file|dosya):\s*([^\n`]+)\n([\s\S]*?)```/g;

export function parseFileWrites(text: string): ParsedFileWrite[] {
  const writes: ParsedFileWrite[] = [];
  let match: RegExpExecArray | null;
  FILE_BLOCK.lastIndex = 0;
  while ((match = FILE_BLOCK.exec(text)) !== null) {
    const rawPath = (match[1] ?? '').trim().replace(/^["']|["']$/g, '');
    const content = match[2] ?? '';
    if (!rawPath || rawPath.includes('..')) continue;
    if (rawPath.length > 400) continue;
    writes.push({ path: rawPath.replace(/\\/g, '/').replace(/^\.\//, ''), content: content.replace(/\s+$/, '') + '\n' });
  }
  return writes;
}

export interface ReviewVerdict {
  verdict: 'approve' | 'revise';
  issues: Array<{ severity: string; file?: string; description: string }>;
  suggestions: string[];
  confidence: number;
  parseMode: 'strict' | 'fallback';
}

export function parseReview(text: string): ReviewVerdict {
  const parsed = extractJsonBlock(text) as
    | { verdict?: unknown; issues?: unknown; suggestions?: unknown; confidence?: unknown }
    | undefined;
  if (parsed && (parsed.verdict === 'approve' || parsed.verdict === 'revise')) {
    return {
      verdict: parsed.verdict,
      issues: Array.isArray(parsed.issues)
        ? (parsed.issues as Array<Record<string, unknown>>).map((i) => ({
            severity: String(i.severity ?? 'medium'),
            file: i.file ? String(i.file) : undefined,
            description: String(i.description ?? ''),
          }))
        : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
      parseMode: 'strict',
    };
  }
  return {
    verdict: 'revise',
    issues: [{ severity: 'medium', description: 'Denetçi model geçerli JSON döndürmedi; manuel inceleme önerilir.' }],
    suggestions: [text.slice(0, 1500)],
    confidence: 20,
    parseMode: 'fallback',
  };
}

/** Coder çıktısından "ÖZET:" bölümünü çıkarır. */
export function extractSummary(text: string): string {
  const m = text.match(/ÖZET:\s*([\s\S]{0,1200})/i);
  if (m?.[1]) return m[1].trim();
  const firstParagraph = text.split('\n\n').find((p) => p.trim().length > 40 && !p.includes('```'));
  return (firstParagraph ?? text).slice(0, 600).trim();
}

/**
 * Komut risk sınıflandırıcı (şartname §14.4).
 *
 * Düşük   : salt okunur ve zararsız
 * Orta    : dosya oluşturma/düzenleme
 * Yüksek  : dosya silme, paket kurma, servis durdurma
 * Kritik  : disk işlemleri, kimlik bilgisi değişikliği, geri döndürülemez işlem
 *
 * Bu sınıflandırma bir güvenlik ağıdır, garanti değildir: karar her zaman
 * kullanıcı onayıyla birlikte verilir.
 */
import type { CommandAnalysis, CommandRisk } from '../../shared/types/runtime.js';

interface Rule {
  pattern: RegExp;
  risk: CommandRisk;
  reason: string;
}

const RULES: Rule[] = [
  // ---- Kritik ----
  { pattern: /\b(format|mkfs(\.\w+)?|diskpart|fdisk|parted)\b/i, risk: 'critical', reason: 'Disk biçimlendirme/bölümleme' },
  { pattern: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b\s+(\/|\*|~|\$HOME|C:\\\\?)/i, risk: 'critical', reason: 'Kök/sistem dizininde zorla silme' },
  { pattern: /\bRemove-Item\b.*-Recurse.*-Force/i, risk: 'high', reason: 'Özyinelemeli zorla silme' },
  { pattern: /\b(dd|shred)\b/i, risk: 'critical', reason: 'Ham disk yazma' },
  { pattern: /\b(shutdown|reboot|Restart-Computer|Stop-Computer|halt)\b/i, risk: 'critical', reason: 'Sistem kapatma/yeniden başlatma' },
  { pattern: /\b(reg\s+(add|delete)|Set-ItemProperty\s+HKLM|New-ItemProperty\s+HKLM)/i, risk: 'critical', reason: 'Kayıt defteri değişikliği' },
  { pattern: /\b(net\s+user|net\s+localgroup|whoami\s+\/priv|runas)\b/i, risk: 'critical', reason: 'Kimlik/yetki değişikliği' },
  { pattern: /\b(Set-ExecutionPolicy|Set-MpPreference|Disable-|Enable-PSRemoting)\b/i, risk: 'critical', reason: 'Güvenlik ayarı değişikliği' },
  { pattern: /\b(icacls|takeown|attrib\s+-s|chmod\s+777|chown)\b/i, risk: 'high', reason: 'Dosya izni değişikliği' },
  { pattern: /\b(curl|iwr|Invoke-WebRequest|wget|irm)\b[^|]*\|\s*(sh|bash|powershell|pwsh|iex)\b/i, risk: 'critical', reason: 'İnternetten alınan betiğin doğrudan çalıştırılması' },
  { pattern: /\bgit\s+push\b.*(--force|-f)\b/i, risk: 'critical', reason: 'Zorla uzak depoya yazma' },
  { pattern: /:\(\)\s*\{.*\};\s*:/i, risk: 'critical', reason: 'Fork bomb' },
  { pattern: /\bdel\s+\/[sfq]/i, risk: 'high', reason: 'Windows zorla silme' },
  { pattern: /\b(rd|rmdir)\s+\/[sq]/i, risk: 'high', reason: 'Windows dizin silme' },
  // ---- Yüksek ----
  { pattern: /\brm\s+-r\b|\brm\s+-rf\b/i, risk: 'high', reason: 'Özyinelemeli silme' },
  { pattern: /\brm\b|\bdel\b|\bRemove-Item\b|\brimraf\b|\bunlink\b/i, risk: 'high', reason: 'Dosya silme' },
  { pattern: /\b(npm|pnpm|yarn|bun)\s+(install|i|add|remove|uninstall|ci)\b/i, risk: 'high', reason: 'Paket kurma/kaldırma' },
  { pattern: /\bpip\s+(install|uninstall)\b|\bapt(-get)?\s+(install|remove|purge)\b|\bwinget\s+(install|uninstall)\b|\bchoco\s+(install|uninstall)\b/i, risk: 'high', reason: 'Sistem paketi değişikliği' },
  { pattern: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s|push)\b/i, risk: 'high', reason: 'Kayıt/geçmiş kaybına yol açan git işlemi' },
  { pattern: /\b(docker|docker-compose)\s+(rm|rmi|volume\s+rm|system\s+prune|image\s+prune|down\s+-v)/i, risk: 'high', reason: 'Docker veri kaybı işlemi' },
  { pattern: /\b(kill|taskkill|Stop-Process|pkill)\b/i, risk: 'high', reason: 'İşlem durdurma' },
  { pattern: /\b(systemctl|sc|net\s+start|net\s+stop|Start-Service|Stop-Service)\b/i, risk: 'high', reason: 'Servis yönetimi' },
  { pattern: />\s*(\/etc\/|\/usr\/|C:\\\\Windows)/i, risk: 'high', reason: 'Sistem dosyasına yazma' },
  // ---- Orta ----
  { pattern: /\b(npm\s+run|pnpm\s+run|yarn\s+run|npx|tsc|vite\s+build|node\s|python\s|py\s|go\s+run|cargo\s+(run|build|test))\b/i, risk: 'medium', reason: 'Kod çalıştırma/derleme' },
  { pattern: /\b(mkdir|md|New-Item|touch|git\s+(init|add|commit|checkout\s+-b|branch|stash))\b/i, risk: 'medium', reason: 'Dosya/depo değişikliği' },
  { pattern: /(^|\s)(>|>>|tee)\s/i, risk: 'medium', reason: 'Dosyaya yönlendirme' },
  { pattern: /\b(cp|copy|mv|move|ren|rename)\b/i, risk: 'medium', reason: 'Dosya kopyalama/taşıma' },
  // ---- Düşük ----
  { pattern: /^\s*(ls|dir|pwd|cd|echo|cat|type|head|tail|wc|find|grep|rg|Select-String|Get-ChildItem|Get-Content|Get-Location|where|which|node\s+-v|npm\s+-v|git\s+(status|log|diff|show|branch))\b/i, risk: 'low', reason: 'Salt okunur işlem' },
];

const SHELL_SEPARATORS = /(&&|\|\||\||;|&\s*$)/;

export function analyzeCommand(command: string): CommandAnalysis {
  const trimmed = command.trim();
  if (!trimmed) {
    return { command, risk: 'low', requiresApproval: false, reasons: ['Boş komut'], matches: [] };
  }

  const reasons: string[] = [];
  const matches: string[] = [];
  let risk: CommandRisk = 'low';

  // Zincirleme komutları ayrı ayrı değerlendir; en yüksek risk kazanır.
  const segments = trimmed.split(SHELL_SEPARATORS).filter((s) => s.trim().length > 0);
  for (const segment of segments) {
    let segmentRisk: CommandRisk = 'low';
    let matched = false;
    for (const rule of RULES) {
      if (rule.pattern.test(segment)) {
        matched = true;
        if (riskRank(rule.risk) > riskRank(segmentRisk)) segmentRisk = rule.risk;
        reasons.push(rule.reason);
        const m = segment.match(rule.pattern);
        if (m?.[0]) matches.push(m[0].slice(0, 80));
      }
    }
    if (!matched) {
      // Tanınmayan komut: bilinmeyen komut orta risk sayılır, çünkü etkisi
      // öngörülemez.
      segmentRisk = 'medium';
      reasons.push('Tanınmayan komut');
    }
    if (riskRank(segmentRisk) > riskRank(risk)) risk = segmentRisk;
  }

  // Boru ile betik çalıştırma kalıbı: parçalara ayırmadan ÖNCE, tüm komut
  // üzerinde değerlendirilmelidir (aksi hâlde `|` ayırıcısı kalıbı böler).
  if (/\b(curl|iwr|Invoke-WebRequest|wget|Invoke-RestMethod|irm)\b[\s\S]*?\|\s*(sh|bash|zsh|powershell|pwsh|iex|Invoke-Expression)\b/i.test(trimmed)) {
    risk = 'critical';
    reasons.push('İnternetten alınan betiğin doğrudan çalıştırılması');
    matches.push(trimmed.slice(0, 80));
  }

  // Tehlikeli kalıp birleşimleri
  if (/\bsudo\b|\bRunAs\b|--no-preserve-root/i.test(trimmed)) {
    risk = 'critical';
    reasons.push('Yükseltilmiş yetki kullanımı');
  }
  if (trimmed.length > 2000) reasons.push('Çok uzun komut');

  return {
    command,
    risk,
    requiresApproval: riskRank(risk) >= riskRank('medium'),
    reasons: [...new Set(reasons)],
    matches: [...new Set(matches)],
  };
}

export function riskRank(risk: CommandRisk): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[risk];
}

export function describeRisk(risk: CommandRisk): string {
  switch (risk) {
    case 'low':
      return 'Düşük risk — salt okunur veya zararsız';
    case 'medium':
      return 'Orta risk — dosya/kod değişikliği';
    case 'high':
      return 'Yüksek risk — veri kaybı veya sistem değişikliği olabilir';
    case 'critical':
      return 'Kritik risk — geri döndürülemez işlem; açık onay gerekir';
  }
}

/** Otomatik onay politikası: ayarlarla birlikte karar verir. */
export function needsApproval(
  analysis: CommandAnalysis,
  policy: { autoApproveRisk: 'none' | 'low' | 'medium'; autoApproveLowRisk: boolean },
): boolean {
  const rank = riskRank(analysis.risk);
  if (policy.autoApproveRisk === 'medium' && rank <= 1) return false;
  if (policy.autoApproveLowRisk && rank === 0) return false;
  return true;
}

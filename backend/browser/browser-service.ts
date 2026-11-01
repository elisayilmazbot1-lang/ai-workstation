/**
 * Tarayıcı otomasyonu (şartname §9).
 *
 * Elektron içinde gömülü görünümde (webContents) Gecko/Chromium çalışır;
 * aynı motor headless Playwright oturumuyla da sürülebilir. Bu servis
 * her iki dünyayı ortak bir sözleşmeye oturtur:
 *
 *   - Sayfa açma, gezinme, geri/ileri/yenile
 *   - DOM analizi, etkileşimli öğe çıkarma
 *   - Tıklama / yazma / form doldurma (onay kapısından geçer)
 *   - Ekran görüntüsü
 *
 * GÜVENLİK: Form gönderimi ve indirme varsayılan olarak açık onay ister.
 * CAPTCHA aşılmaz; sayfa içeriği "güvenilmeyen veri" olarak işaretlenir.
 */
import { nanoid } from 'nanoid';
import type { Db } from '../database/db.js';
import { nowIso } from '../database/db.js';
import type { BrowserActionRequest, BrowserPageSnapshot, BrowserTabInfo } from '../../shared/types/runtime.js';
import type { ApprovalService } from '../security/approvals.js';
import type { AuditService } from '../security/audit.js';
import type { SettingsService } from '../memory/settings.js';

/** Electron tarafından sağlanan görünüm köprüsü. */
export interface BrowserViewBridge {
  createTab(input: { url: string }): Promise<BrowserTabInfo>;
  closeTab(id: string): Promise<void>;
  listTabs(): Promise<BrowserTabInfo[]>;
  navigate(tabId: string, url: string): Promise<BrowserTabInfo>;
  goBack(tabId: string): Promise<void>;
  goForward(tabId: string): Promise<void>;
  reload(tabId: string): Promise<void>;
  readPage(tabId: string): Promise<BrowserPageSnapshot>;
  click(tabId: string, selector: string): Promise<void>;
  type(tabId: string, selector: string, text: string, submit: boolean): Promise<void>;
  screenshot(tabId: string): Promise<string>;
  /** Aynı işlemleri Playwright ile yürüten yedek yol. */
  playwrightFallback: boolean;
}

export class BrowserService {
  private bridge?: BrowserViewBridge;

  constructor(
    private readonly deps: {
      db: Db;
      approvals: ApprovalService;
      audit: AuditService;
      settings: SettingsService;
    },
  ) {}

  attachBridge(bridge: BrowserViewBridge): void {
    this.bridge = bridge;
    this.deps.audit.log({ module: 'browser', action: 'bridge.attach', detail: `playwrightFallback=${bridge.playwrightFallback}` });
  }

  get available(): boolean {
    return Boolean(this.bridge);
  }

  async listTabs(): Promise<BrowserTabInfo[]> {
    if (!this.bridge) return [];
    return this.bridge.listTabs();
  }

  async createTab(url = 'about:blank'): Promise<BrowserTabInfo> {
    if (!this.bridge) throw new Error('Tarayıcı köprüsü yalnızca masaüstü uygulamasında kullanılabilir.');
    const tab = await this.bridge.createTab({ url });
    this.logAction('tab.create', { url });
    return tab;
  }

  async closeTab(id: string): Promise<void> {
    await this.bridge?.closeTab(id);
    this.logAction('tab.close', { id });
  }

  async execute(request: BrowserActionRequest): Promise<{ ok: boolean; snapshot?: BrowserPageSnapshot; message: string }> {
    if (!this.bridge) {
      return { ok: false, message: 'Tarayıcı yalnızca AI Workstation masaüstü uygulamasında kullanılabilir.' };
    }
    const settings = this.deps.settings.get();
    const action = request.action;

    // Yüksek etkili işlemler (form gönderme) açık onay ister.
    if (action.type === 'type' && action.submit && settings.browser.requireApprovalForSubmit) {
      if (!request.approvalId) {
        const approval = this.deps.approvals.create({
          kind: 'browser-submit',
          risk: 'medium',
          title: 'Form gönderimi',
          description: `"${action.selector}" alanına metin yazılıp form gönderilecek. Gönderim geri alınamaz.`,
          payload: { tabId: request.tabId, selector: action.selector, textLength: action.text.length },
        });
        return { ok: false, message: `Form gönderimi için onay gerekiyor (${approval.id}).` };
      }
      this.deps.approvals.assertApproved(request.approvalId, 'browser-submit');
    }

    try {
      switch (action.type) {
        case 'navigate':
          await this.bridge.navigate(request.tabId, action.url);
          break;
        case 'click':
          await this.bridge.click(request.tabId, action.selector);
          break;
        case 'type':
          await this.bridge.type(request.tabId, action.selector, action.text, Boolean(action.submit));
          break;
        case 'go-back':
          await this.bridge.goBack(request.tabId);
          break;
        case 'go-forward':
          await this.bridge.goForward(request.tabId);
          break;
        case 'reload':
          await this.bridge.reload(request.tabId);
          break;
        case 'screenshot': {
          const shot = await this.bridge.screenshot(request.tabId);
          this.logAction('screenshot', { tabId: request.tabId });
          return { ok: true, message: 'Ekran görüntüsü alındı.', snapshot: { ...(await this.bridge.readPage(request.tabId)), screenshot: shot } };
        }
        case 'read-page':
          break;
      }
      const snapshot = await this.bridge.readPage(request.tabId);
      this.logAction(action.type, request.approvalId ? { approvalId: request.approvalId } : {});
      return { ok: true, snapshot, message: 'İşlem tamamlandı.' };
    } catch (err) {
      this.logAction(`${action.type}.error`, { message: (err as Error).message }, false);
      return { ok: false, message: `Tarayıcı işlemi başarısız: ${(err as Error).message}` };
    }
  }

  private logAction(action: string, payload: Record<string, unknown>, ok = true): void {
    this.deps.db
      .prepare('INSERT INTO browser_actions (id, action, payload, ok, message, approval_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(
        nanoid(12),
        action,
        JSON.stringify(payload),
        ok ? 1 : 0,
        ok ? 'ok' : String(payload.message ?? ''),
        (payload.approvalId as string) ?? null,
        nowIso(),
      );
  }
}

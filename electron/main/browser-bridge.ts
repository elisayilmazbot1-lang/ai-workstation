/**
 * Tarayıcı görünümü köprüsü.
 *
 * Gömülü WebContentsView ile gerçek bir tarayıcı paneli sağlar. Servis
 * katmanı bu köprü üzerinden gezinir, sayfa okur ve etkileşim kurar.
 */
import { WebContentsView, type BrowserWindow, type WebContents } from 'electron';
import type { BrowserPageSnapshot, BrowserTabInfo } from '../../shared/types/runtime.js';
import type { BrowserViewBridge } from '../../backend/browser/browser-service.js';
import crypto from 'node:crypto';

interface Tab {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
}

export function createBrowserBridge(getWindow: () => BrowserWindow | null): BrowserViewBridge {
  const tabs = new Map<string, Tab>();
  let activeId: string | null = null;

  const attach = (tab: Tab): void => {
    const win = getWindow();
    if (!win) return;
    // Önceki görünümü kaldır.
    for (const other of tabs.values()) {
      try {
        win.contentView.removeChildView(other.view);
      } catch {
        /* zaten ekli değil */
      }
    }
    // Sağ tarafta panel benzeri alan bırak.
    const size = win.getContentSize();
    const width = size[0] ?? 1280;
    const height = size[1] ?? 800;
    tab.view.setBounds({ x: Math.round(width * 0.32), y: 96, width: Math.round(width * 0.66), height: height - 140 });
    win.contentView.addChildView(tab.view);
    activeId = tab.id;
  };

  const info = (tab: Tab): BrowserTabInfo => ({
    id: tab.id,
    url: tab.view.webContents.getURL(),
    title: tab.view.webContents.getTitle(),
    active: tab.id === activeId,
    canGoBack: tab.view.webContents.navigationHistory?.canGoBack?.() ?? false,
    canGoForward: tab.view.webContents.navigationHistory?.canGoForward?.() ?? false,
    loading: tab.view.webContents.isLoading(),
  });

  const waitForLoad = (contents: WebContents): Promise<void> =>
    new Promise((resolve) => {
      if (!contents.isLoading()) return resolve();
      const done = () => {
        contents.off('did-finish-load', done);
        contents.off('did-fail-load', done);
        resolve();
      };
      contents.once('did-finish-load', done);
      contents.once('did-fail-load', done);
      setTimeout(done, 20_000);
    });

  return {
    playwrightFallback: false,

    async createTab({ url }) {
      const win = getWindow();
      if (!win) throw new Error('Ana pencere bulunamadı.');
      const view = new WebContentsView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          javascript: true,
          partition: 'persist:browser', // oturum kalıcı, ayrı bölüm
        },
      });
      const id = crypto.randomUUID();
      const tab: Tab = { id, view, url, title: url };
      tabs.set(id, tab);
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      await view.webContents.loadURL(url === 'about:blank' ? 'about:blank' : url);
      attach(tab);
      return info(tab);
    },

    async closeTab(id) {
      const tab = tabs.get(id);
      if (!tab) return;
      const win = getWindow();
      try {
        win?.contentView.removeChildView(tab.view);
      } catch {
        /* yoksay */
      }
      tab.view.webContents.close();
      tabs.delete(id);
      if (activeId === id) activeId = null;
    },

    async listTabs() {
      return [...tabs.values()].map(info);
    },

    async navigate(tabId, url) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Sekme bulunamadı.');
      if (!/^(https?|about):/i.test(url)) throw new Error('Yalnızca http, https ve about adresleri açılabilir.');
      await tab.view.webContents.loadURL(url);
      attach(tab);
      return info(tab);
    },

    async goBack(tabId) {
      const tab = tabs.get(tabId);
      if (tab && tab.view.webContents.navigationHistory?.canGoBack()) tab.view.webContents.navigationHistory.goBack();
    },
    async goForward(tabId) {
      const tab = tabs.get(tabId);
      if (tab && tab.view.webContents.navigationHistory?.canGoForward()) tab.view.webContents.navigationHistory.goForward();
    },
    async reload(tabId) {
      tabs.get(tabId)?.view.webContents.reload();
    },

    async readPage(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Sekme bulunamadı.');
      await waitForLoad(tab.view.webContents);
      const snapshot = (await tab.view.webContents.executeJavaScript(`(() => {
        const interactive = [];
        const selector = 'a,button,input,select,textarea,[role=button],[onclick]';
        document.querySelectorAll(selector).forEach((el, index) => {
          const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 80);
          let path = el.tagName.toLowerCase();
          if (el.id) path += '#' + el.id;
          else if (el.className && typeof el.className === 'string') path += '.' + el.className.split(/\\s+/).slice(0,2).join('.');
          interactive.push({ selector: path, tag: el.tagName.toLowerCase(), text, role: el.getAttribute('role') || undefined, index });
        });
        const forms = Array.from(document.forms).map((f) => ({
          action: f.action || '',
          fields: Array.from(f.elements).filter((e) => e.name).map((e) => ({ name: e.name, type: e.type, label: e.getAttribute('placeholder') || undefined })),
        }));
        return {
          url: location.href,
          title: document.title,
          text: (document.body ? document.body.innerText : '').slice(0, 20000),
          links: Array.from(document.querySelectorAll('a[href]')).slice(0, 120).map((a) => ({ text: (a.innerText||'').trim().slice(0,80), href: a.href })),
          forms,
          interactiveElements: interactive.slice(0, 200),
        };
      })()`)) as Omit<BrowserPageSnapshot, 'screenshot'>;
      return { ...snapshot, interactiveElements: snapshot.interactiveElements.map((el, i) => ({ ...el, selector: el.selector || `:nth-child(${i + 1})` })) };
    },

    async click(tabId, selector) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Sekme bulunamadı.');
      const clicked = (await tab.view.webContents.executeJavaScript(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({ block: 'center' });
        el.click();
        return true;
      })()`)) as boolean;
      if (!clicked) throw new Error(`Öğe bulunamadı: ${selector}`);
    },

    async type(tabId, selector, text, submit) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Sekme bulunamadı.');
      const ok = (await tab.view.webContents.executeJavaScript(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.focus();
        el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        ${submit ? "const form = el.form; if (form) form.requestSubmit();" : ''}
        return true;
      })()`)) as boolean;
      if (!ok) throw new Error(`Alan bulunamadı: ${selector}`);
    },

    async screenshot(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error('Sekme bulunamadı.');
      const image = await tab.view.webContents.capturePage();
      return `data:image/png;base64,${image.toPNG().toString('base64')}`;
    },
  };
}

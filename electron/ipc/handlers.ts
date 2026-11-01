/**
 * IPC işleyicileri.
 *
 * Arayüz → ana süreç → yerel servis köprüsü. Yalnızca beyaz listedeki
 * kanallar açıktır. Tüm istekler ana süreçte yeniden doğrulanır.
 */
import type { IpcMain, BrowserWindow } from 'electron';
import type { Container } from '../../backend/server/container.js';
import { eventBus, type AppEvent } from '../../backend/orchestration/events.js';

interface Deps {
  ipcMain: IpcMain;
  getBackendUrl: () => string;
  getContainer: () => Container;
  getWindow: () => BrowserWindow | null;
}

export function registerIpcHandlers({ ipcMain, getBackendUrl, getContainer, getWindow }: Deps): void {
  ipcMain.handle('aw:http', async (_event, request: { method: string; path: string; body?: unknown; query?: Record<string, string> }) => {
    const base = getBackendUrl();
    const url = new URL(request.path, base);
    if (request.query) for (const [k, v] of Object.entries(request.query)) url.searchParams.set(k, v);
    // Köprü yalnızca kendi yerel servisimize gider; SSRF riski yok.
    if (url.origin !== base) throw new Error('Yalnızca yerel servise istek yapılabilir.');

    const response = await fetch(url, {
      method: request.method,
      headers: request.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: response.status, body };
  });


  /**
   * Akışlı (SSE) istek köprüsü.
   *
   * NEDEN: Üretim derlemesinde arayüz `file://` şemasından yüklenir
   * (electron/main/index.ts:99). `fetch('/api/chat/stream')` bu şemada
   * `file:///api/chat/stream` anlamına gelir ve hiçbir sunucuya ulaşmaz;
   * sohbet yanıtı arayüze hiç gelmez. Bu kanal, akışı ana süreçteki fetch'e
   * yönlendirir ve parçaları olay olarak pencereye iletir.
   *
   * Üçüncü denetimde tespit edildi: arayüzden gönderilen mesaj yanıtsız kalıyordu.
   */
  ipcMain.handle('aw:stream', async (event, request: { path: string; body?: unknown }) => {
    const base = getBackendUrl();
    const url = new URL(request.path, base);
    if (url.origin !== base) throw new Error('Yalnızca yerel servise istek yapılabilir.');
    if (!/^\/api\//.test(request.path)) throw new Error('İzin verilmeyen yol.');

    const response = await fetch(url.href, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(request.body ?? {}),
    });
    if (!response.ok || !response.body) {
      return { status: response.status, ok: false };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const sender = event.sender;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index = buffer.indexOf('\n\n');
        while (index >= 0) {
          const chunk = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            if (!sender.isDestroyed()) sender.send('aw:stream-chunk', payload);
          }
          index = buffer.indexOf('\n\n');
        }
      }
    } finally {
      if (!sender.isDestroyed()) sender.send('aw:stream-end');
    }
    return { status: response.status, ok: true };
  });

  // Canlı olayları pencereye ilet.
  eventBus.subscribe((event: AppEvent) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('aw:event', event);
  });

  // Acil durdurma kısayolu (global).
  ipcMain.handle('aw:emergency-stop', async () => getContainer().orchestrator.emergencyStop());
  ipcMain.handle('aw:emergency-resume', async () => getContainer().orchestrator.resumeEmergency());

  // Uygulama bilgileri
  ipcMain.handle('aw:info', async () => ({
    version: getContainer().version,
    dataDir: getContainer().dataDir,
    platform: process.platform,
    backendUrl: getBackendUrl(),
  }));

  // Pencere kontrolleri (başlık çubuğu özel çizilirse)
  ipcMain.handle('aw:window', async (_e, action: 'minimize' | 'maximize' | 'close') => {
    const win = getWindow();
    if (!win) return false;
    if (action === 'minimize') win.minimize();
    else if (action === 'maximize') (win.isMaximized() ? win.unmaximize() : win.maximize());
    else win.close();
    return true;
  });
}

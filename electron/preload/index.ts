/**
 * Preload köprüsü.
 *
 * Arayüze yalnızca dar ve denetlenmiş bir API açılır:
 *  - invoke: yerel servise HTTP isteği (yalnızca /api yolları)
 *  - onEvent: canlı olay akışı
 *  - platform/versions bilgisi
 *
 * Hiçbir Node modülü, dosya sistemi veya shell erişimi doğrudan verilmez.
 */
import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_PATH = /^\/api\/[a-zA-Z0-9\-_/:.?=&%]*$/;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

contextBridge.exposeInMainWorld('aiWorkstation', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? '',
  },
  safeStorageAvailable: true,

  invoke: async (request: { method: string; path: string; body?: unknown; query?: Record<string, string> }) => {
    if (!ALLOWED_METHODS.has(request.method)) throw new Error('İzin verilmeyen HTTP yöntemi.');
    if (typeof request.path !== 'string' || !ALLOWED_PATH.test(request.path)) throw new Error('İzin verilmeyen yol.');
    return ipcRenderer.invoke('aw:http', {
      method: request.method,
      path: request.path,
      body: request.body,
      query: request.query,
    });
  },

  /**
   * Akışlı istek: SSE parçaları `onChunk`, akış bitince `onEnd` ile gelir.
   * `file://` üzerinde göreli `fetch` çalışmadığı için sohbet akışı buradan
   * geçer (bkz. electron/ipc/handlers.ts `aw:stream`).
   */
  stream: async (
    request: { path: string; body?: unknown },
    onChunk: (raw: string) => void,
    onEnd: () => void,
  ): Promise<{ status: number; ok: boolean }> => {
    const chunkListener = (_e: unknown, payload: string) => onChunk(payload);
    const endListener = () => {
      ipcRenderer.removeListener('aw:stream-chunk', chunkListener);
      ipcRenderer.removeListener('aw:stream-end', endListener);
      onEnd();
    };
    ipcRenderer.on('aw:stream-chunk', chunkListener);
    ipcRenderer.on('aw:stream-end', endListener);
    return ipcRenderer.invoke('aw:stream', request);
  },

  onEvent: (callback: (event: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on('aw:event', listener);
    return () => ipcRenderer.removeListener('aw:event', listener);
  },
});

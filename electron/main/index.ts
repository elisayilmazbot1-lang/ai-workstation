/**
 * Electron ana süreç.
 *
 * Görevleri:
 *  - Yerel Fastify servisini başlatmak (127.0.0.1, rastgele boş port)
 *  - Güvenli pencere oluşturmak (contextIsolation açık, nodeIntegration kapalı)
 *  - IPC üzerinden HTTP köprüsü ve canlı olay akışı sağlamak
 *  - Tarayıcı görünümünü (webContents) servise bağlamak
 *  - Acil durdurma kısayolunu global olarak dinlemek
 */
import { app, BrowserWindow, ipcMain, shell, safeStorage, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContainer, type Container } from '../../backend/server/container.js';
import { buildApp } from '../../backend/server/app.js';
import { attachBrowserBridge } from '../../backend/server/runtimeBridge.js';
import { createBrowserBridge } from './browser-bridge.js';
import { registerIpcHandlers } from '../ipc/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let container: Container | null = null;
let backendUrl = '';

async function startBackend(): Promise<{ url: string; container: Container }> {
  const safe = safeStorage.isEncryptionAvailable()
    ? {
        available: () => true,
        encrypt: (plain: string) => safeStorage.encryptString(plain),
        decrypt: (payload: Buffer) => safeStorage.decryptString(payload),
      }
    : undefined;

  const c = createContainer({ safeStorage: safe });
  const server = await buildApp(c);
  await server.listen({ port: 0, host: '127.0.0.1' });
  const address = server.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;

  c.audit.log({
    module: 'electron',
    action: 'backend.start',
    detail: `${url} · safeStorage=${Boolean(safe)}`,
    risk: 'low',
  });

  app.on('before-quit', () => {
    void server.close().catch(() => undefined);
    c.close();
  });

  return { url, container: c };
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: '#07090f',
    title: 'AI Workstation',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // preload yalnızca contextBridge+ipcRenderer kullanır (CJS)
      webSecurity: true,
      spellcheck: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Dış bağlantılar sistem tarayıcısında açılır; uygulama penceresi ele geçirilemez.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowedPattern = isDev ? /^http:\/\/(localhost|127\.0\.0\.1):\d+/ : /^file:\/\//;
    if (!allowedPattern.test(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  // GELİŞTİRME ADRESİ — iki ortam değişkeni de kabul edilir.
  //
  // `electron-vite dev`, renderer dev sunucusunun adresini standart olarak
  // ELECTRON_RENDERER_URL değişkenine yazar. Bu dosya bir zamanlar yalnızca
  // AW_RENDERER_URL okuyordu; o değişkeni hiçbir araç yayınlamadığı için
  // geliştirme her zaman `dist/index.html`'e düşüyordu. `out/` ve `dist/`
  // depoda izlenmediği için temiz klonda pencere BOŞ açılıyordu.
  // AW_RENDERER_URL, adresi elle vermek isteyenler için korunuyor.
  const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? process.env.AW_RENDERER_URL;

  if (isDev && rendererUrl) {
    void win.loadURL(rendererUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  return win;
}

app.whenReady().then(async () => {
  // İndirme klasörü ve izin politikası
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'clipboard-read', 'clipboard-sanitized-write', 'notifications'];
    callback(allowed.includes(permission));
  });

  const started = await startBackend();
  container = started.container;
  backendUrl = started.url;

  registerIpcHandlers({
    ipcMain,
    getBackendUrl: () => backendUrl,
    getContainer: () => container!,
    getWindow: () => mainWindow,
  });

  mainWindow = createWindow();
  attachBrowserBridge(container, createBrowserBridge(() => mainWindow));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Tek örnek kilidi: ikinci kez açılırsa mevcut pencere öne gelir.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

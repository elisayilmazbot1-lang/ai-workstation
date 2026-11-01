/**
 * Electron köprüsü kayıt noktası.
 *
 * Yerel servis tek başına çalışırken (tarayıcı önizlemesi) tarayıcı modülü
 * devre dışı kalır. Masaüstü uygulaması açılırken `attachBrowserBridge`
 * çağrılarak gerçek webContents görünümü bağlanır.
 */
import type { BrowserViewBridge } from '../browser/browser-service.js';
import type { Container } from './container.js';

let attached = false;

export function attachBrowserBridge(container: Container, bridge: BrowserViewBridge): void {
  container.browser.attachBridge(bridge);
  attached = true;
}

export function isBrowserBridgeAttached(): boolean {
  return attached;
}

export function killBrowserAttach(): void {
  attached = false;
}

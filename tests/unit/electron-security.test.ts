/**
 * Masaüstü kabuğu güvenlik yapılandırması.
 *
 * Bu testler kaynak dosyaları okuyarak kritik güvenlik ayarlarının
 * kaldırılmadığını doğrular (regresyon koruması).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

describe('Electron güvenlik yapılandırması', () => {
  const main = read('electron/main/index.ts');

  it('contextIsolation açık, nodeIntegration kapalı', () => {
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/nodeIntegration:\s*false/);
  });

  it('webSecurity kapatılmamış', () => {
    expect(main).toMatch(/webSecurity:\s*true/);
    expect(main).not.toMatch(/webSecurity:\s*false/);
  });

  it('sandbox açık ve preload CJS olarak yükleniyor', () => {
    expect(main).toMatch(/sandbox:\s*true/);
    expect(main).not.toMatch(/sandbox:\s*false/);
    expect(main).toMatch(/preload\/index\.cjs/);
  });

  it('izin istekleri beyaz listeye göre yanıtlanır', () => {
    expect(main).toMatch(/setPermissionRequestHandler/);
    expect(main).toMatch(/media/);
  });

  it('yeni pencere açma engellenir, dış bağlantı tarayıcıya yönlendirilir', () => {
    expect(main).toMatch(/setWindowOpenHandler/);
    expect(main).toMatch(/shell\.openExternal|openExternal/);
  });

  it('navigasyon yalnızca izinli kaynaklara yapılır', () => {
    expect(main).toMatch(/will-navigate/);
    expect(main).toMatch(/allowedPattern|allowed/);
  });

  it('tek örnek kilidi vardır', () => {
    expect(main).toMatch(/requestSingleInstanceLock/);
  });
});

describe('Preload köprüsü', () => {
  const preload = read('electron/preload/index.ts');

  it('yalnızca /api yollarına izin verir', () => {
    expect(preload).toMatch(/ALLOWED_PATH/);
    expect(preload).toMatch(/\^\\\/api\\\//);
  });

  it('HTTP yöntemlerini beyaz listeye göre sınırlar', () => {
    expect(preload).toMatch(/ALLOWED_METHODS/);
    expect(preload).toMatch(/GET.*POST.*PATCH.*DELETE/);
  });

  it('dosya sistemi veya shell erişimi açmaz', () => {
    expect(preload).not.toMatch(/require\(['"]fs['"]\)/);
    expect(preload).not.toMatch(/child_process/);
    expect(preload).not.toMatch(/exposeInMainWorld\(['"]require/);
  });
});

describe('İçerik Güvenliği Politikası (CSP)', () => {
  const html = read('index.html');

  it('default-src self ile sınırlı', () => {
    expect(html).toMatch(/default-src 'self'/);
  });

  it('connect-src yalnızca yerel servise izin verir', () => {
    const csp = /content="([^"]*connect-src[^"]*)"/.exec(html)?.[1] ?? '';
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('https://*');
    expect(csp).not.toMatch(/connect-src[^;]*\bhttps:\/\/[a-z]/);
  });

  it('eval kullanımına izin verilmez', () => {
    expect(html).not.toMatch(/script-src[^;]*unsafe-eval/);
  });
});

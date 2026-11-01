/**
 * Kimlik bilgisi kasası.
 *
 * Şartname §14.3: API anahtarları asla düz metin olarak veritabanına,
 * günlüklere veya arayüze yazılmaz.
 *
 * İki uygulama yolu:
 *  1. Electron ortamında  -> `safeStorage` (Windows DPAPI) ile şifrelenir.
 *  2. Servis bağımsız çalışırken -> AES-256-GCM + kullanıcı profilinde
 *     yalnızca o kullanıcının okuyabildiği (0600) anahtar dosyası.
 *
 * Anahtarın kendisi hiçbir zaman yedeklere dahil edilmez.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface SecretStoreOptions {
  /** Şifreli kayıtların tutulduğu dosya. */
  secretsPath: string;
  /** Harici şifreleyici (Electron safeStorage). Yoksa AES-256-GCM kullanılır. */
  encryptor?: {
    encrypt(plain: string): Buffer;
    decrypt(payload: Buffer): string;
    available(): boolean;
  };
}

interface SecretFileShape {
  version: 1;
  cipher: 'safeStorage' | 'aes-256-gcm';
  entries: Record<string, { data: string; updatedAt: string }>;
}

const KEY_FILE_NAME = 'vault.key';

export class SecretStore {
  private readonly secretsPath: string;
  private readonly encryptor?: SecretStoreOptions['encryptor'];
  private entries = new Map<string, { data: string; updatedAt: string }>();
  private cipher: SecretFileShape['cipher'];
  private masterKey?: Buffer;
  private loaded = false;

  constructor(options: SecretStoreOptions) {
    this.secretsPath = options.secretsPath;
    this.encryptor = options.encryptor;
    fs.mkdirSync(path.dirname(this.secretsPath), { recursive: true });
    const useSafe = Boolean(options.encryptor?.available());
    this.cipher = useSafe ? 'safeStorage' : 'aes-256-gcm';
    if (!useSafe) this.masterKey = this.loadOrCreateMasterKey();
  }

  private loadOrCreateMasterKey(): Buffer {
    const keyPath = path.join(path.dirname(this.secretsPath), KEY_FILE_NAME);
    if (fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, 'utf8').trim();
      const key = Buffer.from(raw, 'base64');
      if (key.length === 32) return key;
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 });
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      /* Windows'ta chmod sınırlı; ACL devralınır */
    }
    return key;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!fs.existsSync(this.secretsPath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.secretsPath, 'utf8')) as SecretFileShape;
      if (parsed.cipher === this.cipher) {
        for (const [key, value] of Object.entries(parsed.entries ?? {})) {
          this.entries.set(key, value);
        }
      }
    } catch {
      // Bozuk kasa: içeriği karantinaya al, boş başla. Anahtar kaybı varsa
      // kullanıcıya arayüzde "yeniden girin" uyarısı gösterilir.
      const quarantine = `${this.secretsPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(this.secretsPath, quarantine);
      } catch {
        /* yoksay */
      }
    }
  }

  private persist(): void {
    const shape: SecretFileShape = {
      version: 1,
      cipher: this.cipher,
      entries: Object.fromEntries(this.entries),
    };
    const tmp = `${this.secretsPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(shape), { mode: 0o600 });
    fs.renameSync(tmp, this.secretsPath);
  }

  private encryptValue(plain: string): string {
    if (this.cipher === 'safeStorage' && this.encryptor) {
      return this.encryptor.encrypt(plain).toString('base64');
    }
    const key = this.masterKey!;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  private decryptValue(payload: string): string {
    if (this.cipher === 'safeStorage' && this.encryptor) {
      return this.encryptor.decrypt(Buffer.from(payload, 'base64'));
    }
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey!, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  set(key: string, value: string): void {
    this.ensureLoaded();
    this.entries.set(key, { data: this.encryptValue(value), updatedAt: new Date().toISOString() });
    this.persist();
  }

  get(key: string): string | undefined {
    this.ensureLoaded();
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    try {
      return this.decryptValue(entry.data);
    } catch {
      return undefined;
    }
  }

  has(key: string): boolean {
    this.ensureLoaded();
    return this.entries.has(key);
  }

  delete(key: string): boolean {
    this.ensureLoaded();
    const existed = this.entries.delete(key);
    if (existed) this.persist();
    return existed;
  }

  listKeys(): string[] {
    this.ensureLoaded();
    return [...this.entries.keys()];
  }

  /** Arayüzde gösterilecek güvenli özet: "sk-…9f2a" gibi. */
  maskedPreview(key: string): string | undefined {
    const value = this.get(key);
    if (!value) return undefined;
    if (value.length <= 8) return '••••';
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
  }

  /** Anahtar kaynağını değiştirmeden tüm kayıtları yeniden şifreler. */
  rotate(): number {
    this.ensureLoaded();
    if (this.cipher === 'aes-256-gcm') {
      const keyPath = path.join(path.dirname(this.secretsPath), KEY_FILE_NAME);
      const values = new Map<string, string>();
      for (const key of this.entries.keys()) {
        const v = this.get(key);
        if (v !== undefined) values.set(key, v);
      }
      this.masterKey = crypto.randomBytes(32);
      fs.writeFileSync(keyPath, this.masterKey.toString('base64'), { mode: 0o600 });
      for (const [key, value] of values) this.entries.set(key, { data: this.encryptValue(value), updatedAt: new Date().toISOString() });
      this.persist();
    }
    return this.entries.size;
  }
}

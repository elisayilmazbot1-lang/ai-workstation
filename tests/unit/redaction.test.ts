import { describe, expect, it } from 'vitest';
import { containsSecret, redact, redactDeep } from '../../backend/security/redaction.js';

describe('Gizli bilgi maskeleme', () => {
  it('OpenAI benzeri anahtarları maskeler', () => {
    const text = 'Anahtar: sk-abcdef1234567890ABCDEF';
    expect(redact(text)).not.toContain('abcdef1234567890');
    expect(redact(text)).toContain('REDACTED');
  });

  it('Google ve Anthropic anahtarlarını maskeler', () => {
    expect(redact('AIzaSyA1234567890abcdefghijklmnopqrstu')).toContain('REDACTED');
    expect(redact('sk-ant-api03-abcdefghijklmnopqrst')).toContain('REDACTED');
  });

  it('api_key= ifadesini maskeler', () => {
    expect(redact('api_key="supergizli123456"')).toBe('api_key= ***REDACTED***');
  });

  it('iç içe nesneleri maskeler', () => {
    const input = { provider: { apiKey: 'sk-1234567890abcdefgh', name: 'x' }, list: [{ password: 'gizli' }] };
    const out = redactDeep(input);
    expect(out.provider.apiKey).toBe('***REDACTED***');
    expect(out.list[0]?.password).toBe('***REDACTED***');
    expect(out.provider.name).toBe('x');
  });

  it('sızıntı tespiti çalışır', () => {
    expect(containsSecret('metin sk-supersecret1234', 'sk-supersecret1234')).toBe(true);
    expect(containsSecret('temiz metin', 'sk-supersecret1234')).toBe(false);
  });
});

describe('Maskeleme hassasiyeti', () => {
  it('ölçüm alanlarını (tokens) maskelemez', () => {
    const out = redactDeep({ tokens: { today: { inputTokens: 5 } }, inputTokens: 7 });
    expect(out.tokens.today.inputTokens).toBe(5);
    expect(out.inputTokens).toBe(7);
  });

  it('kimlik bilgisi alanlarını maskeler', () => {
    const out = redactDeep({ apiKey: 'x', access_token: 'y', refreshToken: 'z', credential: 'w' });
    expect(out.apiKey).toBe('***REDACTED***');
    expect(out.access_token).toBe('***REDACTED***');
    expect(out.refreshToken).toBe('***REDACTED***');
    expect(out.credential).toBe('***REDACTED***');
  });
});

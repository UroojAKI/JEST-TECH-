import { EncryptionUtil } from './encryption.util';

describe('EncryptionUtil', () => {
  const originalEnv = process.env.PII_ENCRYPTION_KEY;
  beforeAll(() => { process.env.PII_ENCRYPTION_KEY = 'unit_test_pii_encryption_key_32_chars_minimum'; });
  afterAll(() => {
    if (originalEnv === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = originalEnv;
  });

  it('encrypts and decrypts PAN without changing its value', () => {
    const encrypted = EncryptionUtil.encryptIfNeeded('ABCDE1234F') as string;
    expect(encrypted).not.toBe('ABCDE1234F');
    expect(EncryptionUtil.isEncrypted(encrypted)).toBe(true);
    expect(EncryptionUtil.decryptIfEncrypted(encrypted)).toBe('ABCDE1234F');
  });

  it('is idempotent for already encrypted values', () => {
    const encrypted = EncryptionUtil.encrypt('123456789012');
    expect(EncryptionUtil.encryptIfNeeded(encrypted)).toBe(encrypted);
  });

  it('produces a stable keyed PAN blind index', () => {
    const first = EncryptionUtil.hashPan('ABCDE1234F');
    const second = EncryptionUtil.hashPan(' abcde1234f ');
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('ABCDE1234F');
  });

  it('masks encrypted PAN and Aadhaar after decryption', () => {
    expect(EncryptionUtil.maskPan(EncryptionUtil.encrypt('ABCDE1234F'))).toBe('XXXXX1234F');
    expect(EncryptionUtil.maskAadhaar(EncryptionUtil.encrypt('123456789012'))).toBe('XXXX-XXXX-9012');
  });
});

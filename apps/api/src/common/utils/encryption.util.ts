import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_TEST_KEY = 'jest_test_pii_key_32_chars_minimum_length_required';

function getPiiKey(): string {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[SECURITY] PII_ENCRYPTION_KEY environment variable is required and must be at least 32 characters in production.');
    }
    return DEFAULT_TEST_KEY;
  }
  return key;
}

const IV_LENGTH = 12;
const SALT_LENGTH = 16;

export class EncryptionUtil {
  static isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    const parts = value.split(':');
    if (parts.length === 4) return /^[0-9a-f]{32}$/i.test(parts[0]) && /^[0-9a-f]{24}$/i.test(parts[1]) && /^[0-9a-f]{32}$/i.test(parts[2]) && /^[0-9a-f]*$/i.test(parts[3]);
    return parts.length === 3 && /^[0-9a-f]{24}$/i.test(parts[0]) && /^[0-9a-f]{32}$/i.test(parts[1]) && /^[0-9a-f]*$/i.test(parts[2]);
  }

  static encrypt(text: string): string {
    if (!text) return text;
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = crypto.scryptSync(getPiiKey(), salt, 32);
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e: any) {
      throw new Error(`[SECURITY] PII encryption failed: ${e.message}`);
    }
  }

  static encryptIfNeeded(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    return this.isEncrypted(value) ? value : this.encrypt(value);
  }

  static decrypt(value: string): string {
    if (!value || !this.isEncrypted(value)) return value;
    const parts = value.split(':');
    try {
      const legacy = parts.length === 3;
      const salt = legacy ? Buffer.from('salt') : Buffer.from(parts[0], 'hex');
      const iv = Buffer.from(legacy ? parts[0] : parts[1], 'hex');
      const authTag = Buffer.from(legacy ? parts[1] : parts[2], 'hex');
      const encrypted = legacy ? parts[2] : parts[3];
      const key = crypto.scryptSync(getPiiKey(), salt, 32);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let plain = decipher.update(encrypted, 'hex', 'utf8');
      plain += decipher.final('utf8');
      return plain;
    } catch (e: any) {
      throw new Error(`[SECURITY] PII decryption failed; verify PII_ENCRYPTION_KEY and ciphertext integrity: ${e.message}`);
    }
  }

  static decryptIfEncrypted(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    return this.isEncrypted(value) ? this.decrypt(value) : value;
  }

  static hashPan(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = String(this.decryptIfEncrypted(value)).trim().toUpperCase();
    const key = crypto.createHmac('sha256', getPiiKey()).update('jest:pan-index:v1').digest();
    return crypto.createHmac('sha256', key).update(normalized).digest('hex');
  }

  static maskAadhaar(value: string | null | undefined): string | null {
    if (!value) return null;
    const clean = String(this.decryptIfEncrypted(value)).replace(/\\D/g, '');
    if (clean.length < 4) return 'XXXX-XXXX-XXXX';
    return `XXXX-XXXX-${clean.slice(-4)}`;
  }

  static maskPan(value: string | null | undefined): string | null {
    if (!value) return null;
    const clean = String(this.decryptIfEncrypted(value)).trim().toUpperCase();
    if (clean.length < 10) return 'XXXXX-XXXX';
    return `XXXXX${clean.slice(5, 9)}${clean.slice(9)}`;
  }
}
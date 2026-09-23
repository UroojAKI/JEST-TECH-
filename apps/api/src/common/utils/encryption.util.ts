import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_TEST_KEY = 'jest_test_pii_key_32_chars_minimum_length_required';

function getPiiKey(): string {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY] PII_ENCRYPTION_KEY environment variable is required and must be at least 32 characters in production.',
      );
    }
    return DEFAULT_TEST_KEY;
  }
  return key;
}

const IV_LENGTH = 12;
const SALT_LENGTH = 16;

export class EncryptionUtil {
  /**
   * Encrypts sensitive PII string using AES-256-GCM with dynamic salt.
   * Fails closed: throws Error on failure (F-026).
   */
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

  /**
   * Decrypts sensitive PII string with backwards compatibility for 4-part
   * dynamic-salt and legacy 3-part ciphertexts.
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    const parts = encryptedText.split(':');
    try {
      let salt: Buffer;
      let iv: Buffer;
      let authTag: Buffer;
      let encrypted: string;

      if (parts.length === 4) {
        salt = Buffer.from(parts[0], 'hex');
        iv = Buffer.from(parts[1], 'hex');
        authTag = Buffer.from(parts[2], 'hex');
        encrypted = parts[3];
      } else if (parts.length === 3) {
        salt = Buffer.from('salt');
        iv = Buffer.from(parts[0], 'hex');
        authTag = Buffer.from(parts[1], 'hex');
        encrypted = parts[2];
      } else {
        return encryptedText;
      }

      const key = crypto.scryptSync(getPiiKey(), salt, 32);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encryptedText;
    }
  }

  /**
   * Masks Aadhaar number to expose only last 4 digits (e.g. XXXX-XXXX-9012)
   */
  static maskAadhaar(aadhaar: string | null | undefined): string | null {
    if (!aadhaar) return null;
    const clean = aadhaar.replace(/\D/g, '');
    if (clean.length < 4) return 'XXXX-XXXX-XXXX';
    const last4 = clean.slice(-4);
    return `XXXX-XXXX-${last4}`;
  }

  /**
   * Masks PAN number to expose only last 4 chars (e.g. XXXXX1234F)
   */
  static maskPan(pan: string | null | undefined): string | null {
    if (!pan) return null;
    const clean = pan.trim().toUpperCase();
    if (clean.length < 10) return 'XXXXX-XXXX';
    const first5Masked = 'XXXXX';
    const middle4 = clean.slice(5, 9);
    const lastChar = clean.slice(9);
    return `${first5Masked}${middle4}${lastChar}`;
  }
}

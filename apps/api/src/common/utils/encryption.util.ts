import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.PII_ENCRYPTION_KEY || 'jest-crm-production-pii-secret-32b'; // 32-byte key fallback
const IV_LENGTH = 12;

export class EncryptionUtil {
  /**
   * Encrypts sensitive PII string using AES-256-GCM
   */
  static encrypt(text: string): string {
    if (!text) return text;
    try {
      const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e) {
      return text;
    }
  }

  /**
   * Decrypts sensitive PII string
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    try {
      const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
      const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
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

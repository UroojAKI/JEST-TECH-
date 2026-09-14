import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY =
  process.env.PII_ENCRYPTION_KEY || 'jest-policy-crm-pii-secret-key-32b!'; // Must be 32 bytes

export class PiiCryptoUtil {
  /**
   * Encrypts a sensitive string (PAN, Aadhaar, Bank AC) using AES-256-GCM.
   */
  static encrypt(text: string | null | undefined): string | null {
    if (!text) return null;
    try {
      const iv = crypto.randomBytes(12);
      const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${tag}:${encrypted}`;
    } catch {
      return text; // Fallback to raw text if key derivation fails
    }
  }

  /**
   * Decrypts an AES-256-GCM encrypted string.
   */
  static decrypt(encryptedText: string | null | undefined): string | null {
    if (!encryptedText) return null;
    if (!encryptedText.includes(':')) return encryptedText; // Plaintext fallback
    try {
      const [ivHex, tagHex, encrypted] = encryptedText.split(':');
      if (!ivHex || !tagHex || !encrypted) return encryptedText;
      const key = crypto.scryptSync(SECRET_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encryptedText;
    }
  }

  /**
   * Masks a PAN Number (e.g. ABCDE1234F -> ABCXX1234F)
   */
  static maskPan(pan: string | null | undefined): string | null {
    if (!pan) return null;
    const clean = pan.trim();
    if (clean.length < 10) return 'XXXXX' + clean.slice(-4);
    return `${clean.slice(0, 3)}XX${clean.slice(5, 9)}${clean.slice(9)}`;
  }

  /**
   * Masks an Aadhaar Number (e.g. 123456789012 -> XXXX-XXXX-9012)
   */
  static maskAadhaar(aadhaar: string | null | undefined): string | null {
    if (!aadhaar) return null;
    const clean = aadhaar.replace(/\D/g, '');
    if (clean.length < 12) return 'XXXX-XXXX-' + clean.slice(-4);
    return `XXXX-XXXX-${clean.slice(-4)}`;
  }
}

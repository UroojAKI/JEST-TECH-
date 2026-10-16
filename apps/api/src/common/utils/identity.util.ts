import { randomBytes } from 'crypto';

/**
 * Universal Identity & UID Utility for JEST Policy CRM.
 * Implements RFC 9562 UUIDv7 generation, validation, and timestamp extraction.
 */
export class IdentityUtil {
  /**
   * Generates an RFC 9562 compliant UUIDv7 identifier.
   * Format: 36-character lowercase hexadecimal string with hyphens:
   * e.g. 018f3a5e-7b2c-7a91-8d4e-123456789abc
   *
   * Structure:
   * - 48 bits: unix timestamp in milliseconds
   * - 4 bits: version (7)
   * - 12 bits: random sequence
   * - 2 bits: variant (10xx)
   * - 62 bits: random
   */
  static generateEntityId(timestampMs = Date.now()): string {
    const value = Buffer.alloc(16);

    // 48-bit timestamp (Big-endian)
    value.writeUInt16BE(Math.floor(timestampMs / 0x100000000), 0);
    value.writeUInt32BE(timestampMs % 0x100000000, 2);

    // 10 random bytes
    const random = randomBytes(10);
    random.copy(value, 6);

    // Version 7: Set bits 4-7 of byte 6 to 0111 (0x70)
    value[6] = (value[6] & 0x0f) | 0x70;

    // Variant RFC 4122 / 9562: Set bits 6-7 of byte 8 to 10 (0x80)
    value[8] = (value[8] & 0x3f) | 0x80;

    const hex = value.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  /**
   * Validates whether a string conforms to RFC 4122 / RFC 9562 UUID syntax.
   */
  static isValidUuid(id: string): boolean {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Extracts the creation timestamp in milliseconds from a UUIDv7 string.
   * Returns null if not a valid UUIDv7.
   */
  static extractTimestamp(uuid: string): number | null {
    if (!this.isValidUuid(uuid)) return null;
    const clean = uuid.replace(/-/g, '');
    const version = parseInt(clean[12], 16);
    if (version !== 7) return null;
    const high = parseInt(clean.slice(0, 4), 16);
    const low = parseInt(clean.slice(4, 12), 16);
    return high * 0x100000000 + low;
  }
}

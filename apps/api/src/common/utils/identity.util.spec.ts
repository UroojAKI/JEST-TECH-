import { IdentityUtil } from './identity.util';

describe('IdentityUtil (RFC 9562 UUIDv7)', () => {
  it('should generate valid 36-character UUIDv7 strings', () => {
    const id = IdentityUtil.generateEntityId();
    expect(id).toHaveLength(36);
    expect(IdentityUtil.isValidUuid(id)).toBe(true);

    // Verify version 7 in the 13th character (index 14)
    expect(id[14]).toBe('7');
    // Verify variant (8, 9, a, or b) in the 17th character (index 19)
    expect(['8', '9', 'a', 'b']).toContain(id[19].toLowerCase());
  });

  it('should extract correct creation timestamp from UUIDv7', () => {
    const now = Date.now();
    const id = IdentityUtil.generateEntityId(now);
    const extracted = IdentityUtil.extractTimestamp(id);

    expect(extracted).toBe(now);
  });

  it('should sort sequentially generated IDs chronologically', () => {
    const t0 = 1700000000000;
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      ids.push(IdentityUtil.generateEntityId(t0 + i * 100));
    }

    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('should validate RFC UUIDs correctly', () => {
    expect(IdentityUtil.isValidUuid('018f3a5e-7b2c-7a91-8d4e-123456789abc')).toBe(true);
    expect(IdentityUtil.isValidUuid('c3b9b9c0-1122-4a55-b899-abcdef012345')).toBe(true);
    expect(IdentityUtil.isValidUuid('not-a-uuid')).toBe(false);
    expect(IdentityUtil.isValidUuid('')).toBe(false);
  });
});

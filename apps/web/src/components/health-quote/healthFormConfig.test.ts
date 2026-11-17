import { describe, expect, it } from 'vitest';
import { isMaskedPii, toPayload, SECTION_A_FIELDS } from './healthFormConfig';

describe('isMaskedPii', () => {
  it('recognizes masked PAN and Aadhaar while preserving complete values', () => {
    expect(isMaskedPii('XXXXX1234F')).toBe(true);
    expect(isMaskedPii('XXXX-XXXX-9012')).toBe(true);
    expect(isMaskedPii('ABCDE1234F')).toBe(false);
    expect(isMaskedPii('123456789012')).toBe(false);
    expect(isMaskedPii(null)).toBe(false);
  });
});

describe('toPayload', () => {
  it('drops membersCount from planDetails for FAMILY_FLOATER', () => {
    const fields = SECTION_A_FIELDS.FAMILY_FLOATER;
    const values = {
      planName: 'Optima Secure',
      uin: 'HDFHLIP23071V052223',
      sumInsured: 500000,
      roomRentCategory: 'NO_CAPPING',
      membersCount: 3,
      maternityCoverRequired: false,
    };
    const payload = toPayload(fields, values);
    expect(payload.membersCount).toBeUndefined();
    expect(payload.planName).toBe('Optima Secure');
    expect(payload.sumInsured).toBe(500000);
    expect(payload.roomRentCategory).toBe('NO_CAPPING');
  });
});

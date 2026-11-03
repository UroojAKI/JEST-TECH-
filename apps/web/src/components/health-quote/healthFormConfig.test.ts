import { describe, expect, it } from 'vitest';
import { isMaskedPii } from './healthFormConfig';

describe('isMaskedPii', () => {
  it('recognizes masked PAN and Aadhaar while preserving complete values', () => {
    expect(isMaskedPii('XXXXX1234F')).toBe(true);
    expect(isMaskedPii('XXXX-XXXX-9012')).toBe(true);
    expect(isMaskedPii('ABCDE1234F')).toBe(false);
    expect(isMaskedPii('123456789012')).toBe(false);
    expect(isMaskedPii(null)).toBe(false);
  });
});

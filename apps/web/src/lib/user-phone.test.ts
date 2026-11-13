import { describe, it, expect } from 'vitest';
import {
  sanitizeTenDigitPhone,
  validateOptionalTenDigitPhone,
  USER_PHONE_ERROR_MESSAGE,
} from './user-phone';

describe('user-phone utilities', () => {
  it('sanitizes input to digits only with max length 10', () => {
    expect(sanitizeTenDigitPhone('+91 98765-43210')).toBe('9198765432');
    expect(sanitizeTenDigitPhone('12345abc6789012')).toBe('1234567890');
    expect(sanitizeTenDigitPhone('')).toBe('');
  });

  it('treats empty or whitespace values as valid optional input', () => {
    expect(validateOptionalTenDigitPhone('')).toEqual({
      valid: true,
      normalized: '',
    });
    expect(validateOptionalTenDigitPhone('   ')).toEqual({
      valid: true,
      normalized: '',
    });
  });

  it('accepts any 10-digit number including test values like 1234567890', () => {
    expect(validateOptionalTenDigitPhone('1234567890')).toEqual({
      valid: true,
      normalized: '1234567890',
    });
    expect(validateOptionalTenDigitPhone('9876543210')).toEqual({
      valid: true,
      normalized: '9876543210',
    });
  });

  it('rejects non-10-digit numbers when provided', () => {
    expect(validateOptionalTenDigitPhone('12345')).toEqual({
      valid: false,
      normalized: '12345',
      error: USER_PHONE_ERROR_MESSAGE,
    });
    expect(validateOptionalTenDigitPhone('987654321a')).toEqual({
      valid: false,
      normalized: '987654321a',
      error: USER_PHONE_ERROR_MESSAGE,
    });
  });
});


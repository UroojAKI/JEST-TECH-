export const USER_PHONE_REGEX = /^\d{10}$/;
export const USER_PHONE_ERROR_MESSAGE = 'Mobile number must be a valid 10-digit number';

/**
 * Restricts user mobile input to at most 10 numeric digits.
 */
export function sanitizeTenDigitPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

/**
 * Validates an optional mobile number input, returning normalized digits or an error message.
 */
export function validateOptionalTenDigitPhone(value: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = value.trim();
  if (!normalized) {
    return { valid: true, normalized: '' };
  }
  if (!USER_PHONE_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: USER_PHONE_ERROR_MESSAGE,
    };
  }
  return { valid: true, normalized };
}


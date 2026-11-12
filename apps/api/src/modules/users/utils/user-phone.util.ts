import { BadRequestException } from '@nestjs/common';

export const USER_PHONE_REGEX = /^\d{10}$/;
export const USER_PHONE_ERROR_MESSAGE =
  'Mobile number must be a valid 10-digit number';

/**
 * Transforms incoming DTO phone inputs before class-validator runs so blank strings
 * are treated as unset on create/invite or null (clear) on updates.
 */
export function transformOptionalUserPhone(
  value: unknown,
  options: { emptyAsNull?: boolean } = {},
): unknown {
  if (value === undefined) return undefined;
  if (value === null) return options.emptyAsNull ? null : undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) {
    return options.emptyAsNull ? null : undefined;
  }
  return trimmed;
}

/**
 * Normalizes and validates an optional user mobile number inside service methods,
 * protecting direct callers that bypass HTTP DTO validation.
 */
export function normalizeOptionalUserPhone(
  phone: string | null | undefined,
  options: { emptyAsNull?: boolean } = {},
): string | null | undefined {
  if (phone === undefined) return undefined;
  if (phone === null) return options.emptyAsNull ? null : undefined;
  if (typeof phone !== 'string') {
    throw new BadRequestException(USER_PHONE_ERROR_MESSAGE);
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return options.emptyAsNull ? null : undefined;
  }
  if (!USER_PHONE_REGEX.test(trimmed)) {
    throw new BadRequestException(USER_PHONE_ERROR_MESSAGE);
  }
  return trimmed;
}


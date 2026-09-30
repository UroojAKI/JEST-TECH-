export const VALID_NCB_SLABS = [0, 20, 25, 35, 45, 50] as const;
export type ValidNcbSlab = (typeof VALID_NCB_SLABS)[number];

export function isValidNcbSlab(value: number): value is ValidNcbSlab {
  return VALID_NCB_SLABS.includes(value as ValidNcbSlab);
}

export function validateNcbSlabOrThrow(value: number): void {
  if (!isValidNcbSlab(value)) {
    throw new Error(
      `INVALID_NCB_PERCENTAGE: NCB must be one of ${VALID_NCB_SLABS.join(', ')}%, received ${value}%`,
    );
  }
}

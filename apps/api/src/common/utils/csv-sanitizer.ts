/**
 * Sanitizes CSV cell values to prevent CSV Formula Injection (CWE-1236).
 *
 * Prepends a single quote to cells beginning with dangerous formula characters:
 * '=', '+', '-', '@', '\t', '\r'.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerous.some((char) => str.startsWith(char))) {
    return `'${str}`;
  }
  return str;
}

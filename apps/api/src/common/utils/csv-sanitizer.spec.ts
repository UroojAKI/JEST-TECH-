import { sanitizeCsvCell } from './csv-sanitizer';

describe('sanitizeCsvCell', () => {
  it('returns empty string for null, undefined, or empty values', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
    expect(sanitizeCsvCell('')).toBe('');
  });

  it('prepends single quote to cells beginning with formula injection characters', () => {
    expect(sanitizeCsvCell('=1+1')).toBe(`'=1+1`);
    expect(sanitizeCsvCell('+cmd|')).toBe(`'+cmd|`);
    expect(sanitizeCsvCell('-SUM(A1:A10)')).toBe(`'-SUM(A1:A10)`);
    expect(sanitizeCsvCell('@HYPERLINK("http://evil.com")')).toBe(`'@HYPERLINK("http://evil.com")`);
    expect(sanitizeCsvCell('\tmalicious')).toBe(`'\tmalicious`);
    expect(sanitizeCsvCell('\rmalicious')).toBe(`'\rmalicious`);
  });

  it('passes normal safe values through untouched', () => {
    expect(sanitizeCsvCell('Normal Text')).toBe('Normal Text');
    expect(sanitizeCsvCell('12345')).toBe('12345');
    expect(sanitizeCsvCell(45000)).toBe('45000');
    expect(sanitizeCsvCell('POL-2026-0001')).toBe('POL-2026-0001');
  });
});

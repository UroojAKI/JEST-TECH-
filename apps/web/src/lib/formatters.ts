/**
/**
 * Utility functions for consistent, SSR-safe locale formatting
 */

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0';
  }
  return `₹${Number(amount).toLocaleString('en-US')}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0';
  }
  return Number(value).toLocaleString('en-US');
}

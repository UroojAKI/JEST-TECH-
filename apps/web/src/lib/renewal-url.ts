/**
 * Authoritative renewal URL builder.
 * Ensures consistent routing and query parameters across all renewal entry points.
 */
export function buildRenewalUrl(policyId: string): string {
  return `/sales/quotations?renewPolicyId=${encodeURIComponent(policyId)}`;
}

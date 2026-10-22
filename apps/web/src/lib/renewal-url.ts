/**
 * Authoritative renewal URL builder.
 * Ensures consistent routing and query parameters across all renewal entry points.
 */
export function buildRenewalUrl(policyId: string): string {
  return `/sales/quotations?renewPolicyId=${encodeURIComponent(policyId)}`;
}

export function buildHealthRenewalUrl(
  policyId: string,
  extra?: { contactId?: string; leadId?: string; planCategory?: string }
): string {
  const params = new URLSearchParams();
  params.set('renewPolicyId', policyId);
  if (extra?.contactId) params.set('contactId', extra.contactId);
  if (extra?.leadId) params.set('leadId', extra.leadId);
  if (extra?.planCategory) params.set('planCategory', extra.planCategory);
  return `/sales/health-quotations/new?${params.toString()}`;
}


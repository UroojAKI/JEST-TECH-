'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { X, RefreshCw, Loader2, AlertCircle, CalendarClock, ShieldCheck } from 'lucide-react';
import { policiesRepository } from '../../../repositories/policies.repository';
import { buildHealthRenewalUrl, buildRenewalUrl } from '../../../lib/renewal-url';

interface RenewalWizardDrawerProps {
  isOpen: boolean;
  policyId: string;
  onClose: () => void;
}

export function RenewalWizardDrawer({ isOpen, policyId, onClose }: RenewalWizardDrawerProps) {
  const router = useRouter();
  const { data: policy, isLoading, isError, refetch } = useQuery({
    queryKey: ['policy-renewal-context', policyId],
    queryFn: () => policiesRepository.getPolicyWorkspace(policyId),
    enabled: isOpen && Boolean(policyId),
  });

  if (!isOpen) return null;

  const policyData = policy as any;
  const product = String(policy?.productLine || policyData?.productType || policy?.policyType || '').toUpperCase();
  const isHealth = product.includes('HEALTH');
  const isMotor = product.includes('MOTOR') || product.includes('GENERAL') || product.includes('VEHICLE');
  const expiry = policy?.expiryDate ? new Date(policy.expiryDate) : null;
  const isExpired = Boolean(expiry && expiry.getTime() < Date.now());
  const supported = isHealth || isMotor;

  const continueToRenewal = () => {
    if (!policy || !supported) return;
    onClose();
    if (isHealth) {
      router.push(buildHealthRenewalUrl(policyId, {
        contactId: policyData?.contactId || policyData?.contact?.id,
        leadId: policyData?.leadId || undefined,
        planCategory: policyData?.healthPlanCategory || policyData?.quotation?.healthPlanCategory || undefined,
      }));
      return;
    }
    router.push(buildRenewalUrl(policyId));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-lg flex-col border-l bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Start policy renewal</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close renewal panel" className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              Loading authoritative policy details…
            </div>
          ) : isError || !policy ? (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Could not load the policy. Renewal cannot continue without the authoritative policy record.</span>
              <button type="button" onClick={() => refetch()} className="ml-auto underline">Retry</button>
            </div>
          ) : (
            <>
              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Policy being renewed
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><dt className="text-muted-foreground">Policy number</dt><dd className="mt-0.5 break-all font-semibold">{policyData?.actualPolicyNumber || policy.policyNumber}</dd></div>
                  <div><dt className="text-muted-foreground">Product</dt><dd className="mt-0.5 font-semibold">{policy.productLine || policy.policyType || 'Unclassified'}</dd></div>
                  <div><dt className="text-muted-foreground">Customer</dt><dd className="mt-0.5 font-semibold">{policy.contactName || policy.customerName || 'Customer record'}</dd></div>
                  <div><dt className="text-muted-foreground">Insurer</dt><dd className="mt-0.5 font-semibold">{policy.insurerName || 'Not recorded'}</dd></div>
                  <div><dt className="text-muted-foreground">Expiry</dt><dd className="mt-0.5 font-semibold">{expiry ? expiry.toLocaleDateString('en-IN') : 'Not recorded'}</dd></div>
                  <div><dt className="text-muted-foreground">Current status</dt><dd className="mt-0.5 font-semibold">{policy.status}</dd></div>
                </dl>
              </section>

              <section className={`rounded-xl border p-4 ${isExpired ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}>
                <div className="flex items-start gap-2">
                  <CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${isExpired ? 'text-amber-600' : 'text-primary'}`} />
                  <div className="space-y-1">
                    <div className="text-sm font-bold">{isExpired ? 'Policy has expired' : 'Renewal eligibility must be rechecked'}</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {isExpired
                        ? 'The renewal journey must apply the insurer’s lapse and inspection rules. Do not assume uninterrupted coverage or backdate the renewed policy.'
                        : 'The renewal journey will reuse the saved policy and customer details, then require a fresh insurer quotation and approval.'}
                    </p>
                  </div>
                </div>
              </section>

              {!supported && (
                <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs leading-relaxed">
                  Renewal quoting is not yet configured for this product category. No policy dates or financial records have been changed.
                </div>
              )}
            </>
          )}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t p-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button>
          <button
            type="button"
            disabled={isLoading || isError || !policy || !supported}
            onClick={continueToRenewal}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to renewal quotations
          </button>
        </footer>
      </div>
    </div>
  );
}

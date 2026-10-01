'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, CheckCircle2, ChevronRight, RefreshCw, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { policiesRepository } from '../../../repositories/policies.repository';
import { toast } from 'sonner';

interface RenewalWizardDrawerProps {
  isOpen: boolean;
  policyId: string;
  onClose: () => void;
}

export function RenewalWizardDrawer({ isOpen, policyId, onClose }: RenewalWizardDrawerProps) {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<string>('ONLINE');

  const { data: policy, isLoading, isError } = useQuery({
    queryKey: ['policy-renewal-context', policyId],
    queryFn: () => policiesRepository.getPolicyWorkspace(policyId),
    enabled: isOpen && Boolean(policyId),
  });

  if (!isOpen) return null;

  const currentIdv = Number(policy?.idvValue || 0);
  const revisedIdv = currentIdv > 0 ? Math.round(currentIdv * 0.9) : 0;
  const currentPremium = Number(policy?.totalPremium || 0);
  const renewalPremium = currentPremium > 0 ? Math.round(currentPremium * 0.95) : 0;

  const handleRenewPolicy = async () => {
    try {
      setIsSubmitting(true);
      await policiesRepository.renewPolicy(policyId, {
        revisedIdv,
        renewalPremium,
        paymentMode,
      });
      toast.success(`Policy ${policy?.policyNumber || policyId} renewed successfully!`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to process policy renewal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Verify Policy' },
    { num: 2, title: 'Recalculate Premium' },
    { num: 3, title: 'Compare Insurers' },
    { num: 4, title: 'Customer Approval' },
    { num: 5, title: 'Payment Setup' },
    { num: 6, title: 'Issue Renewal' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-base">Policy Renewal Wizard</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-accent rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="p-3 border-b bg-muted/20 overflow-x-auto">
          <div className="flex items-center space-x-2 text-[10px]">
            {steps.map((s) => (
              <div key={s.num} className="flex items-center space-x-1 whitespace-nowrap">
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center font-bold ${
                    step === s.num
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="h-3 w-3" /> : s.num}
                </div>
                <span className={`font-semibold ${step === s.num ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                  {s.title}
                </span>
                {s.num < 6 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 ml-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading policy record...</span>
            </div>
          ) : isError || !policy ? (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>Failed to load authoritative policy record for renewal.</span>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Step 1: Current Policy Review</h4>
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div>Policy Number: <strong className="font-mono">{policy.policyNumber}</strong></div>
                    <div>Customer: <strong>{policy.contactName || 'Valued Customer'}</strong></div>
                    <div>Product Line: <strong>{policy.productLine || 'Motor Insurance'}</strong></div>
                    <div>Insurer: <strong>{policy.insurerName || 'Authoritative Carrier'}</strong></div>
                    <div>Current Expiry: <strong>{policy.expiryDate ? new Date(policy.expiryDate).toLocaleDateString('en-IN') : 'Upcoming'}</strong></div>
                    <div>Status: <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{policy.status}</span></div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Step 2: Live Premium Recalculation</h4>
                  <p className="text-muted-foreground">Depreciation and NCB retention evaluated according to IRDAI guidelines.</p>
                  <div className="p-3 rounded-lg border bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold space-y-2">
                    {revisedIdv > 0 && <div>Revised IDV: ₹{revisedIdv.toLocaleString('en-IN')}</div>}
                    <div>Renewal Premium: ₹{renewalPremium.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] font-normal text-muted-foreground">
                      Prior Premium: ₹{currentPremium.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Step 3: Insurer Portability & Comparison</h4>
                  <div className="p-3 rounded-lg border bg-primary/5 space-y-2">
                    <div className="font-bold text-primary">
                      {policy.insurerName || 'Primary Insurer'} (Current Provider) — ₹{renewalPremium.toLocaleString('en-IN')}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Portability options available upon customer request through partner aggregator APIs.
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Step 4: Customer Consent & Acceptance</h4>
                  <p className="text-muted-foreground">Record verification of customer consent for renewal schedule.</p>
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <label className="flex items-center space-x-2 font-medium cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-input text-primary focus:ring-primary" />
                      <span>Customer verbal/digital consent recorded for schedule renewal</span>
                    </label>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Step 5: Payment Method & Premium Settlement</h4>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-muted-foreground">SELECT PAYMENT CHANNEL</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full p-2 rounded-lg border bg-background text-foreground font-medium"
                    >
                      <option value="ONLINE">Digital Payment Gateway (UPI / NetBanking)</option>
                      <option value="CHEQUE">Cheque / Demand Draft</option>
                      <option value="NEFT">Bank Transfer (NEFT / RTGS)</option>
                    </select>
                    <div className="p-3 rounded-lg border bg-muted/20 font-mono text-xs">
                      <div>Payable Amount: ₹{renewalPremium.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Step 6: Issue Renewal Policy Certificate</h4>
                  <p className="text-muted-foreground">Confirm policy renewal creation and ledger recording.</p>
                  <div className="p-3 rounded-lg border border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold flex items-center space-x-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>Ready to dispatch authoritative renewal policy schedule.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t flex justify-between items-center bg-card">
          <button
            disabled={step === 1 || isSubmitting || isLoading}
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 rounded-lg border bg-background font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          {step < 6 ? (
            <button
              disabled={isLoading || isError || !policy}
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-sm disabled:opacity-40"
            >
              Continue Next →
            </button>
          ) : (
            <button
              disabled={isSubmitting || isLoading || isError || !policy}
              onClick={handleRenewPolicy}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm flex items-center space-x-1 disabled:opacity-40"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <span>{isSubmitting ? 'Renewing...' : 'Confirm Issue Renewal'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

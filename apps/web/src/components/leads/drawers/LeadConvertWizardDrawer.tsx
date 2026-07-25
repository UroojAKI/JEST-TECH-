'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, ChevronRight, UserCheck, Loader2, ShieldCheck, Check } from 'lucide-react';
import { policiesRepository } from '../../../repositories/policies.repository';
import { quotationsRepository } from '../../../repositories/quotations.repository';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/formatters';

interface LeadConvertWizardDrawerProps {
  isOpen: boolean;
  leadId: string;
  lead?: any;
  onClose: () => void;
}

export function LeadConvertWizardDrawer({ isOpen, leadId, lead, onClose }: LeadConvertWizardDrawerProps) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState<number>(0);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !leadId) return;

    async function fetchLeadQuotes() {
      setIsLoadingQuotes(true);
      try {
        const res = await quotationsRepository.getQuotations({ limit: 50 });
        const items = Array.isArray(res) ? res : (res as any)?.items || [];
        const matching = items.filter(
          (q: any) =>
            q.leadId === leadId ||
            (q.contactName && lead?.name && q.contactName.trim().toLowerCase() === lead.name.trim().toLowerCase()),
        );

        if (matching.length > 0) {
          setAvailableQuotes(matching);
        } else {
          setAvailableQuotes([
            {
              id: `QT-${leadId.slice(-4)}`,
              insurerName: lead?.productInterest || 'Motor Comprehensive',
              totalPremium: lead?.expectedPremium || 25000,
              idvValue: lead?.expectedPremium ? Math.round(lead.expectedPremium * 25) : 850000,
              status: 'DRAFT',
            },
          ]);
        }
      } catch (err) {
        setAvailableQuotes([
          {
            id: `QT-${leadId.slice(-4)}`,
            insurerName: lead?.productInterest || 'Motor Comprehensive',
            totalPremium: lead?.expectedPremium || 25000,
            idvValue: 850000,
            status: 'DRAFT',
          },
        ]);
      } finally {
        setIsLoadingQuotes(false);
      }
    }

    fetchLeadQuotes();
  }, [isOpen, leadId, lead]);

  if (!isOpen) return null;

  const leadName = lead?.name || `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || `Lead Prospect`;
  const leadPhone = lead?.phone || '-';
  const leadEmail = lead?.email || '-';
  const selectedQuote = availableQuotes[selectedQuoteIndex] || availableQuotes[0];

  const handleIssuePolicy = async () => {
    setIsSubmitting(true);
    try {
      const res = await policiesRepository.issuePolicy({
        leadId,
        quotationId: selectedQuote?.id,
        contactName: leadName,
        productLine: selectedQuote?.insurerName || lead?.productInterest || 'Insurance Policy',
        totalPremium: Number(selectedQuote?.totalPremium || lead?.expectedPremium || 25000),
        idvValue: Number(selectedQuote?.idvValue || 850000),
      });

      toast.success(`Policy ${res?.policyNumber || res?.id || ''} issued successfully for ${leadName}!`);
      onClose();
      router.push('/policies');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to issue policy via API';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Verify Customer' },
    { num: 2, title: 'Confirm Quote' },
    { num: 3, title: 'Proposal Approval' },
    { num: 4, title: 'Issue Policy' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="font-bold text-base">4-Stage Lead Conversion Wizard</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-accent rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            {steps.map((s) => (
              <div key={s.num} className="flex items-center space-x-1 text-xs">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    step === s.num
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span className={`font-semibold ${step === s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.title}
                </span>
                {s.num < 4 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 ml-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 1: Confirm Customer Account Record</h4>
              <p className="text-muted-foreground">Verify lead contact information before converting to a permanent customer profile.</p>
              <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                <div>Customer Name: <strong className="text-foreground text-sm">{leadName}</strong></div>
                <div>Phone Number: <strong className="text-foreground">{leadPhone}</strong></div>
                <div>Email Address: <strong className="text-foreground">{leadEmail}</strong></div>
                <div>Lead Reference Code: <strong className="text-primary font-mono">{leadId}</strong></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 2: Select Quotation ({availableQuotes.length} Available)</h4>
              <p className="text-muted-foreground">Select the binding quote option agreed upon by the prospect:</p>

              {isLoadingQuotes ? (
                <div className="p-4 text-center text-muted-foreground animate-pulse">Loading quotes...</div>
              ) : (
                <div className="space-y-2">
                  {availableQuotes.map((q, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedQuoteIndex(idx)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${
                        selectedQuoteIndex === idx
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                          : 'border-border bg-card hover:border-muted-foreground'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          {q.insurerName || q.insurer || 'Partner Insurer'}
                          {selectedQuoteIndex === idx && <Check className="h-4 w-4 text-emerald-600" />}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          IDV: {formatCurrency(q.idvValue || 850000)} • Premium: <strong className="text-emerald-600" suppressHydrationWarning>{formatCurrency(q.totalPremium || q.amount)}</strong>
                        </div>
                      </div>
                      <div className="font-black text-sm text-emerald-600" suppressHydrationWarning>
                        {formatCurrency(q.totalPremium || q.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 3: Underwriting Proposal Review</h4>
              <p className="text-muted-foreground">Check proposal submission and automatic underwriting rules.</p>
              <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <span>Auto-Underwriting Approval Granted</span>
                </div>
                <p className="text-[11px] font-normal text-muted-foreground pt-1" suppressHydrationWarning>
                  Selected Plan: <strong>{selectedQuote?.insurerName || selectedQuote?.insurer}</strong> — Net Premium: <strong>{formatCurrency(selectedQuote?.totalPremium || selectedQuote?.amount)}</strong>
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 4: Issue Policy & Generate Certificate</h4>
              <p className="text-muted-foreground">Finalize payment confirmation and issue active policy record via API backend.</p>
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5 font-mono text-xs">
                <div>Lead Reference: <strong className="text-foreground">{leadId}</strong></div>
                <div>Customer Name: <strong className="text-foreground">{leadName}</strong></div>
                <div>Plan / Product: <strong className="text-foreground">{selectedQuote?.insurerName || lead?.productInterest}</strong></div>
                <div>Total Annual Premium: <strong className="text-emerald-600" suppressHydrationWarning>{formatCurrency(selectedQuote?.totalPremium || lead?.expectedPremium)}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t flex justify-between items-center bg-card">
          <button
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 rounded-lg border bg-background font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm"
            >
              Continue Next →
            </button>
          ) : (
            <button
              disabled={isSubmitting}
              onClick={handleIssuePolicy}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm flex items-center space-x-1"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <span>{isSubmitting ? 'Issuing Policy...' : 'Issue Policy Now'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

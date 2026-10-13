'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronRight, ChevronLeft, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';

import { DocumentChecklist } from './DocumentChecklist';
import { PaymentStatusForm } from './PaymentStatusForm';
import type { UploadedDoc, SavedMotorQuote, PaymentRecord } from './motorFormTypes';

interface Props {
  isOpen: boolean;
  quote: SavedMotorQuote | null;
  onClose: () => void;
  onSuccess: (updatedQuote: SavedMotorQuote) => void;
}

const STEPS = [
  { num: 1, label: 'Documents' },
  { num: 2, label: 'Payment' },
];

export function MotorProposalWizard({ isOpen, quote, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord>(
    quote?.paymentRecord || { status: 'NOT_DONE' },
  );

  const { data: freshQuoteData } = useQuery({
    queryKey: ['quotation-wizard-detail', quote?.id],
    queryFn: async () => {
      const res = await apiClient.get(`/quotations/${quote?.id}`);
      return res.data?.data || res.data;
    },
    enabled: isOpen && !!quote?.id && !quote.id.startsWith('temp-'),
    refetchInterval: isOpen ? 3000 : false,
  });

  if (!isOpen || !quote) return null;

  const currentQuote: SavedMotorQuote = freshQuoteData
    ? {
        ...quote,
        ...freshQuoteData,
        status:
          freshQuoteData.status === 'APPROVED' ? 'APPROVED' :
          freshQuoteData.status === 'ACCEPTED' ? 'ACCEPTED' :
          freshQuoteData.workflowState === 'PROPOSAL_APPROVED' ? 'APPROVED' :
          freshQuoteData.status || quote.status,
        workflowState: freshQuoteData.workflowState || quote.workflowState,
        totalPremium: Number(freshQuoteData.totalPremium ?? quote.totalPremium ?? 0),
      }
    : quote;

  const rawStatus = String(currentQuote.status || '').toUpperCase();
  const workflowState = String(currentQuote.workflowState || (currentQuote as any)?.motorMetadata?.workflowState || '').toUpperCase();
  const proposalStatus = String(currentQuote.proposalStatus || (currentQuote as any)?.proposal?.status || '').toUpperCase();

  const isApprovedForPayment =
    ['APPROVED', 'ACCEPTED', 'CUSTOMER_ACCEPTED', 'PROPOSAL_APPROVED', 'PAYMENT_PENDING', 'PAYMENT_UNDER_PROCESS'].includes(rawStatus) ||
    ['APPROVED', 'ACCEPTED', 'PROPOSAL_APPROVED'].includes(workflowState) ||
    proposalStatus === 'APPROVED';

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) {
      if (!isApprovedForPayment) return false;
      if (paymentRecord.status === 'NOT_DONE') return false;
      if (paymentRecord.status === 'PAID') {
        const amt = paymentRecord.amount ?? currentQuote.totalPremium;
        return Boolean(
          amt &&
            Number(amt) > 0 &&
            paymentRecord.referenceNumber?.trim(),
        );
      }
    }
    return true;
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, 2));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      if (currentQuote.id && !currentQuote.id.startsWith('temp-')) {
        const effectiveAmount =
          paymentRecord.amount !== undefined && paymentRecord.amount !== null
            ? Number(paymentRecord.amount)
            : paymentRecord.status === 'PAID'
              ? Number(currentQuote.totalPremium)
              : undefined;

        await apiClient.post(`/motor/quotations/${currentQuote.id}/payment`, {
          status: paymentRecord.status,
          amount: effectiveAmount,
          paymentMethod: paymentRecord.paymentMethod,
          referenceNumber: paymentRecord.referenceNumber?.trim() || undefined,
          notes: paymentRecord.notes,
        });
      }

      const nextStatus = paymentRecord.status === 'PAID' ? 'PENDING_ISSUANCE' : 'PAYMENT_UNDER_PROCESS';
      toast.success(
        paymentRecord.status === 'PAID'
          ? 'Payment confirmed. The quotation is now waiting for Back Office policy issuance.'
          : 'Payment status recorded.'
      );
      onSuccess({ ...currentQuote, status: nextStatus });
      onClose();
    } catch (e: any) {
      console.error(e);
      const errMsg = e.response?.data?.message || e.message || 'Failed to record payment';
      toast.error(Array.isArray(errMsg) ? errMsg.join(' | ') : errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-card rounded-xl border shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground tracking-tight">Complete Proposal & Payment</h2>
              <p className="text-xs text-muted-foreground font-medium">
                {currentQuote.customerName || currentQuote.proposerDetails?.customerName || 'Customer'} • {currentQuote.quotationCode} • ₹{currentQuote.totalPremium.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 border-b bg-muted/10">
          <div className="flex items-center gap-2 overflow-x-auto">
            {STEPS.map((s, idx) => {
              const isDone = step > s.num;
              const isActive = step === s.num;
              return (
                <React.Fragment key={s.num}>
                  <div className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'text-emerald-600' : isDone ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-emerald-600 text-white' : isDone ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isDone ? '✓' : s.num}
                    </div>
                    {s.label}
                  </div>
                  {idx < STEPS.length - 1 && <div className={`h-px w-6 mx-1 ${step > s.num ? 'bg-foreground' : 'bg-border'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="max-w-2xl mx-auto space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Document Checklist</h3>
                <DocumentChecklist
                  category={currentQuote.vehicleCategory}
                  policyType={currentQuote.policyType}
                  uploadedDocs={uploadedDocs}
                  onDocChange={setUploadedDocs}
                  quoteFile={quoteFile}
                  onQuoteFileChange={setQuoteFile}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b pb-2">Payment Collection</h3>
                {!isApprovedForPayment && (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-medium space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      ⚠️ Underwriting Approval Required Before Payment
                    </div>
                    <div>
                      This motor quotation is currently in status <strong>{currentQuote.status}</strong>. Under IRDAI statutory workflow, payment cannot be collected until the proposal is formally approved by underwriting.
                    </div>
                  </div>
                )}
                <PaymentStatusForm
                  value={paymentRecord}
                  onChange={setPaymentRecord}
                  totalPremium={currentQuote.totalPremium}
                  quotationCode={currentQuote.quotationCode}
                  isApproved={isApprovedForPayment}
                />
                <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 p-3">
                  Sales records payment only. A successful payment does not issue the policy. The quotation moves to the Back Office issuance queue.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-card flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 rounded-md border bg-background font-medium text-sm text-foreground disabled:opacity-40 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            Back
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-foreground text-background font-medium text-sm hover:bg-foreground/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/50"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isSaving || !canProceed()}
              className="flex items-center gap-2 px-6 py-2 rounded-md bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Record Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

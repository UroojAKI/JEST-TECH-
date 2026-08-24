'use client';

import React, { useState } from 'react';
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
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord>({ status: 'NOT_DONE' });

  if (!isOpen || !quote) return null;

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) {
      if (paymentRecord.status === 'NOT_DONE') return false;
      if (paymentRecord.status === 'PAID') {
        return Boolean(paymentRecord.amount && Number(paymentRecord.amount) > 0 && paymentRecord.referenceNumber?.trim());
      }
    }
    return true;
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, 2));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      if (quote.id && !quote.id.startsWith('temp-')) {
        await apiClient.post(`/motor/quotations/${quote.id}/payment`, {
          status: paymentRecord.status,
          amount: paymentRecord.amount ? Number(paymentRecord.amount) : undefined,
          paymentMethod: paymentRecord.paymentMethod,
          referenceNumber: paymentRecord.referenceNumber,
          notes: paymentRecord.notes,
        });
      }

      const nextStatus = paymentRecord.status === 'PAID' ? 'PENDING_ISSUANCE' : 'PAYMENT_UNDER_PROCESS';
      toast.success(
        paymentRecord.status === 'PAID'
          ? 'Payment confirmed. The quotation is now waiting for Back Office policy issuance.'
          : 'Payment status recorded.'
      );
      onSuccess({ ...quote, status: nextStatus });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to record payment');
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
                {quote.proposerDetails?.customerName} • {quote.quotationCode} • ₹{quote.totalPremium.toLocaleString('en-IN')}
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
                  category={quote.vehicleCategory}
                  policyType={quote.policyType}
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
                <PaymentStatusForm
                  value={paymentRecord}
                  onChange={setPaymentRecord}
                  totalPremium={quote.totalPremium}
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

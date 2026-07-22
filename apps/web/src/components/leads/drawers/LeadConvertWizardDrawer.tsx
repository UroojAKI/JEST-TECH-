'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, ChevronRight, UserCheck, ShieldCheck, FileSpreadsheet } from 'lucide-react';

interface LeadConvertWizardDrawerProps {
  isOpen: boolean;
  leadId: string;
  onClose: () => void;
}

export function LeadConvertWizardDrawer({ isOpen, leadId, onClose }: LeadConvertWizardDrawerProps) {
  const [step, setStep] = useState<number>(1);

  if (!isOpen) return null;

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
              <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                <div>Name: <strong>Rahul Patil</strong></div>
                <div>Phone: <strong>+91 98765 43210</strong></div>
                <div>PAN: <strong>ABCDE1234F</strong></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 2: Quotation Selection</h4>
              <p className="text-muted-foreground">Select the binding quote option agreed upon by the prospect.</p>
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-1">
                <div className="font-bold">ICICI Lombard Motor Comprehensive</div>
                <div>IDV: ₹8,50,000 • Net Premium: ₹18,450</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 3: Underwriting Proposal Review</h4>
              <p className="text-muted-foreground">Check proposal submission and automatic underwriting rules.</p>
              <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold">
                ✓ Auto-Underwriting Approval Granted (No medical/inspection required)
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 4: Issue Policy & Generate Certificate</h4>
              <p className="text-muted-foreground">Finalize payment confirmation and issue active policy record.</p>
              <div className="p-3 rounded-lg border bg-muted/20 space-y-1 font-mono">
                <div>Policy Number: <strong>POL-001052</strong></div>
                <div>Effective Date: <strong>2026-07-23</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t flex justify-between items-center bg-card">
          <button
            disabled={step === 1}
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
              onClick={() => {
                alert('Policy POL-001052 issued successfully!');
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm"
            >
              Issue Policy Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

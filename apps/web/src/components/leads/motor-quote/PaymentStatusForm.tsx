'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { PaymentRecord, PaymentTrackingStatus } from './motorFormTypes';

interface Props {
  value: PaymentRecord;
  onChange: (v: PaymentRecord) => void;
  totalPremium?: number;
}

const PAYMENT_OPTIONS: Array<{
  value: PaymentTrackingStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { value: 'PAID', label: 'Payment Done', description: 'Premium has been collected', icon: <CheckCircle2 className="h-5 w-5" />, color: 'emerald' },
  { value: 'UNDER_PROCESS', label: 'Under Process', description: 'Payment initiated, awaiting confirmation', icon: <Clock className="h-5 w-5" />, color: 'amber' },
  { value: 'NOT_DONE', label: 'Not Done', description: 'Payment pending', icon: <AlertCircle className="h-5 w-5" />, color: 'muted' },
];

const PAYMENT_METHODS = ['Cash', 'Cheque', 'NEFT/RTGS', 'UPI', 'Credit Card', 'Debit Card', 'Online Banking', 'Other'];

export function PaymentStatusForm({ value, onChange, totalPremium }: Props) {
  const update = (partial: Partial<PaymentRecord>) => onChange({ ...value, ...partial });

  return (
    <div className="space-y-6">
      {totalPremium && totalPremium > 0 && (
        <div className="p-4 rounded-2xl border bg-primary/5 text-center">
          <div className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Total Premium Due</div>
          <div className="text-2xl font-black text-foreground mt-1">₹{totalPremium.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-muted-foreground">incl. 18% GST</div>
        </div>
      )}

      {/* Payment Status Selection */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Payment Status</h3>
        {PAYMENT_OPTIONS.map(({ value: v, label, description, icon, color }) => (
          <button
            key={v}
            type="button"
            onClick={() => update({ status: v })}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
              value.status === v
                ? `bg-${color}-500/10 border-${color}-400 text-${color}-700`
                : 'bg-background hover:bg-accent border-border'
            }`}
          >
            <div className={value.status === v ? `text-${color}-600` : 'text-muted-foreground'}>{icon}</div>
            <div>
              <div className="font-extrabold text-sm">{label}</div>
              <div className="text-[11px] text-muted-foreground">{description}</div>
            </div>
            <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              value.status === v ? `border-${color}-600 bg-${color}-600` : 'border-border'
            }`}>
              {value.status === v && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </button>
        ))}
      </div>

      {/* Payment Details — shown when PAID or UNDER_PROCESS */}
      {(value.status === 'PAID' || value.status === 'UNDER_PROCESS') && (
        <div className="space-y-3 p-4 rounded-2xl border bg-card">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Payment Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Payment Method</label>
              <select value={value.paymentMethod || ''}
                onChange={(e) => update({ paymentMethod: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Method</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Reference / Cheque / UTR No.</label>
              <input type="text" value={value.referenceNumber || ''}
                onChange={(e) => update({ referenceNumber: e.target.value })}
                placeholder="Transaction reference"
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {value.status === 'PAID' && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Payment Date</label>
                <input type="date" value={value.paidAt || ''}
                  onChange={(e) => update({ paidAt: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Notes</label>
              <textarea value={value.notes || ''}
                onChange={(e) => update({ notes: e.target.value })}
                rows={2} placeholder="Optional notes"
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {value.status === 'PAID' && (
        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-700 text-xs font-bold text-center">
          ✓ Payment confirmed — system will proceed to policy creation check after document verification.
        </div>
      )}
    </div>
  );
}

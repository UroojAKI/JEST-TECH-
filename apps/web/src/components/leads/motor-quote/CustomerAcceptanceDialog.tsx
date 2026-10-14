'use client';

import React, { useState } from 'react';
import { CheckCircle2, X, Shield, Mail, Phone, MessageSquare, FileSignature, Mic, Globe } from 'lucide-react';
import { GstRateSelector } from './GstRateSelector';

export interface CustomerAcceptanceEvidence {
  evidenceMethod: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHYSICAL_SIGNATURE' | 'VERBAL_CALL_RECORDING' | 'PORTAL_CLICK';
  evidenceReference?: string;
  selectedGstRate?: number;
  comments?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotation: {
    id: string;
    quotationCode?: string;
    quotationNumber?: string;
    insurerName?: string;
    finalPremium?: number | string;
    totalPremium?: number | string;
    sumInsured?: number | string;
    selectedGstRate?: number;
  };
  onConfirm: (evidence: CustomerAcceptanceEvidence) => Promise<void> | void;
  isLoading?: boolean;
}

const METHODS = [
  { key: 'EMAIL', label: 'Email Confirmation', icon: Mail, hint: 'Customer sent acceptance via email' },
  { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare, hint: 'Customer confirmed via official WhatsApp chat' },
  { key: 'SMS', label: 'SMS / OTP', icon: Phone, hint: 'Customer verified via SMS/OTP response' },
  { key: 'PHYSICAL_SIGNATURE', label: 'Signed Proposal', icon: FileSignature, hint: 'Physical signed proposal form received' },
  { key: 'VERBAL_CALL_RECORDING', label: 'Call Recording', icon: Mic, hint: 'Verbal consent recorded on recorded line' },
  { key: 'PORTAL_CLICK', label: 'Direct Portal', icon: Globe, hint: 'Accepted directly through customer portal link' },
] as const;

export function CustomerAcceptanceDialog({
  isOpen,
  onClose,
  quotation,
  onConfirm,
  isLoading = false,
}: Props) {
  const [method, setMethod] = useState<CustomerAcceptanceEvidence['evidenceMethod']>('EMAIL');
  const [reference, setReference] = useState('');
  const [gstRate, setGstRate] = useState<'5' | '18'>(
    quotation.selectedGstRate === 5 ? '5' : '18'
  );
  const [comments, setComments] = useState('');

  if (!isOpen) return null;

  const quoteCode = quotation.quotationCode || quotation.quotationNumber || quotation.id;
  const premium = quotation.finalPremium || quotation.totalPremium || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      evidenceMethod: method,
      evidenceReference: reference.trim() || undefined,
      selectedGstRate: parseInt(gstRate),
      comments: comments.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">Record Customer Acceptance</h2>
              <p className="text-[11px] text-muted-foreground">
                Quotation: <span className="font-mono font-bold text-foreground">{quoteCode}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Summary Banner */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Agreed Insurer & Plan</span>
              <span className="font-bold text-foreground">{quotation.insurerName || 'Partner Insurer'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block font-medium">Agreed Total Premium</span>
              <span className="font-black text-emerald-600 text-sm">
                ₹{Number(premium).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Evidence Method Selector */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-2">
              Customer Acceptance Evidence Method *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    <span className="text-[11px] leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference Input */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Evidence Reference / Message ID
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Email Subject / Thread ID / Ticket Number"
              className="w-full p-2.5 rounded-xl border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary border-border"
            />
          </div>

          {/* GST Rate Selector */}
          <GstRateSelector
            value={gstRate}
            onChange={(rate) => setGstRate(rate)}
          />

          {/* Acceptance Comments */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Underwriter / Agent Acceptance Notes
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter details of customer acceptance..."
              className="w-full p-2.5 rounded-xl border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary border-border resize-none"
            />
          </div>

          {/* Audit Trail Guarantee Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
            <Shield className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Customer acceptance locks this quotation version, supersedes competing drafts, and creates an immutable audit record.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {isLoading ? 'Recording...' : 'Confirm & Accept Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

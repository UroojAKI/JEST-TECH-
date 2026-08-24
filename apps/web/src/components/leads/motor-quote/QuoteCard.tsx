'use client';

import React from 'react';
import { CATEGORY_LABEL, POLICY_TYPE_LABEL } from './motorFormConfig';
import type { SavedMotorQuote } from './motorFormTypes';
import { Car, Upload, Clock, CheckCircle2, XCircle, AlertCircle, Shield, Wrench, ShieldCheck, FileText } from 'lucide-react';

interface Props {
  quote: SavedMotorQuote;
  onUploadQuote: (id: string) => void;
  onConductInspection?: (id: string) => void;
  onCompleteProposal?: (quote: SavedMotorQuote) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  DRAFT: { icon: <Clock className="h-3 w-3" />, cls: 'bg-muted/40 text-muted-foreground', label: 'DRAFT' },
  PENDING_INSPECTION: { icon: <AlertCircle className="h-3 w-3" />, cls: 'bg-amber-500/10 text-amber-600 border border-amber-200', label: 'INSPECTION REQ.' },
  READY_FOR_PROPOSAL: { icon: <CheckCircle2 className="h-3 w-3" />, cls: 'bg-blue-500/10 text-blue-600 border border-blue-200', label: 'READY' },
  ISSUED: { icon: <CheckCircle2 className="h-3 w-3" />, cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200', label: 'ISSUED' },
  APPROVED: { icon: <CheckCircle2 className="h-3 w-3" />, cls: 'bg-emerald-500/10 text-emerald-600', label: 'APPROVED' },
  REJECTED: { icon: <XCircle className="h-3 w-3" />, cls: 'bg-rose-500/10 text-rose-600', label: 'REJECTED' },
  PENDING: { icon: <AlertCircle className="h-3 w-3" />, cls: 'bg-amber-500/10 text-amber-600', label: 'PENDING' },
};

const POLICY_TYPE_STYLE: Record<string, { icon: React.ReactNode; cls: string }> = {
  TP_ONLY: { icon: <Shield className="h-3 w-3" />, cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  SAOD: { icon: <Wrench className="h-3 w-3" />, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  PACKAGE: { icon: <Car className="h-3 w-3" />, cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
};

const CAT_ICONS: Record<string, string> = {
  BIKE: '🏍️', PRIVATE_CAR: '🚗', GCV: '🚛', TRACTOR: '🚜',
  AUTO: '🛺', TAXI: '🚕', BUS: '🚌', MISC: '🏗️',
};

export function QuoteCard({ quote, onUploadQuote, onConductInspection, onCompleteProposal }: Props) {
  const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG['DRAFT'];
  const ptStyle = POLICY_TYPE_STYLE[quote.policyType] || POLICY_TYPE_STYLE['PACKAGE'];

  return (
    <div className="p-4 rounded-xl border bg-card hover:shadow-sm transition-all space-y-3 flex flex-col justify-between">
      <div>
        {/* Top Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl flex-shrink-0">{CAT_ICONS[quote.vehicleCategory] || '🚘'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-foreground truncate">{quote.insurerName}</span>
                <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ptStyle.cls}`}>
                  {ptStyle.icon}
                  {POLICY_TYPE_LABEL[quote.policyType] || quote.policyType}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                {CATEGORY_LABEL[quote.vehicleCategory] || quote.vehicleCategory}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-sm text-foreground">
              ₹{Number(quote.totalPremium || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Vehicle Reg */}
        {quote.registrationNumber && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-muted-foreground mt-2">
            <Car className="h-3 w-3" />
            {quote.registrationNumber}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-[10px] mt-3">
          <div className="text-center p-1.5 rounded bg-muted/30 border border-border/50">
            <div className="text-muted-foreground font-medium">IDV</div>
            <div className="font-semibold text-foreground">{quote.idv ? `₹${Number(quote.idv).toLocaleString('en-IN')}` : '—'}</div>
          </div>
          <div className="text-center p-1.5 rounded bg-muted/30 border border-border/50">
            <div className="text-muted-foreground font-medium">NCB</div>
            <div className="font-semibold text-foreground">{quote.ncbPercentage !== undefined ? `${quote.ncbPercentage}%` : '—'}</div>
          </div>
          <div className="text-center p-1.5 rounded bg-muted/30 border border-border/50">
            <div className="text-muted-foreground font-medium">Code</div>
            <div className="font-semibold text-muted-foreground font-mono truncate">{quote.quotationCode}</div>
          </div>
        </div>
      </div>

      {/* Footer & Actions */}
      <div className="pt-3 border-t mt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded ${status.cls}`}>
            {status.icon}
            {status.label}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept=".pdf" className="hidden" onChange={() => onUploadQuote(quote.id)} />
            <span className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="h-3 w-3" />
              Upload PDF
            </span>
          </label>
        </div>
        
        {/* Call to Action Buttons */}
        {quote.status === 'PENDING_INSPECTION' && onConductInspection && (
          <button
            onClick={() => onConductInspection(quote.id)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 text-xs font-semibold transition-colors mt-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Complete Inspection
          </button>
        )}
        
        {quote.status === 'READY_FOR_PROPOSAL' && onCompleteProposal && (
          <button
            onClick={() => onCompleteProposal(quote)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors mt-1"
          >
            <FileText className="h-3.5 w-3.5" />
            Complete Proposal
          </button>
        )}
      </div>
    </div>
  );
}

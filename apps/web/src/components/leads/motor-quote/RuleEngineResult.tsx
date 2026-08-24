'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, Lock, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import type { MotorRuleResult } from './motorFormTypes';

interface Props {
  result: MotorRuleResult | null;
  isLoading?: boolean;
  onRetry?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  POLICY_EXPIRED: 'Policy is expired',
  POLICY_EXPIRED_MORE_THAN_90_DAYS: 'Policy expired more than 90 days ago (NCB Reset)',
  OWNERSHIP_TRANSFER_POLICY_NOT_TRANSFERRED: 'Ownership transferred, but policy not transferred',
  OWNERSHIP_TRANSFER_POLICY_EXPIRED: 'Ownership transferred and policy is expired',
  TP_TO_PACKAGE_UPGRADE: 'Upgrading from Third-Party to Package',
  SAOD_OD_POLICY_EXPIRED: 'SAOD: Previous OD policy is expired',
  SYSTEM_EVALUATED: 'Inspection mandatory based on policy parameters',
};

const NCB_REASON_LABELS: Record<string, string> = {
  CLAIM_IN_PREVIOUS_YEAR: 'Claim made in previous policy year',
  OWNERSHIP_TRANSFER: 'Vehicle ownership has been transferred',
  POLICY_EXPIRED_MORE_THAN_90_DAYS: 'Policy lapsed for more than 90 days',
  ELIGIBLE: 'Eligible NCB applies',
};

export function RuleEngineResult({ result, isLoading, onRetry }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 border rounded-lg bg-card shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <div className="text-sm font-medium text-muted-foreground">Evaluating underwriting rules...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center py-12 gap-3 border rounded-lg bg-card shadow-sm">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <div className="text-sm font-semibold text-foreground">Evaluation unavailable</div>
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80">
            <RefreshCw className="h-3 w-3" /> Retry Evaluation
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-muted/20">
        <div className="text-xs font-bold text-foreground mb-1">System Rule Engine Result</div>
        <p className="text-[11px] text-muted-foreground">
          The following decisions have been evaluated strictly based on business underwriting logic.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* NCB Decision */}
        <div className={`p-4 rounded-lg border flex flex-col justify-between ${
          result.ncbReason === 'ELIGIBLE' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">NCB Applied</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{result.ncb}%</div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground font-medium border-t pt-2 border-border/50">
            Reason: {NCB_REASON_LABELS[result.ncbReason] || result.ncbReason}
          </div>
        </div>

        {/* Inspection Decision */}
        <div className={`p-4 rounded-lg border flex flex-col justify-between ${
          result.inspectionRequired ? 'bg-amber-50/50 border-amber-200' : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              {result.inspectionRequired
                ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span className="text-sm font-semibold text-foreground">
                {result.inspectionRequired ? 'Inspection Required' : 'No Inspection Required'}
              </span>
            </div>
            {result.inspectionRequired && result.inspectionReasons.length > 0 && (
              <ul className="mt-1 space-y-1">
                {result.inspectionReasons.map((r) => (
                  <li key={r} className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3" />
                    {REASON_LABELS[r] || r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* SAOD TP Validity */}
      {result.tpVerificationRequired && (
        <div className={`p-4 rounded-lg border ${
          result.saodTpValid ? 'bg-emerald-50/50 border-emerald-200' : 'bg-destructive/5 border-destructive/20'
        }`}>
          <div className="flex items-center gap-2">
            {result.saodTpValid
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 text-destructive" />}
            <span className="text-sm font-semibold text-foreground">
              Active TP Policy: {result.saodTpValid ? 'Valid' : 'Invalid — Action Required'}
            </span>
          </div>
          {!result.saodTpValid && result.saodTpInvalidReason && (
            <p className="mt-1.5 text-[11px] text-destructive font-medium">{result.saodTpInvalidReason}</p>
          )}
        </div>
      )}

      {/* Next Step */}
      <div className="p-4 rounded-lg border bg-card flex items-center justify-between shadow-sm">
        <span className="text-sm font-medium text-muted-foreground">Workflow Action</span>
        <span className={`text-xs font-bold px-3 py-1 rounded bg-secondary text-secondary-foreground`}>
          {result.nextStep === 'INSPECTION' ? 'Proceed to generate PENDING INSPECTION quote' : 'Proceed to generate QUOTE'}
        </span>
      </div>
    </div>
  );
}

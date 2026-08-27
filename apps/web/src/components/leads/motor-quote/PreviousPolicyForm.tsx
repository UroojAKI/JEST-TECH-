'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Lock, CheckCircle2, Info } from 'lucide-react';
import type { PreviousPolicyDetails, PreviousPolicyType } from './motorFormTypes';
import { NCB_OPTIONS } from './motorFormConfig';

interface Props {
  value: PreviousPolicyDetails;
  onChange: (v: PreviousPolicyDetails) => void;
  newPolicyType?: 'TP_ONLY' | 'SAOD' | 'PACKAGE' | null;
}


const INSURER_LIST = [
  'ICICI Lombard', 'HDFC ERGO', 'Bajaj Allianz', 'Tata AIG', 'New India Assurance',
  'United India Insurance', 'National Insurance', 'Oriental Insurance', 'SBI General',
  'Reliance General', 'Go Digit', 'Chola MS', 'Royal Sundaram', 'Shriram General', 'Future Generali',
];

function computeExpired90Days(expiryDateStr: string): boolean {
  if (!expiryDateStr) return false;
  const expiry = new Date(expiryDateStr);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return expiry < ninetyDaysAgo;
}

function computeIsExpired(expiryDateStr: string): boolean {
  if (!expiryDateStr) return false;
  return new Date(expiryDateStr) < new Date();
}

export function PreviousPolicyForm({ value, onChange, newPolicyType }: Props) {
  const policyExpired = computeIsExpired(value.policyExpiryDate);
  const expired90 = computeExpired90Days(value.policyExpiryDate);

  useEffect(() => {
    if (value.policyExpiryDate) {
      const computed = computeExpired90Days(value.policyExpiryDate);
      if (computed !== value.expiredMoreThan90Days) {
        onChange({ ...value, expiredMoreThan90Days: computed });
      }
    }
  }, [value.policyExpiryDate]);

  const ncbLocked = value.claimInPreviousYear || value.ownershipTransfer || expired90;
  const ncbLockReason = value.claimInPreviousYear
    ? 'Claim in previous year'
    : value.ownershipTransfer
    ? 'Ownership transfer'
    : expired90
    ? 'Policy expired > 90 days'
    : null;

  const showSaodTpFields =
    newPolicyType === 'SAOD' || value.previousPolicyType === 'SAOD';

  const update = (partial: Partial<PreviousPolicyDetails>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="space-y-6">
      {/* SECTION A: Policy Status */}
      <div className="p-5 rounded-lg border bg-card shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">A. Previous Policy Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Policy Expiry Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={value.policyExpiryDate || ''}
              onChange={(e) => update({ policyExpiryDate: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {value.policyExpiryDate && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {policyExpired && !expired90 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                    <AlertTriangle className="h-3 w-3" /> Policy Expired
                  </span>
                )}
                {expired90 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/20">
                    <AlertTriangle className="h-3 w-3" /> Expired &gt; 90 Days (NCB Reset + Inspection)
                  </span>
                )}
                {!policyExpired && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Policy Active
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Previous Policy Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['COMPREHENSIVE', 'THIRD_PARTY', 'SAOD', 'NOT_AVAILABLE'] as PreviousPolicyType[]).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => update({ previousPolicyType: pt })}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-semibold transition-colors border ${
                    value.previousPolicyType === pt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted text-foreground border-border'
                  }`}
                >
                  {pt === 'COMPREHENSIVE' ? 'Comprehensive' :
                   pt === 'THIRD_PARTY' ? 'Third Party' :
                   pt === 'SAOD' ? 'SAOD' : 'Not Available'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Claim in Previous Year? <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-3 max-w-sm">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => update({ claimInPreviousYear: v })}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                  value.claimInPreviousYear === v
                    ? v ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                {v ? 'Yes (Claim Made)' : 'No Claim'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Previous Insurer</label>
            <select
              value={value.previousInsurerName || ''}
              onChange={(e) => update({ previousInsurerName: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select Insurer</option>
              {INSURER_LIST.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Previous Policy Number</label>
            <input
              type="text"
              value={value.previousPolicyNumber || ''}
              onChange={(e) => update({ previousPolicyNumber: e.target.value })}
              placeholder="e.g. ICICI/MV/2023/1234567"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* SECTION B: Ownership Transfer */}
      <div className="p-5 rounded-lg border bg-card shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">B. Ownership Transfer</h3>
        <div className="flex gap-3 max-w-sm">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => update({ ownershipTransfer: v, previousPolicyTransferred: undefined, newOwnerName: undefined })}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                value.ownershipTransfer === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              }`}
            >
              {v ? 'Yes (Transfer)' : 'No Transfer'}
            </button>
          ))}
        </div>

        {value.ownershipTransfer && (
          <div className="space-y-4 p-4 rounded-md bg-muted/30 border border-border mt-3">
            <p className="text-[11px] font-medium text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ownership transfer detected. NCB resets to 0%. Inspection may apply.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">New Owner Name</label>
              <input
                type="text"
                value={value.newOwnerName || ''}
                onChange={(e) => update({ newOwnerName: e.target.value })}
                placeholder="As per RC"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Previous Policy Transferred?</label>
                <div className="flex gap-2">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => update({ previousPolicyTransferred: v })}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        value.previousPolicyTransferred === v
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      {v ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">RC Transfer Status</label>
                <div className="flex gap-2">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => update({ rcTransferStatus: v })}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        value.rcTransferStatus === v
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      {v ? 'Completed' : 'Pending'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION C: SAOD TP/OD Details (conditional) */}
      {showSaodTpFields && (
        <div className="p-5 rounded-lg border bg-sky-50 shadow-sm space-y-4 border-sky-100">
          <h3 className="text-sm font-semibold text-sky-800 border-b border-sky-200 pb-2">C. Active TP Policy Details (SAOD)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sky-700">Active TP Insurer</label>
              <select
                value={value.previousInsurerName || ''}
                onChange={(e) => update({ previousInsurerName: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="">Select TP Insurer</option>
                {INSURER_LIST.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sky-700">Active TP Policy Number</label>
              <input type="text" value={value.previousPolicyNumber || ''}
                onChange={(e) => update({ previousPolicyNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sky-700">TP Policy Expiry Date <span className="text-destructive">*</span></label>
              <input type="date" value={value.tpExpiryDate || ''}
                onChange={(e) => update({ tpExpiryDate: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sky-700">Previous OD Policy Expiry Date</label>
              <input type="date" value={value.odExpiryDate || ''}
                onChange={(e) => update({ odExpiryDate: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: NCB Summary */}
      <div className="p-5 rounded-lg border bg-card shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">D. NCB Declaration</h3>

        {!ncbLocked && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Eligible NCB % (Previous Year)</label>
            <div className="flex flex-wrap gap-2">
              {NCB_OPTIONS.map((n) => {
                const ncbVal = Number(n.value);
                return (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => update({ eligibleNcbPercentage: ncbVal })}
                    className={`py-1.5 px-3 rounded-md text-xs font-semibold border transition-colors ${
                      value.eligibleNcbPercentage === ncbVal
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    {ncbVal}%
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {ncbLocked && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border/50 max-w-md">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold text-foreground">NCB Locked at 0%</div>
              <div className="text-[11px] text-muted-foreground">Reason: {ncbLockReason}</div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground flex items-start gap-1 mt-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          The final NCB is subject to strict rule engine evaluation.
        </p>
      </div>
    </div>
  );
}

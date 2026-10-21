'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { SaodTpVerification, SaodVerificationMethod } from './motorFormTypes';

const INSURER_OPTIONS = [
  'TATA AIG',
  'HDFC ERGO',
  'ICICI Lombard',
  'Bajaj Allianz',
  'New India Assurance',
  'National Insurance',
  'United India Insurance',
  'Oriental Insurance',
  'SBI General',
  'Digit',
  'Acko',
];

export interface SaodTpVerificationCardProps {
  value: SaodTpVerification;
  onChange: (updated: SaodTpVerification) => void;
  disabled?: boolean;
}

export function SaodTpVerificationCard({
  value,
  onChange,
  disabled = false,
}: SaodTpVerificationCardProps) {
  const verification = value || {
    tpInsurer: '',
    tpPolicyNumber: '',
    tpStartDate: '',
    tpExpiryDate: '',
    verificationStatus: 'PENDING',
    verificationMethod: '',
    verifierNotes: '',
    evidenceDocumentUrl: '',
    verifiedByUserConfirmed: false,
  };

  const isVerified =
    verification.verificationStatus === 'VERIFIED' && verification.verifiedByUserConfirmed;
  const tpExpired = verification.tpExpiryDate
    ? new Date(verification.tpExpiryDate) <= new Date()
    : false;

  const inputBase =
    'w-full p-2 text-xs rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs transition-colors';
  const mandatoryInput = (val: string) =>
    `${inputBase} ${!val || val.trim() === '' ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-900/10' : 'border-border'}`;

  const setField = (key: keyof SaodTpVerification, val: string | boolean) => {
    const shouldResetConfirmation =
      key !== 'verifiedByUserConfirmed' && key !== 'verificationStatus';
    const updated: SaodTpVerification = {
      ...verification,
      [key]: val,
      ...(shouldResetConfirmation
        ? { verifiedByUserConfirmed: false, verificationStatus: 'PENDING' }
        : {}),
    };
    onChange(updated);
  };

  return (
    <div
      className={`p-4 rounded-xl border-2 space-y-4 transition-colors ${
        isVerified
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isVerified ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span
            className={`text-sm font-black ${
              isVerified
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            Active TP Policy Verification
          </span>
          {isVerified && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-700 uppercase">
              VERIFIED
            </span>
          )}
          {tpExpired && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-700 uppercase">
              TP EXPIRED
            </span>
          )}
        </div>
        <div className="text-[9px] text-muted-foreground font-bold flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Compliance Required
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-foreground">
            TP Insurer <span className="text-rose-500">*</span>
          </label>
          <select
            disabled={disabled}
            value={verification.tpInsurer || ''}
            onChange={(e) => setField('tpInsurer', e.target.value)}
            className={mandatoryInput(verification.tpInsurer || '')}
          >
            <option value="">— Select TP Insurer —</option>
            {INSURER_OPTIONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <p className="text-[9px] text-muted-foreground">The insurer that issued the Third Party policy</p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-foreground">
            TP Policy Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={disabled}
            value={verification.tpPolicyNumber || ''}
            onChange={(e) => setField('tpPolicyNumber', e.target.value)}
            placeholder="e.g. TP/2024/123456789"
            className={`${mandatoryInput(verification.tpPolicyNumber || '')} font-mono`}
          />
          <p className="text-[9px] text-muted-foreground">Exact policy number from TP certificate</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-foreground">
            TP Start Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            disabled={disabled}
            value={verification.tpStartDate || ''}
            onChange={(e) => setField('tpStartDate', e.target.value)}
            className={mandatoryInput(verification.tpStartDate || '')}
          />
          <p className="text-[9px] text-muted-foreground">TP policy inception date</p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-foreground">
            TP Expiry Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            disabled={disabled}
            value={verification.tpExpiryDate || ''}
            onChange={(e) => setField('tpExpiryDate', e.target.value)}
            className={`${mandatoryInput(verification.tpExpiryDate || '')} ${
              tpExpired ? 'border-rose-500' : ''
            }`}
          />
          {tpExpired ? (
            <p className="text-[9px] text-rose-500 font-bold">
              TP Policy has expired — SAOD cannot be issued
            </p>
          ) : (
            <p className="text-[9px] text-muted-foreground">Must be a valid active future date</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-foreground">
            Verification Method <span className="text-rose-500">*</span>
          </label>
          <div className="space-y-1.5 mt-1">
            {[
              { value: 'POLICY_DOCUMENT', label: '📄 Policy Document' },
              { value: 'INSURER_PORTAL', label: '🌐 Insurer Portal' },
              { value: 'INSURER_CONFIRMATION', label: '📞 Insurer Confirmation' },
              { value: 'OTHER', label: '🔗 Other' },
            ].map(({ value: methodValue, label }) => (
              <label
                key={methodValue}
                className="flex items-center gap-2 text-xs font-semibold cursor-pointer"
              >
                <input
                  type="radio"
                  name="saodVerificationMethod"
                  disabled={disabled}
                  value={methodValue}
                  checked={verification.verificationMethod === methodValue}
                  onChange={() =>
                    setField('verificationMethod', methodValue as SaodVerificationMethod)
                  }
                  className="h-3.5 w-3.5 text-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-foreground">Verification Notes</label>
          <textarea
            rows={4}
            disabled={disabled}
            value={verification.verifierNotes || ''}
            onChange={(e) => setField('verifierNotes', e.target.value)}
            placeholder="e.g. Verified via TATA AIG portal, ref: TAGIC/TP/2024/..."
            className={`${inputBase} resize-none`}
          />
          <p className="text-[9px] text-muted-foreground">Portal screenshot or confirmation details</p>
        </div>
      </div>

      {/* Confirmation Checkbox */}
      <div
        className={`p-3 rounded-xl border transition-colors ${
          verification.verifiedByUserConfirmed
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-muted bg-muted/20'
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={verification.verifiedByUserConfirmed || false}
            onChange={(e) => {
              const newStatus = e.target.checked ? 'VERIFIED' : 'PENDING';
              const updated: SaodTpVerification = {
                ...verification,
                verifiedByUserConfirmed: e.target.checked,
                verificationStatus: newStatus,
              };
              onChange(updated);
            }}
            className="h-4 w-4 rounded text-primary mt-0.5 cursor-pointer"
          />
          <div>
            <div className="text-xs font-black text-foreground">
              I have verified the active TP policy
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              By checking this, you attest that you independently verified the TP policy details
              above. The server records your authenticated identity, method, notes and verification
              timestamp when the quotation is saved.
            </div>
            {verification.verifiedByUserConfirmed && (
              <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-emerald-600">
                <CheckCircle className="h-3 w-3" />
                Confirmation selected — server records verifier identity and timestamp upon save.
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

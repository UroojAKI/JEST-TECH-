'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { INSURER_OPTIONS, NCB_OPTIONS, ADDON_OPTIONS } from './motorFormConfig';
import type { PolicyFormSAOD, SaodTpVerification } from './motorFormTypes';
import { calculateGst } from './motorTariffConfig';

interface Props {
  data: PolicyFormSAOD;
  onChange: (data: PolicyFormSAOD) => void;
}

const inputBase = 'w-full p-2 rounded-lg border text-xs font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-colors border-border';
const mandatoryInput = (val: string) =>
  `w-full p-2 rounded-lg border text-xs font-semibold bg-background focus:outline-none focus:ring-1 transition-colors ${
    !val ? 'border-rose-400 focus:ring-rose-400' : 'border-border focus:ring-primary'
  }`;
const readonlyInput = 'w-full p-2 rounded-lg border text-xs font-semibold bg-muted/40 text-muted-foreground border-border cursor-not-allowed';

function FieldRow({ label, mandatory, conditional, children, hint, formula }: {
  label: string; mandatory?: boolean; conditional?: boolean;
  children: React.ReactNode; hint?: string; formula?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-foreground mb-1">
        {label}
        {mandatory && <span className="text-rose-500 ml-0.5">*</span>}
        {conditional && <span className="text-amber-500 text-[9px] ml-1">(Conditional — Renewal)</span>}
        {!mandatory && !conditional && <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>}
      </label>
      {children}
      {hint && <p className="text-[9px] text-muted-foreground mt-0.5">{hint}</p>}
      {formula && (
        <p className="text-[9px] text-primary/70 mt-0.5 font-mono bg-primary/5 px-2 py-0.5 rounded">
          Formula: {formula}
        </p>
      )}
    </div>
  );
}

export function PolicyFormSAODForm({ data, onChange }: Props) {
  const set = (key: keyof PolicyFormSAOD) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });

  const setVerification = (key: keyof SaodTpVerification, value: string | boolean) => {
    const updatedVerification: SaodTpVerification = { ...data.tpVerification, [key]: value };
    onChange({
      ...data,
      tpVerification: updatedVerification,
      activeTPInsurerName: updatedVerification.tpInsurer,
      activeTPPolicyNumberValidity: `${updatedVerification.tpPolicyNumber} | Valid Till ${updatedVerification.tpExpiryDate}`,
    });
  };

  const recalcPremium = (updated: PolicyFormSAOD): PolicyFormSAOD => {
    const odBase = parseFloat(updated.odPremiumBase || '0') || 0;
    const ncb = parseFloat(updated.ncbPercentage || '0') || 0;
    const addOns = parseFloat(updated.addOnsPremium || '0') || 0;
    const ncbDiscount = Math.round(odBase * (ncb / 100));
    const netOd = odBase - ncbDiscount + addOns;
    const gst = calculateGst(netOd);
    const total = Math.round((netOd + gst) * 100) / 100;
    const commPct = parseFloat(updated.odCommissionPercent || '0') || 0;
    const commission = Math.round(netOd * (commPct / 100));
    return {
      ...updated,
      ncbDiscountAmount: ncbDiscount.toString(),
      odPremium: netOd.toString(),
      gstAmount: gst.toString(),
      totalPremiumInclGST: total.toString(),
      commissionAmount: commission.toString(),
    };
  };

  const handleOdBaseChange = (val: string) => onChange(recalcPremium({ ...data, odPremiumBase: val }));
  const handleNcbChange = (val: string) => onChange(recalcPremium({ ...data, ncbPercentage: val }));
  const handleAddOnsPremiumChange = (val: string) => onChange(recalcPremium({ ...data, addOnsPremium: val }));
  const handleCommissionChange = (val: string) => onChange(recalcPremium({ ...data, odCommissionPercent: val }));

  const handleClaimChange = (val: string) => {
    const ncb = val === 'Yes' ? '0' : data.ncbPercentage;
    onChange(recalcPremium({ ...data, claimInExpiringODPolicy: val, ncbPercentage: ncb }));
  };

  const toggleAddon = (key: string) => {
    const current = data.addonsSelected || [];
    const updated = current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
    onChange({ ...data, addonsSelected: updated });
  };

  const verification = data.tpVerification;
  const isVerified = verification?.verificationStatus === 'VERIFIED' && verification?.verifiedByUserConfirmed;
  const tpExpired = verification?.tpExpiryDate ? new Date(verification.tpExpiryDate) <= new Date() : false;

  return (
    <div className="space-y-4">
      {/* Policy Type Badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <span className="text-lg">🔧</span>
        <div>
          <div className="text-xs font-black text-amber-700 dark:text-amber-400">Standalone Own Damage (SAOD)</div>
          <div className="text-[10px] text-muted-foreground">Requires an active Third Party (TP) policy in force. Backend will enforce this before issuance.</div>
        </div>
      </div>

      {/* SAOD TP VERIFICATION PANEL */}
      <div className={`p-4 rounded-xl border-2 space-y-4 ${
        isVerified
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isVerified
              ? <CheckCircle className="h-4 w-4 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 text-amber-600" />
            }
            <span className={`text-sm font-black ${
              isVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
            }`}>
              Active TP Policy Verification
            </span>
            {isVerified && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-700 uppercase">VERIFIED</span>
            )}
            {tpExpired && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-700 uppercase">TP EXPIRED</span>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground font-bold">Compliance Required</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="TP Insurer" mandatory hint="The company that issued the Third Party policy">
            <select
              value={verification?.tpInsurer || ''}
              onChange={(e) => setVerification('tpInsurer', e.target.value)}
              className={mandatoryInput(verification?.tpInsurer || '')}
            >
              <option value="">— Select TP Insurer —</option>
              {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="TP Policy Number" mandatory hint="Exact policy number as on the TP policy document">
            <input
              type="text"
              value={verification?.tpPolicyNumber || ''}
              onChange={(e) => setVerification('tpPolicyNumber', e.target.value)}
              placeholder="e.g. TP/2024/123456789"
              className={`${mandatoryInput(verification?.tpPolicyNumber || '')} font-mono`}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="TP Start Date" mandatory>
            <input type="date" value={verification?.tpStartDate || ''} onChange={(e) => setVerification('tpStartDate', e.target.value)} className={mandatoryInput(verification?.tpStartDate || '')} />
          </FieldRow>
          <FieldRow label="TP Expiry Date" mandatory hint="Must be a future date for SAOD eligibility">
            <input
              type="date"
              value={verification?.tpExpiryDate || ''}
              onChange={(e) => setVerification('tpExpiryDate', e.target.value)}
              className={`${mandatoryInput(verification?.tpExpiryDate || '')} ${tpExpired ? 'border-rose-500' : ''}`}
            />
            {tpExpired && <p className="text-[9px] text-rose-500 mt-0.5 font-bold">TP Policy has expired — SAOD cannot be issued</p>}
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Verification Method" mandatory hint="How was the active TP policy verified?">
            <div className="space-y-1.5 mt-1">
              {[
                { value: 'POLICY_DOCUMENT', label: '📄 Policy Document' },
                { value: 'INSURER_PORTAL', label: '🌐 Insurer Portal' },
                { value: 'INSURER_CONFIRMATION', label: '📞 Insurer Confirmation' },
                { value: 'OTHER', label: '🔗 Other' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="verificationMethod"
                    value={value}
                    checked={verification?.verificationMethod === value}
                    onChange={() => setVerification('verificationMethod', value)}
                    className="h-3.5 w-3.5 text-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Verification Notes" hint="Document reference, portal screenshot, or confirmation details">
            <textarea
              rows={4}
              value={verification?.verifierNotes || ''}
              onChange={(e) => setVerification('verifierNotes', e.target.value)}
              placeholder="e.g. Verified via TATA AIG portal, ref: TAGIC/TP/2024/..."
              className={`${inputBase} resize-none`}
            />
          </FieldRow>
        </div>

        {/* Final Confirmation */}
        <div className={`p-3 rounded-xl border ${
          verification?.verifiedByUserConfirmed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-muted bg-muted/20'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={verification?.verifiedByUserConfirmed || false}
              onChange={(e) => {
                const newStatus = e.target.checked ? 'VERIFIED' : 'PENDING';
                const updated: SaodTpVerification = { ...data.tpVerification, verifiedByUserConfirmed: e.target.checked, verificationStatus: newStatus as 'PENDING' | 'VERIFIED' | 'REJECTED' };
                onChange({ ...data, tpVerification: updated });
              }}
              className="h-4 w-4 rounded text-primary mt-0.5 cursor-pointer"
            />
            <div>
              <div className="text-xs font-black text-foreground">I have verified the active TP policy</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                By checking this, you confirm you have independently verified the TP policy details above. This verification is recorded in the compliance audit trail.
              </div>
              {verification?.verifiedByUserConfirmed && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-emerald-600">
                  <CheckCircle className="h-3 w-3" />
                  Confirmed at {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
          </label>
        </div>

        {!isVerified && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
              Complete all verification fields and check the confirmation box to proceed. The backend will reject SAOD quotations without verified active TP cover.
            </p>
          </div>
        )}
      </div>

      {/* OD Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Previous OD Insurer Name" conditional>
          <select value={data.previousODInsurerName} onChange={set('previousODInsurerName')} className={inputBase}>
            <option value="">— Select Insurer (Renewal) —</option>
            {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Previous OD Policy Number" conditional>
          <input type="text" value={data.previousODPolicyNumber} onChange={set('previousODPolicyNumber')} placeholder="Previous OD policy number" className={`${inputBase} font-mono`} />
        </FieldRow>
        <FieldRow label="Insured Declared Value (IDV) ₹" mandatory hint="Market value of vehicle — basis for OD premium">
          <input type="number" value={data.insuredDeclaredValue} onChange={set('insuredDeclaredValue')} placeholder="e.g. 850000" className={mandatoryInput(data.insuredDeclaredValue)} />
        </FieldRow>
        <FieldRow label="Claim in Expiring OD Policy?" mandatory hint="If Yes — NCB resets to 0%">
          <div className="flex gap-4 mt-1">
            {['Yes', 'No'].map((v) => (
              <label key={v} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input type="radio" name="claimSAOD" value={v} checked={data.claimInExpiringODPolicy === v} onChange={() => handleClaimChange(v)} className="h-3.5 w-3.5 text-primary" />
                {v}
              </label>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="No Claim Bonus (NCB) %" mandatory>
          <select
            value={data.ncbPercentage}
            onChange={(e) => handleNcbChange(e.target.value)}
            disabled={data.claimInExpiringODPolicy === 'Yes'}
            className={`${mandatoryInput(data.ncbPercentage)} ${data.claimInExpiringODPolicy === 'Yes' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">— Select NCB —</option>
            {NCB_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
          {data.claimInExpiringODPolicy === 'Yes' && <p className="text-[9px] text-rose-500 mt-0.5 font-bold">NCB reset to 0% — Claim reported</p>}
        </FieldRow>
      </div>

      {/* Premium Calculator */}
      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-black text-foreground">OD Premium Calculator</span>
          <span className="text-[9px] text-muted-foreground ml-1">OD = Insurer Filed Rate (not IRDAI tariff)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="OD Base Premium (₹)" mandatory hint="Insurer-specific OD rate applied to IDV" formula="IDV × Insurer OD Rate %">
            <input type="number" value={data.odPremiumBase} onChange={(e) => handleOdBaseChange(e.target.value)} placeholder="Enter base OD premium" className={mandatoryInput(data.odPremiumBase)} />
          </FieldRow>
          <FieldRow label="NCB Discount (₹)" hint="Auto-calculated from NCB %">
            <input type="number" value={data.ncbDiscountAmount} readOnly className={readonlyInput} placeholder="Auto-calculated" />
          </FieldRow>
          <FieldRow label="Add-ons Premium (₹)">
            <input type="number" value={data.addOnsPremium} onChange={(e) => handleAddOnsPremiumChange(e.target.value)} placeholder="Sum of add-on premiums" className={inputBase} />
          </FieldRow>
          <FieldRow label="Net OD Premium (₹)" hint="Auto-calc: OD Base - NCB + Add-ons">
            <input type="number" value={data.odPremium} readOnly className={readonlyInput} placeholder="Auto-calculated" />
          </FieldRow>
          <FieldRow label="GST Amount (18%) ₹" hint="Auto-calculated">
            <input type="number" value={data.gstAmount} readOnly className={readonlyInput} placeholder="Auto-calculated" />
          </FieldRow>
          <FieldRow label="Total Premium incl. GST (₹)" mandatory hint="System-generated — cannot be manually edited">
            <input type="number" value={data.totalPremiumInclGST} readOnly className={`${readonlyInput} font-black`} placeholder="Auto-calculated" />
          </FieldRow>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
          <FieldRow label="OD Commission %" mandatory hint="Insurer commission rate for OD">
            <input type="number" value={data.odCommissionPercent} onChange={(e) => handleCommissionChange(e.target.value)} placeholder="e.g. 15" min="0" max="100" className={mandatoryInput(data.odCommissionPercent)} />
          </FieldRow>
          <FieldRow label="Commission Amount (₹)" hint="Auto-calc: Net OD × Commission %">
            <input type="number" value={data.commissionAmount} readOnly className={readonlyInput} placeholder="Auto-calculated" />
          </FieldRow>
        </div>
      </div>

      {/* Add-ons */}
      <div className="p-3.5 rounded-xl border bg-card space-y-2">
        <label className="text-[11px] font-bold text-foreground block">Add-ons Selected <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ADDON_OPTIONS.map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer p-2 rounded-lg border hover:bg-accent transition-colors">
              <input type="checkbox" checked={(data.addonsSelected || []).includes(a.key)} onChange={() => toggleAddon(a.key)} className="h-3.5 w-3.5 rounded text-primary" />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      {/* Policy Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Policy Start Date" hint="Must be within the active TP period">
          <input type="date" value={data.policyStartDate} onChange={set('policyStartDate')} className={inputBase} />
        </FieldRow>
        <FieldRow label="Policy End Date">
          <input type="date" value={data.policyEndDate} onChange={set('policyEndDate')} className={inputBase} />
        </FieldRow>
      </div>

      {/* Commission Notes */}
      <FieldRow label="Commission / Discount Notes" mandatory hint="Employee notes on commission structure" formula="Net OD Premium × Commission %">
        <textarea rows={2} value={data.commissionDiscountCalc} onChange={set('commissionDiscountCalc')} placeholder="Commission details, special discounts..." className={`${mandatoryInput(data.commissionDiscountCalc)} resize-none`} />
      </FieldRow>
    </div>
  );
}

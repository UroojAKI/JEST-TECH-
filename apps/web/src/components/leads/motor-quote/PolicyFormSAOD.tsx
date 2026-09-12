'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Info, Calculator, Percent } from 'lucide-react';
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

    // Sum prices of selected addons (Field 9)
    const selectedAddons = updated.addonsSelected || [];
    const addOnsTotal = selectedAddons.reduce((sum, key) => {
      const price = parseFloat(updated.addonPrices?.[key] || '0') || 0;
      return sum + price;
    }, 0);

    const ncbDiscount = Math.round(odBase * (ncb / 100));
    const netOd = Math.max(0, odBase - ncbDiscount + addOnsTotal);
    const gst = calculateGst(netOd);
    const total = Math.round((netOd + gst) * 100) / 100;

    // Commission
    const commPct = parseFloat(updated.odCommissionPercent || '0') || 0;
    const commission = Math.round(netOd * (commPct / 100));

    // Field 13: Discount / Commission Calculator (Sum of 10* D% - 11)
    const dPct = parseFloat(updated.discountPercent || '0') || 0;
    const discountAmt = Math.round((netOd * (dPct / 100)) * 100) / 100;
    const finalPayable = Math.max(0, Math.round((total - discountAmt) * 100) / 100);
    const calcStr = discountAmt > 0
      ? `₹${discountAmt.toLocaleString('en-IN')} (Discount ${dPct}%: Final ₹${finalPayable.toLocaleString('en-IN')})`
      : `₹0 (Gross: ₹${total.toLocaleString('en-IN')})`;

    return {
      ...updated,
      addOnsPremium: addOnsTotal.toString(),
      ncbDiscountAmount: ncbDiscount.toString(),
      odPremium: netOd.toString(),
      gstAmount: gst.toString(),
      totalPremiumInclGST: total.toString(),
      commissionAmount: commission.toString(),
      discountAmount: discountAmt.toString(),
      finalPayableAmount: finalPayable.toString(),
      commissionDiscountCalc: calcStr,
    };
  };

  const handleOdBaseChange = (val: string) => onChange(recalcPremium({ ...data, odPremiumBase: val }));
  const handleNcbChange = (val: string) => onChange(recalcPremium({ ...data, ncbPercentage: val }));
  const handleCommissionChange = (val: string) => onChange(recalcPremium({ ...data, odCommissionPercent: val }));

  const handleClaimChange = (val: string) => {
    const ncb = val === 'Yes' ? '0' : data.ncbPercentage;
    onChange(recalcPremium({ ...data, claimInExpiringODPolicy: val, ncbPercentage: ncb }));
  };

  const toggleAddon = (key: string) => {
    const current = data.addonsSelected || [];
    const updated = current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
    onChange(recalcPremium({ ...data, addonsSelected: updated }));
  };

  const handleAddonPriceChange = (key: string, price: string) => {
    const updatedPrices = { ...(data.addonPrices || {}), [key]: price };
    onChange(recalcPremium({ ...data, addonPrices: updatedPrices }));
  };

  const handleDiscountPercentChange = (val: string) => {
    onChange(recalcPremium({ ...data, discountPercent: val }));
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

      {/* Field 9: Add-ons Selected with Individual Price Inputs */}
      <div className="p-3.5 rounded-xl border bg-card space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-foreground block">
            Add-ons Selected <span className="text-muted-foreground text-[9px] ml-1">(Field 9 — Optional)</span>
          </label>
          <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            Total Add-ons: ₹{Number(data.addOnsPremium || 0).toLocaleString('en-IN')}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Select add-ons and enter the amount for each. Amounts automatically calculate into the OD Premium.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ADDON_OPTIONS.map((a) => {
            const isSelected = (data.addonsSelected || []).includes(a.key);
            return (
              <div
                key={a.key}
                className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${
                  isSelected ? 'bg-primary/5 border-primary/40' : 'hover:bg-accent/40'
                }`}
              >
                <label className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAddon(a.key)}
                    className="h-3.5 w-3.5 rounded text-primary"
                  />
                  <span>{a.label}</span>
                </label>
                {isSelected && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      placeholder="Add-on Amount (₹)"
                      value={data.addonPrices?.[a.key] || ''}
                      onChange={(e) => handleAddonPriceChange(a.key, e.target.value)}
                      className="w-full p-1.5 rounded-md border text-xs font-mono font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Field 10 & 11: Premium Calculator Breakdown */}
      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-foreground">OD Premium Calculator (Fields 10 & 11)</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-semibold">OD Filed Rate + 18% GST</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <FieldRow label="OD Base Premium (₹)" mandatory hint="Insurer OD rate applied to IDV" formula="IDV × Insurer OD Rate %">
            <input type="number" value={data.odPremiumBase} onChange={(e) => handleOdBaseChange(e.target.value)} placeholder="Enter base OD premium" className={mandatoryInput(data.odPremiumBase)} />
          </FieldRow>
          <FieldRow label="NCB Discount (₹)" hint="Auto-calculated from NCB %">
            <input type="number" value={data.ncbDiscountAmount} readOnly className={readonlyInput} placeholder="Auto-calculated" />
          </FieldRow>
          <FieldRow label="Add-ons Premium (₹)" hint="Sum of individual add-on inputs">
            <input type="number" value={data.addOnsPremium} readOnly className={readonlyInput} placeholder="₹0" />
          </FieldRow>
          <FieldRow label="Net OD Premium (₹) [Field 10]" hint="Auto-calc: OD Base - NCB + Add-ons">
            <input type="number" value={data.odPremium} readOnly className={`${readonlyInput} font-bold text-foreground`} placeholder="Auto-calculated" />
          </FieldRow>
          <FieldRow label="Statutory GST (18%) ₹" hint="18% of Net OD Premium">
            <input type="number" value={data.gstAmount} readOnly className={readonlyInput} placeholder="Auto-calculated" />
          </FieldRow>
          <FieldRow label="Total Premium incl. GST (₹) [Field 11]" mandatory hint="System-calculated authoritative gross">
            <input type="number" value={data.totalPremiumInclGST} readOnly className={`${readonlyInput} font-black text-primary text-sm`} placeholder="Auto-calculated" />
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

      {/* Field 12: Policy Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Policy Start Date" hint="Must be within the active TP period">
          <input type="date" value={data.policyStartDate} onChange={set('policyStartDate')} className={inputBase} />
        </FieldRow>
        <FieldRow label="Policy End Date">
          <input type="date" value={data.policyEndDate} onChange={set('policyEndDate')} className={inputBase} />
        </FieldRow>
      </div>

      {/* Field 13: Commision/Discount Calculator (Document Formula: Sum of 10* D% - 11) */}
      <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-foreground">Commision / Discount Calculator</span>
            <span className="text-[9px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              IRDAI Formula: Sum of 10* D% - 11
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Field 13</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow
            label="Discount % (D%)"
            hint="Enter employee discount percentage"
            formula="OD Premium (10) × (D% / 100)"
          >
            <div className="relative">
              <input
                type="number"
                min="0"
                max="85"
                step="0.5"
                value={data.discountPercent || ''}
                onChange={(e) => handleDiscountPercentChange(e.target.value)}
                placeholder="e.g. 10"
                className={`${inputBase} pr-7 font-mono`}
              />
              <Percent className="h-3.5 w-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
            </div>
          </FieldRow>
          <FieldRow
            label="Discount Amount (₹)"
            hint="Deduction: Field 10 × D%"
            formula="Sum of 10 × D%"
          >
            <input
              type="number"
              value={data.discountAmount || '0'}
              readOnly
              className={`${readonlyInput} font-mono font-bold text-amber-600`}
              placeholder="₹0"
            />
          </FieldRow>
        </div>

        {/* Final Customer Net Payable Amount */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
              Final Net Payable by Customer
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Total Premium (Field 11) - Discount Amount (10 × D%)
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            ₹{Number(data.finalPayableAmount || data.totalPremiumInclGST || 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
}

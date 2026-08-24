'use client';

import React from 'react';
import { getPolicyTenureOptions, INSURER_OPTIONS } from './motorFormConfig';
import type { VehicleCategory, PolicyFormTPOnly } from './motorFormTypes';

import { useMotorCalculator } from './useMotorCalculator';

interface Props {
  category: VehicleCategory;
  vehicleStatus: 'NEW' | 'EXISTING';
  data: PolicyFormTPOnly;
  onChange: (data: PolicyFormTPOnly) => void;
}

const inputBase = 'w-full p-2 rounded-lg border text-xs font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-colors border-border';
const mandatoryInput = (val: string) =>
  `w-full p-2 rounded-lg border text-xs font-semibold bg-background focus:outline-none focus:ring-1 transition-colors ${
    !val ? 'border-rose-400 focus:ring-rose-400' : 'border-border focus:ring-primary'
  }`;

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

export function PolicyFormTPOnlyForm({ category, vehicleStatus, data, onChange }: Props) {
  const set = (key: keyof PolicyFormTPOnly) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });
  const setBool = (key: keyof PolicyFormTPOnly) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [key]: e.target.checked });

  const { result, loading, error } = useMotorCalculator({
    vehicleCategory: category,
    vehicleStatus: vehicleStatus,
    policyType: 'THIRD_PARTY_ONLY',
    policyTenure: parseInt(data.policyTenure || '1'),
    paCover: !!data.paCoverOwner,
    paidDriverLiability: data.legalLiabilityPaidDriver === 'Yes'
  });

  React.useEffect(() => {
    if (result && result.outputs) {
      onChange({ 
        ...data, 
        thirdPartyPremium: result.outputs.netTpPremium.toString(),
        totalPremiumInclGST: result.outputs.totalPremium.toString(),
        calculatedResult: result 
      });
    }
  }, [result]);

  const tenureOptions = getPolicyTenureOptions(category, 'TP_ONLY');

  return (
    <div className="space-y-4">
      {/* Policy Type Badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
        <span className="text-lg">🛡️</span>
        <div>
          <div className="text-xs font-black text-sky-700 dark:text-sky-400">Third Party (TP) Only — Liability Only</div>
          <div className="text-[10px] text-muted-foreground">Premium as per IRDAI notified tariff — non-editable</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Policy Tenure */}
        <FieldRow label="Policy Tenure" mandatory>
          <select value={data.policyTenure} onChange={set('policyTenure')} className={mandatoryInput(data.policyTenure)}>
            <option value="">— Select Tenure —</option>
            {tenureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>

        {/* TP Premium */}
        <FieldRow label="Third Party Premium (₹)" hint="As per IRDAI notified tariff — non-editable">
          <input
            type="number"
            value={data.thirdPartyPremium}
            onChange={set('thirdPartyPremium')}
            placeholder="Auto-filled from tariff"
            className={inputBase}
          />
        </FieldRow>

        {/* Previous TP Insurer */}
        <FieldRow label="Previous TP Insurer Name" conditional>
          <select value={data.previousTPInsurerName} onChange={set('previousTPInsurerName')} className={inputBase}>
            <option value="">— Select Insurer (Renewal) —</option>
            {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </FieldRow>

        {/* Previous TP Policy No */}
        <FieldRow label="Previous TP Policy Number" conditional>
          <input
            type="text"
            value={data.previousTPPolicyNumber}
            onChange={set('previousTPPolicyNumber')}
            placeholder="Previous policy number"
            className={`${inputBase} font-mono`}
          />
        </FieldRow>

        {/* Policy Start / End Date */}
        <FieldRow label="Policy Start Date">
          <input type="date" value={data.policyStartDate} onChange={set('policyStartDate')} className={inputBase} />
        </FieldRow>
        <FieldRow label="Policy End Date">
          <input type="date" value={data.policyEndDate} onChange={set('policyEndDate')} className={inputBase} />
        </FieldRow>
      </div>

      {/* PA Cover */}
      <div className="p-3 rounded-xl border bg-card flex items-start gap-3">
        <input
          type="checkbox"
          id="paCoverTP"
          checked={!!data.paCoverOwner}
          onChange={setBool('paCoverOwner')}
          className="mt-0.5 h-4 w-4 rounded text-primary"
        />
        <label htmlFor="paCoverTP" className="text-xs cursor-pointer">
          <span className="font-bold text-foreground">Personal Accident (PA) Cover — Owner / Owner-cum-Driver</span>
          <span className="text-rose-500 ml-0.5">*</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">Statutory cover unless already held. Sum Insured: ₹15 Lakh (standard)</p>
        </label>
      </div>

      {/* Legal Liability */}
      <FieldRow label="Legal Liability to Paid Driver / Cleaner" conditional hint="Applicable for commercial vehicles">
        <div className="flex gap-4 mt-1">
          {['Yes', 'No'].map((v) => (
            <label key={v} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="legalLiability"
                value={v}
                checked={data.legalLiabilityPaidDriver === v}
                onChange={set('legalLiabilityPaidDriver')}
                className="h-3.5 w-3.5 text-primary"
              />
              {v}
            </label>
          ))}
        </div>
      </FieldRow>

      {/* Premium Split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Total Premium (incl. GST) ₹" hint="Calculated by backend rule engine">
          <input
            type="number"
            value={data.totalPremiumInclGST || ''}
            readOnly
            className="w-full p-2 rounded-lg border text-xs font-semibold bg-muted focus:outline-none focus:ring-1 focus:ring-primary transition-colors border-border opacity-70"
          />
        </FieldRow>
        <FieldRow label="Premium Breakdown" hint="Auto-calculated">
          <div className="p-2 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 font-bold text-sm">
            {data.totalPremiumInclGST ? `₹${data.totalPremiumInclGST}` : '₹0'}
            <span className="text-[10px] ml-2 text-sky-600 font-normal">
              (TP: ₹{data.calculatedResult?.outputs?.netTpPremium || 0} | GST: ₹{data.calculatedResult?.outputs?.totalGst || 0})
            </span>
          </div>
        </FieldRow>
      </div>

      {/* Commission Calculator */}
      <FieldRow
        label="Commission / Discount Calculator (₹)"
        mandatory
        hint="Filled by employee"
        formula="(TP Premium + PA Cover + Legal Liability) × D% − Total Premium"
      >
        <textarea
          rows={2}
          value={data.commissionDiscountCalc}
          onChange={set('commissionDiscountCalc')}
          placeholder="Enter commission / discount calculation details..."
          className={`${mandatoryInput(data.commissionDiscountCalc)} resize-none`}
        />
      </FieldRow>
    </div>
  );
}

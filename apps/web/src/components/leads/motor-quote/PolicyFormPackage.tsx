'use client';

import React from 'react';
import { getPolicyTenureOptions, INSURER_OPTIONS, NCB_OPTIONS, ADDON_OPTIONS } from './motorFormConfig';
import type { VehicleCategory, PolicyFormPackage } from './motorFormTypes';

interface Props {
  category: VehicleCategory;
  data: PolicyFormPackage;
  onChange: (data: PolicyFormPackage) => void;
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

export function PolicyFormPackageForm({ category, data, onChange }: Props) {
  const set = (key: keyof PolicyFormPackage) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });
  const setBool = (key: keyof PolicyFormPackage) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [key]: e.target.checked });

  const handleClaimChange = (val: string) => {
    const updated = { ...data, claimInExpiringPolicy: val };
    if (val === 'Yes') updated.ncbPercentage = '0';
    onChange(updated);
  };

  const toggleAddon = (key: string) => {
    const current = data.addonsSelected || [];
    const updated = current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
    onChange({ ...data, addonsSelected: updated });
  };

  const tenureOptions = getPolicyTenureOptions(category, 'PACKAGE');
  const isCommercial = !['BIKE', 'PRIVATE_CAR'].includes(category);

  return (
    <div className="space-y-4">
      {/* Policy Type Badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <span className="text-lg">⚡</span>
        <div>
          <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">Package / Comprehensive (OD + TP Combined)</div>
          <div className="text-[10px] text-muted-foreground">
            {isCommercial ? 'Note: TP GST (12%) and OD GST (18%) are calculated separately' : 'Single policy covers both Own Damage and Third Party liability'}
          </div>
        </div>
      </div>

      {isCommercial && (
        <div className="p-2.5 rounded-lg border border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10">
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
            ⚠️ Commercial Vehicle: TP GST = 12% | OD GST = 18% — calculated separately in total premium
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Policy Tenure */}
        <FieldRow label="Policy Tenure">
          <select value={data.policyTenure} onChange={set('policyTenure')} className={inputBase}>
            <option value="">— Select Tenure —</option>
            {tenureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>

        {/* IDV */}
        <FieldRow label="Insured Declared Value (IDV) ₹" mandatory hint="System calculated / editable within permissible range">
          <input type="number" value={data.insuredDeclaredValue} onChange={set('insuredDeclaredValue')} placeholder="e.g. 850000" className={mandatoryInput(data.insuredDeclaredValue)} />
        </FieldRow>

        {/* Claim in Expiring Policy */}
        <FieldRow label="Claim in Expiring Policy?" mandatory hint="If Yes → NCB resets to 0%">
          <div className="flex gap-4 mt-1">
            {['Yes', 'No'].map((v) => (
              <label key={v} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="claimPackage"
                  value={v}
                  checked={data.claimInExpiringPolicy === v}
                  onChange={() => handleClaimChange(v)}
                  className="h-3.5 w-3.5 text-primary"
                />
                {v}
              </label>
            ))}
          </div>
        </FieldRow>

        {/* NCB */}
        <FieldRow label="No Claim Bonus (NCB) %" mandatory>
          <select
            value={data.ncbPercentage}
            onChange={set('ncbPercentage')}
            disabled={data.claimInExpiringPolicy === 'Yes'}
            className={`${mandatoryInput(data.ncbPercentage)} ${data.claimInExpiringPolicy === 'Yes' ? 'opacity-50 cursor-not-allowed bg-muted' : ''}`}
          >
            <option value="">— Select NCB —</option>
            {NCB_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
          {data.claimInExpiringPolicy === 'Yes' && (
            <p className="text-[9px] text-rose-500 mt-0.5 font-bold">NCB reset to 0% — Claim reported</p>
          )}
        </FieldRow>

        {/* Previous Insurer — Renewal */}
        <FieldRow label="Previous Insurer Name" conditional>
          <select value={data.previousInsurerName} onChange={set('previousInsurerName')} className={inputBase}>
            <option value="">— Select Insurer (Renewal) —</option>
            {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Previous Policy Number" conditional>
          <input type="text" value={data.previousPolicyNumber} onChange={set('previousPolicyNumber')} placeholder="Previous policy number" className={`${inputBase} font-mono`} />
        </FieldRow>

        {/* Premiums */}
        <FieldRow label="Own Damage (OD) Premium ₹" mandatory>
          <input type="number" value={data.ownDamagePremium} onChange={set('ownDamagePremium')} placeholder="Enter OD premium" className={mandatoryInput(data.ownDamagePremium)} />
        </FieldRow>
        <FieldRow label="Third Party (TP) Premium ₹" mandatory hint="As per IRDAI notified tariff">
          <input type="number" value={data.thirdPartyPremium} onChange={set('thirdPartyPremium')} placeholder="As per IRDAI tariff" className={mandatoryInput(data.thirdPartyPremium)} />
        </FieldRow>

        {/* Policy Dates */}
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
          id="paCoverPackage"
          checked={!!data.paCoverOwner}
          onChange={setBool('paCoverOwner')}
          className="mt-0.5 h-4 w-4 rounded text-primary"
        />
        <label htmlFor="paCoverPackage" className="text-xs cursor-pointer">
          <span className="font-bold text-foreground">Personal Accident (PA) Cover — Owner / Owner-cum-Driver</span>
          <span className="text-rose-500 ml-0.5">*</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">Statutory unless already held. Sum Insured: ₹15 Lakh (standard)</p>
        </label>
      </div>

      {/* Add-ons */}
      <div className="p-3.5 rounded-xl border bg-card space-y-2">
        <label className="text-[11px] font-bold text-foreground block">
          Add-ons Selected <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ADDON_OPTIONS.map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer p-2 rounded-lg border hover:bg-accent transition-colors">
              <input
                type="checkbox"
                checked={(data.addonsSelected || []).includes(a.key)}
                onChange={() => toggleAddon(a.key)}
                className="h-3.5 w-3.5 rounded text-primary"
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      {/* Premium Split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Base Premium (OD + TP + PA + Add-ons) ₹" mandatory hint="Enter total premium before GST">
          <input
            type="number"
            value={data.totalPremiumInclGST ? Math.round(parseFloat(data.totalPremiumInclGST) / 1.18) : ''}
            onChange={(e) => {
              const base = parseFloat(e.target.value);
              if (isNaN(base)) {
                set('totalPremiumInclGST')({ target: { value: '' } } as any);
              } else {
                const total = Math.round(base * 1.18).toString();
                set('totalPremiumInclGST')({ target: { value: total } } as any);
              }
            }}
            placeholder="e.g. 15000"
            className={mandatoryInput(data.totalPremiumInclGST)}
          />
        </FieldRow>
        <FieldRow label="Total Premium (incl. 18% GST) ₹" hint="Auto-calculated">
          <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-sm">
            {data.totalPremiumInclGST ? `₹${data.totalPremiumInclGST}` : '₹0'}
            <span className="text-[10px] ml-2 text-emerald-600 font-normal">
              (GST: ₹{data.totalPremiumInclGST ? Math.round(parseFloat(data.totalPremiumInclGST) - (parseFloat(data.totalPremiumInclGST) / 1.18)) : 0})
            </span>
          </div>
        </FieldRow>
      </div>

      {/* Commission Calculators — 3 separate fields */}
      <div className="space-y-3 p-3.5 rounded-xl border bg-muted/20">
        <p className="text-[11px] font-black text-foreground">Commission / Discount Calculators</p>

        <FieldRow
          label="TP Commission / Discount Calculator ₹"
          mandatory
          hint="Filled by employee"
          formula="(TP Premium + PA Cover) × D% − (TP + PA Cover)"
        >
          <textarea
            rows={1}
            value={data.tpCommissionCalc}
            onChange={set('tpCommissionCalc')}
            placeholder="TP commission calculation..."
            className={`${mandatoryInput(data.tpCommissionCalc)} resize-none`}
          />
        </FieldRow>

        <FieldRow
          label="OD Commission / Discount Calculator ₹"
          mandatory
          hint="Filled by employee"
          formula="OD Premium × D% − OD Premium"
        >
          <textarea
            rows={1}
            value={data.odCommissionCalc}
            onChange={set('odCommissionCalc')}
            placeholder="OD commission calculation..."
            className={`${mandatoryInput(data.odCommissionCalc)} resize-none`}
          />
        </FieldRow>

        <FieldRow
          label="Final Commission / Discount Calculator ₹"
          mandatory
          hint="Filled by employee"
          formula="(OD + TP + PA) − (TP Commission + OD Commission)"
        >
          <textarea
            rows={1}
            value={data.finalCommissionCalc}
            onChange={set('finalCommissionCalc')}
            placeholder="Final commission calculation..."
            className={`${mandatoryInput(data.finalCommissionCalc)} resize-none`}
          />
        </FieldRow>
      </div>
    </div>
  );
}

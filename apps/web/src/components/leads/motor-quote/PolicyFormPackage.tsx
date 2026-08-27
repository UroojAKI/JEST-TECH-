'use client';

import React, { useEffect } from 'react';
import { getPolicyTenureOptions, INSURER_OPTIONS, NCB_OPTIONS, ADDON_OPTIONS } from './motorFormConfig';
import type { VehicleCategory, PolicyFormPackage } from './motorFormTypes';
import { useMotorCalculator } from './useMotorCalculator';

interface Props {
  category: VehicleCategory;
  vehicleStatus: 'NEW' | 'EXISTING';
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

export function PolicyFormPackageForm({ category, vehicleStatus, data, onChange }: Props) {
  const set = (key: keyof PolicyFormPackage) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });
  const setBool = (key: keyof PolicyFormPackage) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [key]: e.target.checked });

  const { result, loading, error } = useMotorCalculator({
    vehicleCategory: category,
    vehicleStatus: vehicleStatus,
    policyType: 'PACKAGE_COMPREHENSIVE',
    policyTenure: parseInt(data.policyTenure || '1'),
    idv: parseFloat(data.insuredDeclaredValue || '0'),
    ncbPercent: parseInt(data.ncbPercentage || '0'),
    claimInExpiringPolicy: data.claimInExpiringPolicy === 'Yes',
    paCover: true,
    paidDriverLiability: false,
    addons: (data.addonsSelected || []).map(a => ({
      addonCode: a,
      manualPrice: data.addonPrices?.[a] ? parseFloat(data.addonPrices[a]) : undefined
    }))
  });

  useEffect(() => {
    if (result && result.outputs) {
      onChange({ 
        ...data, 
        totalPremiumInclGST: result.outputs.totalPremium.toString(),
        calculatedResult: result 
      });
    }
  }, [result]);

  useEffect(() => {
    const rawOd = data.calculatedResult?.outputs?.netOdPremium || 0;
    const rawTp = data.calculatedResult?.outputs?.netTpPremium || 0;
    
    const odDiscountPct = parseFloat(data.odCommissionCalc) || 0;
    const tpDiscountPct = parseFloat(data.tpCommissionCalc) || 0;

    const odDiscountAmt = Math.round(rawOd * (odDiscountPct / 100) * 100) / 100;
    const tpDiscountAmt = Math.round(rawTp * (tpDiscountPct / 100) * 100) / 100;
    const totalDiscountAmt = Math.round((odDiscountAmt + tpDiscountAmt) * 100) / 100;

    const discountedOd = Math.max(0, rawOd - odDiscountAmt);
    const discountedTp = Math.max(0, rawTp - tpDiscountAmt);
    const preTaxNetBase = Math.round((discountedOd + discountedTp) * 100) / 100;

    const isCommercial = !['BIKE', 'PRIVATE_CAR'].includes(category);
    let totalGst = 0;
    if (isCommercial) {
      totalGst = Math.round(((discountedOd * 0.18) + (discountedTp * 0.12)) * 100) / 100;
    } else {
      totalGst = Math.round((preTaxNetBase * 0.18) * 100) / 100;
    }

    const finalPayable = Math.round((preTaxNetBase + totalGst) * 100) / 100;

    if (
      data.finalCommissionCalc !== totalDiscountAmt.toFixed(2) ||
      data.finalPayableAmount !== finalPayable.toFixed(2) ||
      data.finalGstAmount !== totalGst.toFixed(2)
    ) {
      onChange({ 
        ...data, 
        finalCommissionCalc: totalDiscountAmt.toFixed(2),
        finalPayableAmount: finalPayable.toFixed(2),
        finalGstAmount: totalGst.toFixed(2)
      });
    }
  }, [data.tpCommissionCalc, data.odCommissionCalc, data.calculatedResult, category]);

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

  const rawOd = data.calculatedResult?.outputs?.netOdPremium || 0;
  const rawTp = data.calculatedResult?.outputs?.netTpPremium || 0;
  const grossBase = rawOd + rawTp;
  const discountAmt = parseFloat(data.finalCommissionCalc || '0');
  const netBase = Math.max(0, grossBase - discountAmt);
  const gstAmt = parseFloat(data.finalGstAmount || (netBase * 0.18).toFixed(2));
  const finalPayable = parseFloat(data.finalPayableAmount || (netBase + gstAmt).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Policy Type Badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <span className="text-lg">⚡</span>
        <div>
          <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">Package / Comprehensive (OD + TP Combined)</div>
          <div className="text-[10px] text-muted-foreground">
            {isCommercial ? 'Commercial Vehicle: TP GST (12%) and OD GST (18%) calculated separately' : 'Standard policy covering Own Damage, Third Party liability, and Owner-Driver PA'}
          </div>
        </div>
        {loading && <div className="ml-auto text-xs text-primary animate-pulse">Calculating...</div>}
        {error && <div className="ml-auto text-xs text-destructive">{error}</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Policy Tenure */}
        <FieldRow label="Policy Tenure">
          <select value={data.policyTenure} onChange={set('policyTenure')} className={inputBase}>
            <option value="">— Select Tenure —</option>
            {tenureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>

        {/* IDV */}
        <FieldRow label="Insured Declared Value (IDV) ₹" mandatory hint="Vehicle market value">
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
                  className="text-primary focus:ring-primary"
                />
                {v}
              </label>
            ))}
          </div>
        </FieldRow>

        {/* NCB % */}
        <FieldRow label="No Claim Bonus (NCB) %" mandatory hint={data.claimInExpiringPolicy === 'Yes' ? 'Reset to 0% due to claim' : 'Discount on OD Base'}>
          <select
            value={data.ncbPercentage}
            onChange={set('ncbPercentage')}
            disabled={data.claimInExpiringPolicy === 'Yes'}
            className={mandatoryInput(data.ncbPercentage)}
          >
            <option value="">— Select NCB % —</option>
            {NCB_OPTIONS.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>

      {/* Add-ons */}
      <div className="p-3.5 rounded-xl border bg-card space-y-2">
        <label className="text-[11px] font-bold text-foreground block">
          Add-on Covers <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ADDON_OPTIONS.map((a) => {
            const isSelected = (data.addonsSelected || []).includes(a.key);
            return (
              <div key={a.key} className={`flex flex-col gap-1 p-2 rounded-lg border transition-colors ${isSelected ? 'bg-accent border-primary/50' : 'hover:bg-accent/50'}`}>
                <label className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAddon(a.key)}
                    className="h-3.5 w-3.5 rounded text-primary"
                  />
                  {a.label}
                </label>
                {isSelected && (
                  <input
                    type="number"
                    placeholder="Manual Price (₹) - Optional"
                    value={data.addonPrices?.[a.key] || ''}
                    onChange={(e) => onChange({ ...data, addonPrices: { ...data.addonPrices, [a.key]: e.target.value } })}
                    className="mt-1 w-full p-1.5 rounded-md border text-[10px] bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Discount Percentage Inputs */}
      <div className="space-y-3 p-3.5 rounded-xl border bg-muted/10">
        <p className="text-[11px] font-black text-foreground">Discounts & Commission Percentages</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow
            label="Own Damage (OD) Discount (%)"
            hint="Deducted from OD Base prior to tax"
            formula="OD Net × (Discount % / 100)"
          >
            <input
              type="number"
              min="0"
              max="85"
              step="0.5"
              value={data.odCommissionCalc || ''}
              onChange={set('odCommissionCalc')}
              placeholder="e.g. 10%"
              className={inputBase}
            />
          </FieldRow>

          <FieldRow
            label="Third Party (TP) Discount (%)"
            hint="Deducted from TP Base prior to tax (if permitted)"
            formula="TP Net × (Discount % / 100)"
          >
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={data.tpCommissionCalc || ''}
              onChange={set('tpCommissionCalc')}
              placeholder="e.g. 0%"
              className={inputBase}
            />
          </FieldRow>
        </div>
      </div>

      {/* Live Financial Breakdown & Total Paying Amount Card */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="p-3.5 border-b bg-muted/20 flex items-center justify-between">
          <span className="text-xs font-black text-foreground">Authoritative Premium Calculation Breakdown</span>
          <span className="text-[10px] font-semibold text-muted-foreground">IRDAI Tariff Compliant</span>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-xl border bg-muted/10">
              <span className="text-[10px] text-muted-foreground block font-medium">Gross Base Premium</span>
              <span className="text-sm font-bold text-foreground">₹{grossBase.toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-muted-foreground block">OD: ₹{rawOd} | TP: ₹{rawTp}</span>
            </div>

            <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20">
              <span className="text-[10px] text-amber-800 dark:text-amber-300 block font-medium">Total Discount Amount</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">-₹{discountAmt.toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-amber-700/80 block">Applied pre-tax</span>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/10">
              <span className="text-[10px] text-muted-foreground block font-medium">Pre-Tax Net Premium</span>
              <span className="text-sm font-bold text-foreground">₹{netBase.toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-muted-foreground block">Taxable Base</span>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/10">
              <span className="text-[10px] text-muted-foreground block font-medium">GST / Tax (18%)</span>
              <span className="text-sm font-bold text-foreground">+₹{gstAmt.toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-muted-foreground block">Post-discount</span>
            </div>
          </div>

          {/* Final Total Paying Amount */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                Final Total Payable Amount
              </span>
              <span className="text-[10px] text-muted-foreground">
                Authoritative amount to be collected from customer (Net Base + GST)
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              ₹{finalPayable.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

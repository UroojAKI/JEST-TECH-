'use client';

import React, { useEffect, useRef } from 'react';
import { getPolicyTenureOptions, INSURER_OPTIONS, NCB_OPTIONS, ADDON_OPTIONS } from './motorFormConfig';
import type { VehicleCategory, PolicyFormPackage, MotorEligibilityContext } from './motorFormTypes';
import { useMotorCalculator } from './useMotorCalculator';
import { GstRateSelector } from './GstRateSelector';
import { NcbSlider } from './NcbSlider';
import { OverrideFieldCard } from './OverrideFieldCard';

interface Props {
  category: VehicleCategory;
  vehicleStatus: 'NEW' | 'EXISTING';
  data: PolicyFormPackage;
  onChange: (data: PolicyFormPackage) => void;
  /** Canonical eligibility context computed by MotorQuoteWizard. When not provided,
   * falls back to vehicleStatus for backward compatibility. */
  eligibility?: MotorEligibilityContext;
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

export function PolicyFormPackageForm({ category, vehicleStatus, data, onChange, eligibility }: Props) {
  const set = (key: keyof PolicyFormPackage) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });
  const setBool = (key: keyof PolicyFormPackage) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [key]: e.target.checked });

  // Derive effective eligibility — prefer canonical context, fall back to vehicleStatus prop
  const isNew = eligibility ? eligibility.vehicleStatus === 'NEW' : vehicleStatus === 'NEW';
  const prevPolicyApplicable = eligibility ? eligibility.previousPolicyApplicable : !isNew;
  const ncbApplicable = eligibility ? eligibility.ncbApplicable : !isNew;
  const claimHistoryApplicable = eligibility ? eligibility.claimHistoryApplicable : !isNew;

  // Clear non-applicable fields from state when context changes (prevent stale previous-policy data)
  useEffect(() => {
    if (!prevPolicyApplicable) {
      let changed = false;
      const update: Partial<PolicyFormPackage> = {};
      if (data.previousInsurerName) { update.previousInsurerName = ''; changed = true; }
      if (data.previousPolicyNumber) { update.previousPolicyNumber = ''; changed = true; }
      if (changed) onChange({ ...data, ...update });
    }
    if (!ncbApplicable && data.ncbPercentage && data.ncbPercentage !== '0') {
      onChange({ ...data, ncbPercentage: '0' });
    }
    if (!claimHistoryApplicable && data.claimInExpiringPolicy === 'Yes') {
      onChange({ ...data, claimInExpiringPolicy: 'No' });
    }
  // Only run when eligibility context changes, not on every data change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, prevPolicyApplicable, ncbApplicable, claimHistoryApplicable]);

  useEffect(() => {
    if (data.odCommissionCalc || data.tpCommissionCalc || data.finalCommissionCalc) {
      onChange({ ...data, odCommissionCalc: '', tpCommissionCalc: '', finalCommissionCalc: '' });
    }
    // Clear legacy fields once when a quote is opened; discounts must never represent commission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { result, loading, error } = useMotorCalculator({
    vehicleCategory: category,
    vehicleStatus: vehicleStatus,
    policyType: 'PACKAGE_COMPREHENSIVE',
    policyTenure: parseInt(data.policyTenure || '1') || 1,
    idv: parseFloat(data.insuredDeclaredValue || '0') || 0,
    ncbPercent: parseInt(data.ncbPercentage || '0') || 0,
    claimInExpiringPolicy: data.claimInExpiringPolicy === 'Yes',
    paCover: data.paCoverOwner !== false,
    paidDriverLiability: false,
    // Phase 3 canonical: fixed ₹ commercial adjustment (supersedes percentage if set)
    ...(data.commercialAdjustmentAmount !== undefined && data.commercialAdjustmentAmount !== '' && !isNaN(parseFloat(data.commercialAdjustmentAmount))
      ? {
          commercialAdjustment: parseFloat(data.commercialAdjustmentAmount),
          commercialAdjustmentAmount: parseFloat(data.commercialAdjustmentAmount),
        }
      : {
          discountPercent: parseFloat(data.commercialDiscountPercent || '0') || 0,
          commercialDiscountPercent: parseFloat(data.commercialDiscountPercent || '0') || 0,
        }),
    commercialAdjustmentDirection: data.commercialAdjustmentDirection || 'SUBTRACT',
    discountReason: data.discountReason || undefined,
    odDiscountPercent: parseFloat(data.odDiscountPercent || '0') || 0,
    tpDiscountPercent: parseFloat(data.tpDiscountPercent || '0') || 0,
    gstRate: data.gstRate ? parseInt(data.gstRate) : 18,
    odGstRate: data.odGstRate ? parseInt(data.odGstRate) : (data.gstRate ? parseInt(data.gstRate) : 18),
    tpGstRate: data.tpGstRate ? parseInt(data.tpGstRate) : (data.gstRate ? parseInt(data.gstRate) : 18),
    paGstRate: data.paGstRate ? parseInt(data.paGstRate) : (data.gstRate ? parseInt(data.gstRate) : 18),
    // Field 1: OD Base Premium override
    ...((data.odPremiumAmount !== undefined && data.odPremiumAmount !== '' && !isNaN(parseFloat(data.odPremiumAmount)))
      ? {
          odPremium: parseFloat(data.odPremiumAmount),
          odPremiumAmount: parseFloat(data.odPremiumAmount),
          odBasePremium: parseFloat(data.odPremiumAmount),
        }
      : (data.odBasePremiumOverride !== undefined && data.odBasePremiumOverride !== '' && !isNaN(parseFloat(data.odBasePremiumOverride))
          ? {
              odPremium: parseFloat(data.odBasePremiumOverride),
              odPremiumAmount: parseFloat(data.odBasePremiumOverride),
              odBasePremium: parseFloat(data.odBasePremiumOverride),
            }
          : {})),
    // Field 2: NCB Discount override
    ...(data.ncbDiscountOverride !== undefined && data.ncbDiscountOverride !== '' && !isNaN(parseFloat(data.ncbDiscountOverride))
      ? { ncbDiscount: parseFloat(data.ncbDiscountOverride) }
      : {}),
    // Field 3: Add-on Premium override
    ...(data.addonPremiumOverride !== undefined && data.addonPremiumOverride !== '' && !isNaN(parseFloat(data.addonPremiumOverride))
      ? { addonPremium: parseFloat(data.addonPremiumOverride) }
      : {}),
    // Field 4: Net OD Premium override (Field 10)
    ...(data.netOdPremiumOverride !== undefined && data.netOdPremiumOverride !== '' && !isNaN(parseFloat(data.netOdPremiumOverride))
      ? { netOdPremium: parseFloat(data.netOdPremiumOverride) }
      : {}),
    // Field 5: Statutory GST override
    ...(data.gstAmountOverride !== undefined && data.gstAmountOverride !== '' && !isNaN(parseFloat(data.gstAmountOverride))
      ? { gstAmount: parseFloat(data.gstAmountOverride) }
      : {}),
    // Field 6: Total Premium override (Field 11)
    ...(data.totalPremiumOverride !== undefined && data.totalPremiumOverride !== '' && !isNaN(parseFloat(data.totalPremiumOverride))
      ? { totalPremiumOverride: parseFloat(data.totalPremiumOverride) }
      : {}),
    annualTpPremium: data.editedTpPremium !== undefined && data.editedTpPremium !== '' && !isNaN(parseFloat(data.editedTpPremium))
      ? parseFloat(data.editedTpPremium)
      : undefined,
    editedTpAnnualPremium: data.editedTpPremium !== undefined && data.editedTpPremium !== '' && !isNaN(parseFloat(data.editedTpPremium))
      ? parseFloat(data.editedTpPremium)
      : undefined,
    editedTpPremium: data.editedTpPremium !== undefined && data.editedTpPremium !== '' && !isNaN(parseFloat(data.editedTpPremium))
      ? parseFloat(data.editedTpPremium)
      : undefined,
    editedPaPremium: data.editedPaPremium !== undefined && data.editedPaPremium !== '' && !isNaN(parseFloat(data.editedPaPremium))
      ? parseFloat(data.editedPaPremium)
      : undefined,
    addons: (data.addonsSelected || [])
      .filter((addonCode) => data.addonPrices?.[addonCode] && parseFloat(data.addonPrices[addonCode]) > 0)
      .map((addonCode) => ({
        addonCode,
        editedPrice: parseFloat(data.addonPrices![addonCode]),
        ...(data.addonDiscounts?.[addonCode] !== undefined && data.addonDiscounts[addonCode] !== ''
          ? { discountPercent: parseFloat(data.addonDiscounts[addonCode]) }
          : {}),
        ...(data.addonGstRates?.[addonCode] !== undefined && data.addonGstRates[addonCode] !== ''
          ? { gstRate: parseInt(data.addonGstRates[addonCode]) }
          : {}),
      })),
  });

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (error && dataRef.current.calculatedResult) {
      const current = dataRef.current;
      onChange({
        ...current,
        calculatedResult: undefined,
        totalPremiumInclGST: current.totalPremiumOverride ?? '',
        finalPayableAmount: current.totalPremiumOverride ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (result && result.outputs) {
      const current = dataRef.current;
      const outputs = result.outputs;
      const payableTotal = (outputs.finalPayableAmount ?? outputs.totalPremium ?? 0).toString();
      onChange({ 
        ...current, 
        totalPremiumInclGST: current.totalPremiumOverride ?? payableTotal,
        finalPayableAmount: current.totalPremiumOverride ?? payableTotal,
        finalGstAmount: current.gstAmountOverride ?? (outputs.totalGst ?? 0).toString(),
        odCommissionCalc: '',
        tpCommissionCalc: '',
        finalCommissionCalc: '',
        gstRate: (result.rateConfig?.gstRatePercent ?? (current.gstRate ? parseInt(current.gstRate) : 18)).toString(),
        odGstRate: (result.rateConfig?.odGstRatePercent ?? (current.odGstRate ? parseInt(current.odGstRate) : (current.gstRate ? parseInt(current.gstRate) : 18))).toString(),
        tpGstRate: (result.rateConfig?.tpGstRatePercent ?? (current.tpGstRate ? parseInt(current.tpGstRate) : (current.gstRate ? parseInt(current.gstRate) : 18))).toString(),
        paGstRate: (result.rateConfig?.paGstRatePercent ?? (current.paGstRate ? parseInt(current.paGstRate) : (current.gstRate ? parseInt(current.gstRate) : 18))).toString(),
        calculatedResult: result 
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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

  // Authoritative Backend Calculation Outputs (Single Source of Truth)
  const hasValidCalculation = !loading && !error && Boolean(result);
  const outputs = hasValidCalculation ? (result?.outputs || {}) : {};
  const rawOd = outputs.od?.gross ?? outputs.baseOdPremium ?? 0;
  const rawTp = outputs.tp?.gross ?? outputs.tp?.base ?? outputs.baseTpPremium ?? 0;
  const grossBase = outputs.summary?.grossPremium ?? outputs.grossBasePremium ?? (rawOd + rawTp);
  const gstAmt = outputs.summary?.totalGst ?? outputs.totalGst ?? outputs.gstAmount ?? 0;
  const payableSummary = outputs.payableSummary || {};
  const payableBase = outputs.summary?.payableBase ?? payableSummary.payableBase ?? (grossBase + gstAmt);
  const odDiscountAmount = outputs.od?.discount ?? outputs.od?.specialDiscount ?? outputs.odDiscountAmount ?? outputs.specialDiscount ?? 0;
  const tpDiscountAmount = outputs.tp?.discount ?? outputs.tpDiscountAmount ?? 0;
  const commDiscount = outputs.summary?.commercialDiscountAmount ?? outputs.commercialDiscountAmount ?? payableSummary.commercialDiscount?.amount ?? 0;
  const totalDiscount = outputs.summary?.totalDiscount ?? outputs.totalDiscount ?? (odDiscountAmount + tpDiscountAmount + commDiscount);
  const itemizedAddons: any[] = Array.isArray(outputs.itemizedAddons) ? outputs.itemizedAddons : [];
  const finalPayable = hasValidCalculation
    ? Number(outputs.summary?.finalPayable ?? outputs.finalPayableAmount ?? outputs.totalPremium ??
        ((data.finalPayableAmount ? parseFloat(data.finalPayableAmount) : 0) ||
          (data.totalPremiumInclGST ? parseFloat(data.totalPremiumInclGST) : 0)))
    : null;

  return (
    <div className="space-y-4">
      {/* Policy Type Badge */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <span className="text-lg">⚡</span>
        <div>
          <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">Package / Comprehensive (OD + TP Combined)</div>
          <div className="text-[10px] text-muted-foreground">
            {isCommercial ? 'Commercial vehicle: premium components are calculated by the server; applicable tax treatment must come from approved tax configuration' : 'Standard policy covering Own Damage, Third Party liability, and Owner-Driver PA'}
          </div>
        </div>
        {loading && <div className="ml-auto text-xs text-primary animate-pulse">Calculating...</div>}
        {error && <div className="ml-auto text-xs text-destructive">{error}</div>}
      </div>

      {/* 1. Policy Tenure & IDV */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Policy Tenure */}
        <FieldRow label="Policy Tenure" mandatory>
          <select value={data.policyTenure} onChange={set('policyTenure')} className={mandatoryInput(data.policyTenure)}>
            <option value="">— Select Tenure —</option>
            {tenureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>

        {/* IDV */}
        <FieldRow label="Insured Declared Value (IDV) ₹" mandatory hint="Vehicle market value">
          <input type="number" value={data.insuredDeclaredValue} onChange={set('insuredDeclaredValue')} placeholder="e.g. 850000" className={mandatoryInput(data.insuredDeclaredValue)} />
        </FieldRow>
      </div>

      {/* 2. Component-Level Tariff & Tax Calculation — Positioned directly under IDV */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden space-y-0">
        <div className="p-3.5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black text-foreground block">Component-Level Tariff & Tax Calculation</span>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Statutory IRDAI rule: Tax is itemized per component on Gross Base (OD Gross → OD GST, TP Gross → TP GST)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              GST Base = GROSS
            </span>
            <GstRateSelector
              value={data.gstRate}
              onChange={(rate) => onChange({ ...data, gstRate: rate, odGstRate: rate, tpGstRate: rate, paGstRate: rate })}
            />
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Component 1: Own Damage (OD) */}
          <div className="p-3 rounded-xl border bg-accent/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-foreground">1. Own Damage (OD)</span>
                {(data.odPremiumAmount || data.editedOdGross || data.editedOdRate) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-300">
                    [Edited]
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium">
                  Tariff Rate: <strong className="text-foreground">{result?.rateConfig?.systemOdRate ? `${result.rateConfig.systemOdRate}%` : '—'}</strong>
                </span>
                {(data.odPremiumAmount || data.editedOdGross || data.editedOdRate) && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, odPremiumAmount: undefined, editedOdGross: undefined, editedOdRate: undefined })}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline"
                  >
                    Reset to System
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {/* OD Premium (Direct ₹ Input) */}
              <div className="p-2.5 rounded-lg bg-card border space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">OD Premium (₹)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder={hasValidCalculation ? String(Math.round(outputs.od?.gross ?? rawOd)) : 'OD Premium ₹'}
                  value={data.odPremiumAmount ?? data.editedOdGross ?? ''}
                  onChange={(e) => {
                    const strVal = e.target.value;
                    if (strVal === '') {
                      onChange({ ...data, odPremiumAmount: undefined, editedOdGross: undefined, editedOdRate: undefined });
                    } else {
                      onChange({ ...data, odPremiumAmount: strVal, editedOdGross: undefined, editedOdRate: undefined });
                    }
                  }}
                  className="w-full p-1 text-xs font-bold rounded border bg-background text-foreground"
                  title="Direct OD Premium ₹"
                />
                <span className="text-[9px] text-muted-foreground block">
                  {hasValidCalculation ? 'Calc: ₹' + Number(outputs.od?.gross ?? rawOd).toLocaleString('en-IN') : 'Direct ₹ Premium'}
                </span>
              </div>

              {/* OD Discount */}
              <div className="p-2.5 rounded-lg bg-card border text-amber-700 dark:text-amber-400 space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">OD Discount (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={data.odDiscountPercent ?? ''}
                  onChange={(e) => onChange({ ...data, odDiscountPercent: e.target.value })}
                  placeholder="e.g. 10%"
                  className="w-full p-1 text-xs font-bold rounded border bg-background text-amber-700 dark:text-amber-400"
                />
                <input
                  type="text"
                  readOnly
                  value={hasValidCalculation ? Number(odDiscountAmount).toFixed(2) : '—'}
                  className="hidden"
                />
                <span className="text-[9px] block">
                  Amount: {hasValidCalculation ? '-₹' + Number((outputs.od?.ncbDiscount ?? 0) + (outputs.od?.specialDiscount ?? odDiscountAmount)).toLocaleString('en-IN') : '—'}
                </span>
              </div>

              {/* OD Net Payable */}
              <div className="p-2.5 rounded-lg bg-card border space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">OD Net Payable</span>
                <span className="text-xs font-bold text-foreground block pt-1">
                  {hasValidCalculation ? '₹' + Number(outputs.od?.net ?? outputs.netOdPremium ?? 0).toLocaleString('en-IN') : '—'}
                </span>
                <span className="text-[9px] text-muted-foreground block">OD Gross minus discounts</span>
              </div>

              {/* OD GST */}
              <div className="p-2.5 rounded-lg bg-card border border-primary/20 bg-primary/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-primary font-bold">OD GST</span>
                  <select
                    value={data.odGstRate || data.gstRate || '18'}
                    onChange={(e) => onChange({ ...data, odGstRate: e.target.value })}
                    className="p-0.5 text-[10px] font-bold rounded border bg-background text-primary"
                  >
                    <option value="18">18% GST</option>
                    <option value="5">5% GST</option>
                  </select>
                </div>
                <span className="text-xs font-bold text-primary block pt-1">
                  {hasValidCalculation ? '+₹' + Number(outputs.od?.gst ?? outputs.gstOnOd ?? 0).toLocaleString('en-IN') : '—'}
                </span>
                <span className="text-[9px] text-muted-foreground block">Itemized on OD Gross</span>
              </div>
            </div>
          </div>

          {/* Component 2: Third Party (TP) */}
          <div className="p-3 rounded-xl border bg-accent/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-foreground">2. Third Party (TP) Liability</span>
                {data.editedTpPremium && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-300">
                    [Edited Annual Base]
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium">
                  Statutory Tariff: <strong className="text-foreground">₹{Number(result?.inputs?.statutoryAnnualTpPremium ?? result?.rateConfig?.systemTpAnnualRate ?? 0).toLocaleString('en-IN')}/yr</strong>
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  • Tenure: <strong className="text-foreground">{data.policyTenure || 1} yr(s)</strong>
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  • Gross TP: <strong className="text-foreground">₹{Number(result?.inputs?.tpGrossPremium ?? outputs.tp?.base ?? 0).toLocaleString('en-IN')}</strong>
                </span>
                {data.editedTpPremium !== undefined && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, editedTpPremium: undefined })}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline"
                  >
                    Reset to Tariff
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {/* Annual TP Premium */}
              <div className="p-2.5 rounded-lg bg-card border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground block font-bold">Annual TP Premium ₹</span>
                  {data.editedTpPremium !== undefined && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...data, editedTpPremium: undefined })}
                      className="text-[9px] font-semibold text-muted-foreground hover:text-foreground underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="1"
                  placeholder={hasValidCalculation ? String(result?.inputs?.effectiveAnnualTpPremium ?? result?.rateConfig?.tpAnnualRate ?? rawTp) : 'Annual TP ₹'}
                  value={data.editedTpPremium !== undefined ? data.editedTpPremium : (hasValidCalculation ? String(result?.inputs?.effectiveAnnualTpPremium ?? '') : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange({ ...data, editedTpPremium: val });
                  }}
                  className="w-full p-1 text-xs font-bold rounded border bg-background text-foreground"
                  title="Edit TP Base ₹"
                />
                <span className="text-[9px] text-muted-foreground block">
                  {hasValidCalculation
                    ? (data.editedTpPremium
                        ? `Custom: ₹${Number(data.editedTpPremium).toLocaleString('en-IN')} × ${data.policyTenure || 1} yr = ₹${Number(result?.inputs?.tpGrossPremium ?? outputs.tp?.base ?? 0).toLocaleString('en-IN')}`
                        : `Statutory: ₹${Number(result?.inputs?.statutoryAnnualTpPremium ?? result?.rateConfig?.systemTpAnnualRate ?? 0).toLocaleString('en-IN')}/yr × ${data.policyTenure || 1} yr`)
                    : 'Statutory annual tariff'}
                </span>
              </div>

              {/* TP Discount */}
              <div className="p-2.5 rounded-lg bg-card border text-amber-700 dark:text-amber-400 space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">TP Discount (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={data.tpDiscountPercent ?? ''}
                  onChange={(e) => onChange({ ...data, tpDiscountPercent: e.target.value })}
                  placeholder="e.g. 0%"
                  className="w-full p-1 text-xs font-bold rounded border bg-background text-amber-700 dark:text-amber-400"
                />
                <input
                  type="text"
                  readOnly
                  value={hasValidCalculation ? Number(tpDiscountAmount).toFixed(2) : '—'}
                  className="hidden"
                />
                <span className="text-[9px] block">
                  Amount: {hasValidCalculation ? '-₹' + Number(outputs.tp?.discount ?? tpDiscountAmount).toLocaleString('en-IN') : '—'}
                </span>
              </div>

              {/* TP Net Payable */}
              <div className="p-2.5 rounded-lg bg-card border space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">TP Net Payable</span>
                <span className="text-xs font-bold text-foreground block pt-1">
                  {hasValidCalculation ? '₹' + Number(outputs.tp?.net ?? outputs.netTpComponent ?? 0).toLocaleString('en-IN') : '—'}
                </span>
                <span className="text-[9px] text-muted-foreground block">
                  {hasValidCalculation && outputs.tp?.discount
                    ? `₹${Number(outputs.tp?.gross ?? outputs.tp?.base ?? 0).toLocaleString('en-IN')} − ₹${Number(outputs.tp.discount).toLocaleString('en-IN')}`
                    : 'Gross TP minus TP discount'}
                </span>
              </div>

              {/* TP GST */}
              <div className="p-2.5 rounded-lg bg-card border border-primary/20 bg-primary/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-primary font-bold">TP GST</span>
                  <select
                    value={data.tpGstRate || data.gstRate || '18'}
                    onChange={(e) => onChange({ ...data, tpGstRate: e.target.value })}
                    className="p-0.5 text-[10px] font-bold rounded border bg-background text-primary"
                  >
                    <option value="18">18% GST</option>
                    <option value="5">5% GST</option>
                  </select>
                </div>
                <span className="text-xs font-bold text-primary block pt-1">
                  {hasValidCalculation ? '+₹' + Number(outputs.tp?.gst ?? outputs.gstOnTp ?? 0).toLocaleString('en-IN') : '—'}
                </span>
                <span className="text-[9px] text-muted-foreground block">Itemized on Gross TP</span>
              </div>
            </div>
          </div>

          {/* Component 3: Compulsory PA (Owner-Driver) — Optional */}
          <div className={`p-3 rounded-xl border transition-colors space-y-2 ${
            data.paCoverOwner === false ? 'bg-muted/10 border-border opacity-70' : 'bg-accent/20 border-border'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="paCoverPackage"
                  checked={data.paCoverOwner !== false}
                  onChange={(e) => onChange({ ...data, paCoverOwner: e.target.checked })}
                  className="h-4 w-4 rounded text-primary cursor-pointer"
                />
                <span className="text-xs font-black text-foreground">3. Compulsory PA (Owner-Driver — ₹15L Cover)</span>
                <span className="text-[9px] font-semibold text-muted-foreground">(Optional)</span>
              </label>
              {data.paCoverOwner !== false ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">PA Premium ₹:</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="₹275"
                    value={data.editedPaPremium ?? ''}
                    onChange={(e) => onChange({ ...data, editedPaPremium: e.target.value })}
                    className="w-20 p-1 text-[11px] font-bold rounded border bg-background text-foreground"
                  />
                  {data.editedPaPremium && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...data, editedPaPremium: undefined })}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                  Opted Out / Excluded
                </span>
              )}
            </div>

            {data.paCoverOwner !== false && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-card border space-y-1">
                  <span className="text-[9px] text-muted-foreground block font-bold">PA Base Premium</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="275"
                    value={data.editedPaPremium ?? ''}
                    onChange={(e) => onChange({ ...data, editedPaPremium: e.target.value })}
                    className="w-full p-1 text-xs font-bold rounded border bg-background text-foreground"
                  />
                  <span className="text-[9px] text-muted-foreground block">
                    {hasValidCalculation ? 'Base: ₹' + Number(outputs.pa?.premium ?? 275).toLocaleString('en-IN') : 'Standard: ₹275'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-primary/20 bg-primary/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-primary font-bold">PA GST</span>
                    <select
                      value={data.paGstRate || data.gstRate || '18'}
                      onChange={(e) => onChange({ ...data, paGstRate: e.target.value })}
                      className="p-0.5 text-[10px] font-bold rounded border bg-background text-primary"
                    >
                      <option value="18">18% GST</option>
                      <option value="5">5% GST</option>
                    </select>
                  </div>
                  <span className="text-xs font-bold text-primary block pt-1">
                    {hasValidCalculation ? '+₹' + Number(outputs.pa?.gst ?? outputs.gstOnPa ?? 0).toLocaleString('en-IN') : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border space-y-1">
                  <span className="text-[9px] text-muted-foreground block font-bold">PA Total</span>
                  <span className="text-xs font-bold text-foreground block pt-1">
                    {hasValidCalculation ? '₹' + Number((outputs.pa?.premium ?? 275) + (outputs.pa?.gst ?? outputs.gstOnPa ?? 0)).toLocaleString('en-IN') : '—'}
                  </span>
                  <span className="text-[9px] text-muted-foreground block">Premium + GST</span>
                </div>
              </div>
            )}
          </div>

          {/* Component 4: Add-on Covers */}
          <div className="p-3.5 rounded-xl border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-foreground block">
                Add-on Covers <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>
              </label>
              {outputs.od?.addons ? (
                <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                  Total Add-ons: ₹{Number(outputs.od.addons).toLocaleString('en-IN')}
                </span>
              ) : null}
            </div>
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
                      <div className="mt-1.5 rounded-md bg-muted/40 p-2 text-[10px] space-y-1.5 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">Manual Premium (₹):</span>
                          {data.addonPrices?.[a.key] && (
                            <button
                              type="button"
                              onClick={() => {
                                const newPrices = { ...(data.addonPrices || {}) };
                                delete newPrices[a.key];
                                onChange({ ...data, addonPrices: newPrices });
                              }}
                              className="text-[9px] text-muted-foreground hover:text-foreground underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Enter amount ₹"
                          value={data.addonPrices?.[a.key] ?? ''}
                          onChange={(e) => {
                            const newPrices = { ...(data.addonPrices || {}), [a.key]: e.target.value };
                            onChange({ ...data, addonPrices: newPrices });
                          }}
                          className="w-full p-1 text-[11px] font-bold rounded border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {data.addonPrices?.[a.key] ? (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                            Applied: ₹{Number(data.addonPrices[a.key]).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground block">
                            Enter amount to include in quotation
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commercial Adjustment (Fixed ₹) */}
          <div className="p-3.5 rounded-xl border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground">Commercial Adjustment (₹)</span>
              <span className="text-[10px] text-muted-foreground">
                Payable Base: <strong className="text-foreground">₹{Number(payableBase).toLocaleString('en-IN')}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-background border space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">Commercial Adjustment (₹)</span>
                <div className="flex items-center gap-1.5">
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0">
                    <button
                      type="button"
                      aria-label="Subtract commercial adjustment"
                      aria-pressed={(data.commercialAdjustmentDirection || 'SUBTRACT') === 'SUBTRACT'}
                      onClick={() => onChange({ ...data, commercialAdjustmentDirection: 'SUBTRACT' })}
                      className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                        (data.commercialAdjustmentDirection || 'SUBTRACT') === 'SUBTRACT'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      − SUB
                    </button>
                    <button
                      type="button"
                      aria-label="Add commercial adjustment"
                      aria-pressed={data.commercialAdjustmentDirection === 'ADD'}
                      onClick={() => onChange({ ...data, commercialAdjustmentDirection: 'ADD' })}
                      className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                        data.commercialAdjustmentDirection === 'ADD'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      + ADD
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={data.commercialAdjustmentAmount ?? ''}
                    onChange={(e) => onChange({ ...data, commercialAdjustmentAmount: e.target.value, commercialDiscountPercent: undefined })}
                    placeholder="e.g. 500"
                    className="w-full p-1 text-xs font-bold rounded border bg-background text-amber-700 dark:text-amber-400"
                  />
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">
                  {data.commercialAdjustmentDirection === 'ADD' ? 'Loading / Addition (₹)' : 'Deduction (₹)'}
                </span>
                <span className={`text-xs font-bold block pt-1 ${data.commercialAdjustmentDirection === 'ADD' ? 'text-primary' : 'text-amber-600'}`}>
                  {hasValidCalculation && Number(data.commercialAdjustmentAmount || 0) > 0
                    ? (data.commercialAdjustmentDirection === 'ADD' ? '+₹' : '-₹') + Number(data.commercialAdjustmentAmount).toLocaleString('en-IN')
                    : '—'}
                </span>
                <span className="text-[9px] text-muted-foreground block">
                  {data.commercialAdjustmentDirection === 'ADD' ? 'Fixed ₹ addition to Payable Base' : 'Fixed ₹ deduction from Payable Base'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-background border space-y-1">
                <span className="text-[9px] text-muted-foreground block font-bold">Justification / Approval Ref</span>
                <input
                  type="text"
                  value={data.discountReason ?? ''}
                  onChange={(e) => onChange({ ...data, discountReason: e.target.value })}
                  placeholder="Approval reference or note"
                  className="w-full p-1 text-xs rounded border bg-background text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Final Total Payable Summary */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                Final Total Payable Amount
              </span>
              <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                <span>Gross Premium: <strong className="text-foreground">₹{Number(grossBase).toLocaleString('en-IN')}</strong></span>
                <span>•</span>
                <span>Total Itemized GST: <strong className="text-foreground">₹{Number(gstAmt).toLocaleString('en-IN')}</strong></span>
                <span>•</span>
                <span>Payable Base: <strong className="text-foreground">₹{Number(payableBase).toLocaleString('en-IN')}</strong></span>
                {odDiscountAmount > 0 && (
                  <>
                    <span>•</span>
                    <span>OD Discount: <strong className="text-amber-600">-₹{Number(odDiscountAmount).toLocaleString('en-IN')}</strong></span>
                  </>
                )}
                {tpDiscountAmount > 0 && (
                  <>
                    <span>•</span>
                    <span>TP Discount: <strong className="text-amber-600">-₹{Number(tpDiscountAmount).toLocaleString('en-IN')}</strong></span>
                  </>
                )}
                {Number(data.commercialAdjustmentAmount || 0) > 0 && (
                  <>
                    <span>•</span>
                    <span className={data.commercialAdjustmentDirection === 'ADD' ? 'text-primary font-bold' : 'text-amber-600'}>
                      Commercial Adj: <strong>{data.commercialAdjustmentDirection === 'ADD' ? '+₹' : '-₹'}{Number(data.commercialAdjustmentAmount).toLocaleString('en-IN')}</strong>
                    </span>
                  </>
                )}
                {totalDiscount > 0 && (
                  <>
                    <span>•</span>
                    <span>Total Discounts: <strong className="text-amber-700 font-bold">-₹{Number(totalDiscount).toLocaleString('en-IN')}</strong></span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Override Total ₹"
                  value={data.totalPremiumOverride ?? ''}
                  onChange={(e) => onChange({ ...data, totalPremiumOverride: e.target.value || undefined })}
                  className="w-32 p-1 text-xs font-bold rounded border bg-background text-foreground"
                  title="Manual Total Premium Override"
                />
                {data.totalPremiumOverride && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...data, totalPremiumOverride: undefined })}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {finalPayable === null ? '—' : '₹' + Number(finalPayable).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Expiring Policy & NCB Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Claim in Expiring Policy — only applicable when previous policy is available */}
        {claimHistoryApplicable ? (
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
        ) : (
          <div className="p-2.5 rounded-lg border border-muted bg-muted/30 text-xs text-muted-foreground col-span-1">
            <span className="font-semibold">Claim History:</span> Not applicable ({isNew ? 'New Vehicle' : 'No Previous Policy'})
          </div>
        )}

        {/* NCB % — only applicable when previous policy is available */}
        {ncbApplicable ? (
          <div className="col-span-1">
            <NcbSlider
              value={data.ncbPercentage || '0'}
              onChange={(val) => onChange({ ...data, ncbPercentage: val })}
              disabled={data.claimInExpiringPolicy === 'Yes'}
              disabledReason={data.claimInExpiringPolicy === 'Yes' ? 'Locked to 0% due to claim in expiring policy' : undefined}
            />
          </div>
        ) : (
          <div className="p-2.5 rounded-lg border border-muted bg-muted/30 text-xs text-muted-foreground col-span-1">
            <span className="font-semibold">NCB:</span> 0% — Not applicable ({isNew ? 'New Vehicle' : 'No Previous Policy'})
          </div>
        )}
      </div>

      {/* 4. Previous Insurer & Policy Number — only shown when previous policy is applicable */}
      {prevPolicyApplicable && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Previous Insurer Name" conditional>
            <select value={data.previousInsurerName || ''} onChange={set('previousInsurerName')} className={inputBase}>
              <option value="">— Select Previous Insurer —</option>
              {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Previous Policy Number" conditional>
            <input
              type="text"
              value={data.previousPolicyNumber || ''}
              onChange={set('previousPolicyNumber')}
              placeholder="Previous policy number"
              className={`${inputBase} font-mono`}
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

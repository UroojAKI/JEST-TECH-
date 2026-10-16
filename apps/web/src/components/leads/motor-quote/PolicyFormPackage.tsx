'use client';

import React, { useEffect } from 'react';
import { getPolicyTenureOptions, INSURER_OPTIONS, NCB_OPTIONS, ADDON_OPTIONS } from './motorFormConfig';
import type { VehicleCategory, PolicyFormPackage, MotorEligibilityContext } from './motorFormTypes';
import { useMotorCalculator } from './useMotorCalculator';
import { GstRateSelector } from './GstRateSelector';
import { CommissionBreakdownPanel } from './CommissionBreakdownPanel';

interface Props {
  category: VehicleCategory;
  vehicleStatus: 'NEW' | 'EXISTING';
  data: PolicyFormPackage;
  onChange: (data: PolicyFormPackage) => void;
  /** Canonical eligibility context computed by MotorQuoteWizard. When not provided,
   * falls back to vehicleStatus for backward compatibility. */
  eligibility?: MotorEligibilityContext;
  vehicleDetails?: Record<string, string>;
  targetInsurer?: string;
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

export function PolicyFormPackageForm({ category, vehicleStatus, data, onChange, eligibility, vehicleDetails, targetInsurer }: Props) {
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

  const engineCc = parseFloat(vehicleDetails?.engineCapacity || vehicleDetails?.engineCc || '0') || undefined;
  const seatingCapacity = parseInt(vehicleDetails?.seatingCapacity || vehicleDetails?.seatLoadCapacity || '0') || undefined;
  const gvwKg = parseFloat(vehicleDetails?.grossVehicleWeight || vehicleDetails?.gvw || '0') || undefined;

  const { result, loading, error } = useMotorCalculator({
    vehicleCategory: category,
    vehicleStatus: vehicleStatus,
    policyType: 'PACKAGE_COMPREHENSIVE',
    policyTenure: parseInt(data.policyTenure || '1') || 1,
    idv: parseFloat(data.insuredDeclaredValue || '0') || 0,
    ncbPercent: parseInt(data.ncbPercentage || '0') || 0,
    claimInExpiringPolicy: data.claimInExpiringPolicy === 'Yes',
    paCover: data.paCoverOwner !== false,
    paidDriverLiability: data.legalLiabilityPaidDriver === 'Yes',
    discountPercent: parseFloat(data.odDiscountPercent || '0') || 0,
    tpDiscountPercent: parseFloat(data.tpDiscountPercent || '0') || 0,
    gstRate: data.gstRate ? parseInt(data.gstRate) : 18,
    engineCc,
    seatingCapacity,
    gvwKg,
    // Selected add-ons use the authoritative server-side rate; agents cannot override price here.
    addons: (data.addonsSelected || []).map(a => ({ addonCode: a }))
  });

  useEffect(() => {
    if ((loading || error) && (data.calculatedResult || data.totalPremiumInclGST || data.finalPayableAmount || data.finalGstAmount)) {
      onChange({
        ...data,
        calculatedResult: undefined,
        totalPremiumInclGST: '',
        finalPayableAmount: '',
        finalGstAmount: '',
      });
    }
    // Do not keep a prior quote result while current inputs are unresolved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error]);

  useEffect(() => {
    if (result && result.outputs) {
      onChange({ 
        ...data, 
        totalPremiumInclGST: (result.outputs.finalPayableAmount ?? result.outputs.totalPremium ?? 0).toString(),
        finalPayableAmount: (result.outputs.finalPayableAmount ?? result.outputs.totalPremium ?? 0).toString(),
        finalGstAmount: (result.outputs.totalGst ?? 0).toString(),
        odCommissionCalc: '',
        tpCommissionCalc: '',
        finalCommissionCalc: '',
        gstRate: (result.rateConfig?.gstRatePercent ?? (data.gstRate ? parseInt(data.gstRate) : 18)).toString(),
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
  const rawOd = outputs.baseOdPremium ?? 0;
  const rawTp = outputs.baseTpPremium ?? 0;
  const grossBase = outputs.grossBasePremium ?? (rawOd + rawTp);
  const discountAmt = outputs.totalDiscount ?? 0;
  const netBase = outputs.netCustomerPremium ?? outputs.netPreTaxPremium ?? (grossBase - discountAmt);
  const gstAmt = outputs.totalGst ?? outputs.gstAmount ?? 0;
  const itemizedAddons: any[] = Array.isArray(outputs.itemizedAddons) ? outputs.itemizedAddons : [];
  const odDiscountAmount = outputs.specialDiscount ?? outputs.od?.specialDiscount ?? 0;
  const tpDiscountAmount = outputs.tp?.discount ?? outputs.tpDiscountAmount ?? 0;
  const finalPayable = hasValidCalculation
    ? Number(outputs.finalPayableAmount ?? outputs.totalPremium ??
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
        ) : (
          <div className="p-2.5 rounded-lg border border-muted bg-muted/30 text-xs text-muted-foreground col-span-1">
            <span className="font-semibold">NCB:</span> 0% — Not applicable ({isNew ? 'New Vehicle' : 'No Previous Policy'})
          </div>
        )}

      </div>

      {/* Previous Insurer & Policy Number — only shown when previous policy is applicable */}
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

      {/* Policy Start Date & End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Policy Start Date">
          <input
            type="date"
            value={data.policyStartDate || ''}
            onChange={(e) => {
              const val = e.target.value;
              const tenure = parseInt(data.policyTenure || '1') || 1;
              if (val) {
                const d = new Date(val);
                d.setFullYear(d.getFullYear() + tenure);
                d.setDate(d.getDate() - 1);
                onChange({ ...data, policyStartDate: val, policyEndDate: d.toISOString().split('T')[0] });
              } else {
                onChange({ ...data, policyStartDate: val });
              }
            }}
            className={inputBase}
          />
        </FieldRow>
        <FieldRow label="Policy End Date">
          <input
            type="date"
            value={data.policyEndDate || ''}
            onChange={set('policyEndDate')}
            className={inputBase}
          />
        </FieldRow>
      </div>

      {/* Statutory PA & Legal Liability Co-covers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border bg-card flex items-start gap-3">
          <input
            type="checkbox"
            id="paCoverPackage"
            checked={data.paCoverOwner !== false}
            onChange={(e) => onChange({ ...data, paCoverOwner: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded text-primary"
          />
          <label htmlFor="paCoverPackage" className="text-xs cursor-pointer">
            <span className="font-bold text-foreground">Compulsory PA Cover (Owner-Driver)</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Statutory ₹15L coverage (fixed IRDAI rate ₹275)</p>
          </label>
        </div>

        <FieldRow label="Legal Liability to Paid Driver (LL)" conditional hint="Statutory ₹50 cover for paid driver">
          <div className="flex gap-4 mt-1">
            {['Yes', 'No'].map((v) => (
              <label key={v} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="legalLiabilityPkg"
                  value={v}
                  checked={(data.legalLiabilityPaidDriver || 'No') === v}
                  onChange={() => onChange({ ...data, legalLiabilityPaidDriver: v })}
                  className="h-3.5 w-3.5 text-primary"
                />
                {v}
              </label>
            ))}
          </div>
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
                {isSelected && (() => {
                  const pricedAddon = itemizedAddons.find((item: any) => item.addonCode === a.key);
                  return (
                    <div className="mt-1 rounded-md bg-muted/50 px-2 py-1.5 text-[10px]">
                      {pricedAddon
                        ? <span className="font-semibold">Calculated premium: ₹{Number(pricedAddon.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        : error
                          ? <span className="text-destructive">Price unavailable — resolve the calculator error below.</span>
                          : loading
                            ? <span className="text-muted-foreground">Calculating configured premium…</span>
                            : <span className="text-muted-foreground">Price is calculated by the server.</span>}
                    </div>
                  );
                })()}
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
              value={data.odDiscountPercent ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ ...data, odDiscountPercent: val });
              }}
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
              value={data.tpDiscountPercent ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ ...data, tpDiscountPercent: val });
              }}
              placeholder="e.g. 0%"
              className={inputBase}
            />
          </FieldRow>
          <FieldRow label="OD Discount Amount (₹)" hint="Calculated by the backend from the OD premium and approved discount">
            <input type="text" readOnly value={hasValidCalculation ? Number(odDiscountAmount).toFixed(2) : '—'} className={inputBase + ' bg-muted'} />
          </FieldRow>
          <FieldRow label="TP Discount Amount (₹)" hint="Calculated by the backend from the TP premium and approved discount">
            <input type="text" readOnly value={hasValidCalculation ? Number(tpDiscountAmount).toFixed(2) : '—'} className={inputBase + ' bg-muted'} />
          </FieldRow>
        </div>
      </div>

      {/* Applicable GST Rate Selector (5% vs 18%) */}
      <GstRateSelector
        value={data.gstRate}
        onChange={(rate) => onChange({ ...data, gstRate: rate })}
      />

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
              <span className="text-sm font-bold text-foreground">{hasValidCalculation ? '₹' + grossBase.toLocaleString('en-IN') : '—'}</span>
              <span className="text-[9px] text-muted-foreground block">{hasValidCalculation ? 'OD: ₹' + rawOd + ' | TP: ₹' + rawTp : 'OD/TP breakdown unavailable'}</span>
            </div>

            <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20">
              <span className="text-[10px] text-amber-800 dark:text-amber-300 block font-medium">Total Discount Amount</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{hasValidCalculation ? '-₹' + discountAmt.toLocaleString('en-IN') : '—'}</span>
              <span className="text-[9px] text-amber-700/80 block">Applied pre-tax</span>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/10">
              <span className="text-[10px] text-muted-foreground block font-medium">Net Customer Premium</span>
              <span className="text-sm font-bold text-foreground">{hasValidCalculation ? '₹' + netBase.toLocaleString('en-IN') : '—'}</span>
              <span className="text-[9px] text-muted-foreground block">Gross minus discounts</span>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/10">
              <span className="text-[10px] text-muted-foreground block font-medium">
                Statutory GST ({outputs.gstRatePercent ?? (data.gstRate ? parseInt(data.gstRate) : 18)}%)
              </span>
              <span className="text-sm font-bold text-foreground">{hasValidCalculation ? '+₹' + gstAmt.toLocaleString('en-IN') : '—'}</span>
              <span className="text-[9px] text-muted-foreground block">Calculated on Net Component</span>
            </div>
          </div>

          {/* Final Total Paying Amount */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                Final Total Payable Amount
              </span>
              <span className="text-[10px] text-muted-foreground">
                Authoritative amount to be collected from customer (Net Customer Premium + Statutory GST)
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {finalPayable === null ? '—' : '₹' + finalPayable.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
      <CommissionBreakdownPanel calculation={loading || error ? undefined : result} components={['OD', 'TP']} loading={loading} error={error} />
    </div>
  );
}

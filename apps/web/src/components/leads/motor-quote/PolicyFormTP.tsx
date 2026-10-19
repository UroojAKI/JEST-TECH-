'use client';

import React from 'react';
import { getPolicyTenureOptions, INSURER_OPTIONS, TP_ADDON_OPTIONS } from './motorFormConfig';
import type { VehicleCategory, PolicyFormTPOnly, MotorEligibilityContext } from './motorFormTypes';

import { useMotorCalculator } from './useMotorCalculator';
import { GstRateSelector } from './GstRateSelector';

interface Props {
  category: VehicleCategory;
  vehicleStatus: 'NEW' | 'EXISTING';
  data: PolicyFormTPOnly;
  onChange: (data: PolicyFormTPOnly) => void;
  /** Canonical eligibility context computed by MotorQuoteWizard. */
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

export function PolicyFormTPOnlyForm({ category, vehicleStatus, data, onChange, eligibility }: Props) {
  const set = (key: keyof PolicyFormTPOnly) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });
  const setBool = (key: keyof PolicyFormTPOnly) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [key]: e.target.checked });

  // Derive effective eligibility
  const isNew = eligibility ? eligibility.vehicleStatus === 'NEW' : vehicleStatus === 'NEW';
  // For TP only, previous TP policy fields are only applicable for renewal/existing vehicles
  const prevTpApplicable = eligibility ? eligibility.previousPolicyApplicable : !isNew;

  React.useEffect(() => {
    if (data.tpCommissionCalc) {
      onChange({ ...data, tpCommissionCalc: '' });
    }
    // Legacy TP commission field was previously coupled to customer discount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { result, loading, error } = useMotorCalculator({
    vehicleCategory: category,
    vehicleStatus: vehicleStatus,
    policyType: 'THIRD_PARTY_ONLY',
    policyTenure: parseInt(data.policyTenure || '1') || 1,
    paCover: !!data.paCoverOwner,
    paidDriverLiability: data.legalLiabilityPaidDriver === 'Yes',
    tpDiscountPercent: parseFloat(data.tpDiscountPercent || data.discountPercent || '0') || 0,
    ...(data.commercialAdjustmentAmount !== undefined && data.commercialAdjustmentAmount !== '' && !isNaN(parseFloat(data.commercialAdjustmentAmount))
      ? {
          commercialAdjustment: parseFloat(data.commercialAdjustmentAmount),
          commercialAdjustmentAmount: parseFloat(data.commercialAdjustmentAmount),
        }
      : {
          commercialDiscountPercent: parseFloat(data.commercialDiscountPercent || '0') || 0,
        }),
    commercialAdjustmentDirection: data.commercialAdjustmentDirection || 'SUBTRACT',
    discountReason: data.discountReason || undefined,
    gstRate: data.gstRate ? parseInt(data.gstRate) : 18,
    tpGstRate: data.tpGstRate ? parseInt(data.tpGstRate) : (data.gstRate ? parseInt(data.gstRate) : 18),
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
    addons: (data.addonsSelected || []).map((addonKey) => ({
      addonCode: addonKey,
      amount: data.addonPrices?.[addonKey] !== undefined && data.addonPrices[addonKey] !== ''
        ? parseFloat(data.addonPrices[addonKey])
        : undefined,
      discountPercent: data.addonDiscounts?.[addonKey] !== undefined && data.addonDiscounts[addonKey] !== ''
        ? parseFloat(data.addonDiscounts[addonKey])
        : undefined,
      gstRate: data.addonGstRates?.[addonKey] !== undefined && data.addonGstRates[addonKey] !== ''
        ? parseInt(data.addonGstRates[addonKey])
        : undefined,
    })),
  });

  const dataRef = React.useRef(data);
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  React.useEffect(() => {
    if ((loading || error) && (data.calculatedResult || data.totalPremiumInclGST || data.thirdPartyPremium)) {
      const current = dataRef.current;
      onChange({
        ...current,
        calculatedResult: undefined,
        totalPremiumInclGST: '',
        thirdPartyPremium: '',
      });
    }
    // Do not leave a previous vehicle's TP amount available for quotation save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error]);

  React.useEffect(() => {
    if (result && result.outputs) {
      const current = dataRef.current;
      onChange({ 
        ...current, 
        thirdPartyPremium: (result.outputs.tp?.base ?? result.outputs.baseTpPremium ?? 0).toString(),
        totalPremiumInclGST: (result.outputs.finalPayableAmount ?? result.outputs.totalPremium ?? 0).toString(),
        tpCommissionCalc: '',
        gstRate: (result.rateConfig?.gstRatePercent ?? (current.gstRate ? parseInt(current.gstRate) : 18)).toString(),
        calculatedResult: result 
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {/* NCB Status for TP Only */}
      <div className="p-2.5 rounded-lg border border-muted bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">No Claim Bonus (NCB):</span>
          <span>Not applicable to Third-Party statutory liability</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border">
          0% (Statutory)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Policy Tenure */}
        <FieldRow label="Policy Tenure" mandatory>
          <select value={data.policyTenure} onChange={set('policyTenure')} className={mandatoryInput(data.policyTenure)}>
            <option value="">— Select Tenure —</option>
            {tenureOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldRow>

        {/* Annual TP Premium */}
        <FieldRow
          label="Annual TP Premium (₹)"
          hint={data.editedTpPremium
            ? `Custom: ₹${Number(data.editedTpPremium).toLocaleString('en-IN')}/yr × ${data.policyTenure || '1'} yr(s) = ₹${Number(result?.outputs?.tp?.gross ?? result?.outputs?.tp?.base ?? 0).toLocaleString('en-IN')} (Statutory: ₹${Number(result?.outputs?.tp?.statutoryAnnual ?? result?.rateConfig?.systemTpAnnualRate ?? 0).toLocaleString('en-IN')}/yr)`
            : `Statutory Annual Tariff: ₹${Number(result?.outputs?.tp?.statutoryAnnual ?? result?.rateConfig?.systemTpAnnualRate ?? 0).toLocaleString('en-IN')}/yr (Tenure: ${data.policyTenure || '1'} yr(s) → Gross: ₹${Number(result?.outputs?.tp?.gross ?? result?.outputs?.tp?.base ?? 0).toLocaleString('en-IN')})`}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              value={data.editedTpPremium !== undefined ? data.editedTpPremium : (error || loading ? '' : result?.outputs?.tp?.annualPremium?.toString() || result?.outputs?.tp?.statutoryAnnual?.toString() || '')}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ ...data, editedTpPremium: val });
              }}
              placeholder={loading ? 'Calculating…' : error ? 'Approved TP tariff required' : (result?.outputs?.tp?.annualPremium?.toString() || result?.outputs?.tp?.statutoryAnnual?.toString() || 'Annual TP ₹')}
              className={inputBase}
              title="Edit Annual TP Premium ₹"
            />
            {data.editedTpPremium !== undefined && (
              <button
                type="button"
                onClick={() => onChange({ ...data, editedTpPremium: undefined })}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline whitespace-nowrap"
              >
                Reset to Tariff
              </button>
            )}
          </div>
        </FieldRow>

        {/* Previous TP Insurer — only for renewal/existing vehicles */}
        {prevTpApplicable && (
          <FieldRow label="Previous TP Insurer Name" conditional>
            <select value={data.previousTPInsurerName} onChange={set('previousTPInsurerName')} className={inputBase}>
              <option value="">— Select Insurer (Renewal) —</option>
              {INSURER_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </FieldRow>
        )}

        {/* Previous TP Policy No — only for renewal/existing vehicles */}
        {prevTpApplicable && (
          <FieldRow label="Previous TP Policy Number" conditional>
            <input
              type="text"
              value={data.previousTPPolicyNumber}
              onChange={set('previousTPPolicyNumber')}
              placeholder="Previous policy number"
              className={`${inputBase} font-mono`}
            />
          </FieldRow>
        )}

        {/* Policy Start / End Date */}
        <FieldRow label="Policy Start Date">
          <input type="date" value={data.policyStartDate} onChange={(e) => {
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
          }} className={inputBase} />
        </FieldRow>
        <FieldRow label="Policy End Date">
          <input type="date" value={data.policyEndDate} onChange={set('policyEndDate')} className={inputBase} />
        </FieldRow>
      </div>

      {/* PA Cover — Optional */}
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
          <span className="text-muted-foreground text-[10px] ml-1">(Optional)</span>
          <p className="text-[10px] text-muted-foreground mt-0.5">Sum Insured: ₹15 Lakh (standard). Uncheck if customer holds existing PA cover or waiver.</p>
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

      {/* TP Add-ons Section */}
      <div className="p-3.5 rounded-xl border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-foreground block">
            Third-Party Add-on Covers <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>
          </label>
          <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            Total Add-on Gross: ₹{Number(result?.outputs?.addonGrossPremium ?? result?.outputs?.addonPremium ?? 0).toLocaleString('en-IN')}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Select TP add-ons. Each add-on has its own price, independent discount, and 5%/18% GST selection.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {TP_ADDON_OPTIONS.map((addon) => {
            const isSelected = (data.addonsSelected || []).includes(addon.key);
            const price = data.addonPrices?.[addon.key] ?? '';
            const discount = data.addonDiscounts?.[addon.key] ?? '';
            const gst = data.addonGstRates?.[addon.key] ?? '18';
            return (
              <div
                key={addon.key}
                className={`p-2.5 rounded-lg border transition-colors ${
                  isSelected ? 'bg-primary/5 border-primary/40' : 'hover:bg-accent/40'
                }`}
              >
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      const current = data.addonsSelected || [];
                      const updated = isSelected
                        ? current.filter((k) => k !== addon.key)
                        : [...current, addon.key];
                      onChange({ ...data, addonsSelected: updated });
                    }}
                    className="h-4 w-4 rounded text-primary"
                  />
                  <span>{addon.label}</span>
                </label>
                {isSelected && (
                  <div className="mt-2 grid grid-cols-3 gap-2 p-2 rounded-md bg-muted/40 border border-border text-[10px]">
                    <div>
                      <span className="font-bold text-foreground block mb-0.5">Amount (₹)</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Default"
                        value={price}
                        onChange={(e) => {
                          const newPrices = { ...(data.addonPrices || {}), [addon.key]: e.target.value };
                          onChange({ ...data, addonPrices: newPrices });
                        }}
                        className="w-full p-1 rounded border bg-background text-foreground font-mono"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-foreground block mb-0.5">Discount (%)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0%"
                        value={discount}
                        onChange={(e) => {
                          const newDiscounts = { ...(data.addonDiscounts || {}), [addon.key]: e.target.value };
                          onChange({ ...data, addonDiscounts: newDiscounts });
                        }}
                        className="w-full p-1 rounded border bg-background text-amber-600 font-mono"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-foreground block mb-0.5">GST Rate</span>
                      <select
                        value={gst}
                        onChange={(e) => {
                          const newGsts = { ...(data.addonGstRates || {}), [addon.key]: e.target.value };
                          onChange({ ...data, addonGstRates: newGsts });
                        }}
                        className="w-full p-1 rounded border bg-background text-primary"
                      >
                        <option value="18">18%</option>
                        <option value="5">5%</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
              (TP: ₹{data.calculatedResult?.outputs?.netTpPremium || 0} | Add-ons: ₹{data.calculatedResult?.outputs?.addonGrossPremium || data.calculatedResult?.outputs?.addonPremium || 0} | GST: ₹{data.calculatedResult?.outputs?.totalGst || 0})
            </span>
          </div>
        </FieldRow>
      </div>

      {/* Applicable GST Rate Selector (5% vs 18%) */}
      <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
        <div>
          <span className="text-xs font-bold text-foreground block">TP Applicable GST Rate:</span>
          <span className="text-[10px] text-muted-foreground">Select statutory 18% or concessional 5%</span>
        </div>
        <select
          value={data.tpGstRate || data.gstRate || '18'}
          onChange={(e) => onChange({ ...data, gstRate: e.target.value, tpGstRate: e.target.value })}
          className="p-1.5 text-xs font-bold rounded border bg-background text-primary"
        >
          <option value="18">18% GST (Standard)</option>
          <option value="5">5% GST (Concessional)</option>
        </select>
      </div>

      {/* TP Discount & Final Payable Calculator */}
      <div className="p-4 rounded-xl border border-sky-200 bg-sky-500/5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground">
            Commercial Discount & Final Payable Calculator
          </label>
          <span className="text-[10px] font-mono bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 px-2 py-0.5 rounded">
            Payable Base Calculation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
              TP Discount (%)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              placeholder="0"
              value={data.tpDiscountPercent ?? data.discountPercent ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange({
                  ...data,
                  tpDiscountPercent: val,
                  discountPercent: val,
                });
              }}
              className="w-full p-2 rounded-lg border text-xs font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-primary border-border"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
              Commercial Adjustment (₹)
            </label>
            <div className="flex gap-1.5">
              <select
                value={data.commercialAdjustmentDirection || 'SUBTRACT'}
                onChange={(e) => onChange({ ...data, commercialAdjustmentDirection: e.target.value as 'ADD' | 'SUBTRACT' })}
                className="p-1 text-xs font-bold rounded border bg-background text-foreground shrink-0 w-24"
              >
                <option value="SUBTRACT">SUB (−)</option>
                <option value="ADD">ADD (+)</option>
              </select>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 500"
                value={data.commercialAdjustmentAmount || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange({
                    ...data,
                    commercialAdjustmentAmount: val,
                    commercialDiscountPercent: undefined,
                  });
                }}
                className="w-full p-2 rounded-lg border text-xs font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-primary border-border"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
              Total Discounts (₹)
            </label>
            <input
              type="text"
              readOnly
              value={error ? '—' : loading ? 'Calculating…' : result?.outputs?.summary?.totalDiscount !== undefined ? '₹' + Number(result.outputs.summary.totalDiscount).toLocaleString('en-IN') : '—'}
              className="w-full p-2 rounded-lg border text-xs font-semibold bg-muted border-border opacity-80"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
              Payable Base (₹)
            </label>
            <input
              type="text"
              readOnly
              value={error ? '—' : loading ? 'Calculating…' : result?.outputs?.payableSummary?.payableBase !== undefined ? '₹' + Number(result.outputs.payableSummary.payableBase).toLocaleString('en-IN') : '—'}
              className="w-full p-2 rounded-lg border text-xs font-semibold bg-muted border-border opacity-80"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
              Final Payable (₹)
            </label>
            <input
              type="text"
              readOnly
              value={error ? '—' : loading ? 'Calculating…' : result?.outputs?.finalPayableAmount !== undefined ? '₹' + Number(result.outputs.finalPayableAmount).toLocaleString('en-IN') : '—'}
              className="w-full p-2 rounded-lg border text-xs font-bold text-sky-700 bg-sky-50 border-sky-200"
            />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground font-mono">
          Formula: Payable Base (Gross TP + Add-ons + GST) − TP Discount − Add-on Discount {data.commercialAdjustmentDirection === 'ADD' ? '+' : '−'} Commercial Adjustment = Final Total Payable
        </p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">Premium calculation failed: {error}</div>}
    </div>
  );
}

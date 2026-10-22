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
    gstRate: data.gstRate ? parseInt(data.gstRate) : (data.tpGstRate ? parseInt(data.tpGstRate) : 18),
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
    ...(data.totalPremiumOverride !== undefined && data.totalPremiumOverride !== '' && !isNaN(parseFloat(data.totalPremiumOverride))
      ? { totalPremiumOverride: parseFloat(data.totalPremiumOverride) }
      : {}),
    ...(data.gstAmountOverride !== undefined && data.gstAmountOverride !== '' && !isNaN(parseFloat(data.gstAmountOverride))
      ? { gstAmount: parseFloat(data.gstAmountOverride) }
      : {}),
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
    if (error && dataRef.current.calculatedResult) {
      const current = dataRef.current;
      onChange({
        ...current,
        calculatedResult: undefined,
        totalPremiumInclGST: current.totalPremiumOverride ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  React.useEffect(() => {
    if (result && result.outputs) {
      const current = dataRef.current;
      const payableTotal = (result.outputs.finalPayableAmount ?? result.outputs.totalPremium ?? 0).toString();
      const tpGstPercent = (result.rateConfig?.tpGstRatePercent ?? result.rateConfig?.gstRatePercent ?? (current.tpGstRate ? parseInt(current.tpGstRate) : (current.gstRate ? parseInt(current.gstRate) : 18))).toString();
      const genericGstPercent = (result.rateConfig?.gstRatePercent ?? tpGstPercent).toString();
      onChange({ 
        ...current, 
        thirdPartyPremium: (result.outputs.tp?.base ?? result.outputs.baseTpPremium ?? 0).toString(),
        totalPremiumInclGST: current.totalPremiumOverride ?? payableTotal,
        tpCommissionCalc: '',
        gstRate: genericGstPercent,
        tpGstRate: tpGstPercent,
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
                        aria-label={`GST Rate for ${addon.label}`}
                        data-testid={`addon-gst-${addon.key}`}
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

      {/* Applicable GST Rate Selector (5% vs 18%) */}
      <div className="p-3.5 rounded-xl border bg-card space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label htmlFor="tp-gst-rate-selector" className="text-xs font-bold text-foreground block">
              TP Applicable GST Rate Selector
            </label>
            <span className="text-[10px] text-muted-foreground block">
              Select statutory 18% or concessional 5%. Component-level GST and total payable recalculate automatically.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background border shadow-xs" data-testid="tp-gst-rate-selector">
              <button
                type="button"
                onClick={() => onChange({ ...data, gstRate: '5', tpGstRate: '5' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  (data.tpGstRate || data.gstRate) === '5'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                5% GST (Concessional)
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...data, gstRate: '18', tpGstRate: '18' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  (data.tpGstRate || data.gstRate || '18') === '18'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                18% GST (Standard)
              </button>
            </div>
            <select
              id="tp-gst-rate-selector"
              aria-label="TP Applicable GST Rate"
              value={data.tpGstRate || data.gstRate || '18'}
              onChange={(e) => onChange({ ...data, gstRate: e.target.value, tpGstRate: e.target.value })}
              className="p-1.5 text-xs font-bold rounded border bg-background text-primary"
            >
              <option value="18">18% GST (Standard)</option>
              <option value="5">5% GST (Concessional)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Component-Level TP Premium & GST Breakdown */}
      {(() => {
        const tpOutputs = result?.outputs;
        const tpSummary = tpOutputs?.payableSummary || tpOutputs?.summary;
        const tpGstBreakdown = tpOutputs?.gstBreakdown || tpSummary?.gstBreakdown;
        const tpItemizedAddons: any[] = Array.isArray(tpOutputs?.itemizedAddons)
          ? tpOutputs.itemizedAddons
          : (Array.isArray(tpGstBreakdown?.addons?.items) ? tpGstBreakdown.addons.items : []);
        const tpBaseAmount = Number(tpOutputs?.tp?.base ?? tpOutputs?.baseTpPremium ?? 0);
        const tpGstRateNum = Number(tpGstBreakdown?.tp?.ratePercent ?? (data.tpGstRate || data.gstRate || 18));
        const tpGstAmount = Number(tpGstBreakdown?.tp?.amount ?? tpOutputs?.gstOnTp ?? 0);
        const paAmount = Number(tpOutputs?.pa?.premium ?? tpOutputs?.paPremium ?? 0);
        const paGstAmount = Number(tpGstBreakdown?.pa?.amount ?? tpOutputs?.gstOnPa ?? 0);
        const driverAmount = Number(tpOutputs?.paidDriver?.premium ?? tpOutputs?.paidDriverPremium ?? 0);
        const driverGstAmount = Number(tpGstBreakdown?.paidDriver?.amount ?? tpOutputs?.gstOnPaidDriver ?? 0);
        const addonGrossAmount = Number(tpSummary?.addonGrossPremium ?? tpOutputs?.addonGrossPremium ?? tpOutputs?.addonPremium ?? 0);
        const addonDiscountAmount = Number(tpSummary?.addonDiscountAmount ?? tpSummary?.addonDiscount ?? 0);
        const addonTaxableAmount = Number(tpGstBreakdown?.addons?.taxableBase ?? Math.max(0, addonGrossAmount - addonDiscountAmount));
        const addonGstAmount = Number(tpSummary?.addonGstTotal ?? tpGstBreakdown?.addons?.amount ?? 0);
        const totalGstAmount = Number(tpOutputs?.totalGst ?? tpOutputs?.componentGstTotal ?? 0);
        const finalPayableTotal = Number(data.totalPremiumOverride ?? tpOutputs?.finalPayableAmount ?? tpOutputs?.totalPremium ?? 0);

        return (
          <div className="p-4 rounded-xl border border-sky-200 bg-sky-500/5 space-y-3" data-testid="tp-premium-breakdown">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <label className="text-xs font-bold text-foreground block">
                  Component-Level Premium & Statutory GST Breakdown
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Statutory tax bases calculated per component according to IRDAI tariff rules
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 px-2 py-0.5 rounded">
                Tenure: {data.policyTenure || 1} Year(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Statutory TP Base */}
              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                  Third-Party Statutory Base
                </span>
                <div className="text-base font-extrabold text-foreground font-mono">
                  ₹{tpBaseAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Tariff: ₹{Number(result?.rateConfig?.tpAnnualRate ?? result?.rateConfig?.systemTpAnnualRate ?? 0).toLocaleString('en-IN')}/yr
                  {Number(tpOutputs?.tp?.discount ?? 0) > 0 && (
                    <span className="text-amber-600 block">
                      Discount: −₹{Number(tpOutputs?.tp?.discount).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-bold text-primary pt-1 border-t">
                  TP Tax ({tpGstRateNum}%): ₹{tpGstAmount.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Owner-Driver PA */}
              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                  Owner-Driver PA Cover
                </span>
                <div className="text-base font-extrabold text-foreground font-mono">
                  ₹{paAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data.paCoverOwner ? 'Opted (₹15L Capital Sum Insured)' : 'Not Opted / Waived'}
                </div>
                <div className="text-[10px] font-bold text-primary pt-1 border-t">
                  PA Tax: ₹{paGstAmount.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Paid Driver Liability */}
              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                  Paid Driver Liability
                </span>
                <div className="text-base font-extrabold text-foreground font-mono">
                  ₹{driverAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data.legalLiabilityPaidDriver === 'Yes' ? 'Opted (IMT 28)' : 'Not Opted'}
                </div>
                <div className="text-[10px] font-bold text-primary pt-1 border-t">
                  Driver Tax: ₹{driverGstAmount.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Add-ons Gross & Tax */}
              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                  Add-ons Gross & Tax
                </span>
                <div className="text-base font-extrabold text-foreground font-mono">
                  ₹{addonGrossAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Discounts: −₹{addonDiscountAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] font-bold text-primary pt-1 border-t">
                  Add-on Tax: ₹{addonGstAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Itemized Add-on Tax Breakdown (when add-ons exist) */}
            {tpItemizedAddons.length > 0 && (
              <div className="p-3 rounded-lg border bg-background space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                  <span>Itemized Add-on Breakdown (Gross Tax Base Rule)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {tpItemizedAddons.length} Cover(s) selected
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {tpItemizedAddons.map((addonItem: any, idx: number) => {
                    const itemBase = addonItem.systemPremium ?? addonItem.amount ?? addonItem.premium ?? 0;
                    const itemDiscPercent = addonItem.discountPercentage ?? addonItem.discountPercent ?? 0;
                    const itemDiscAmt = addonItem.discountAmount ?? 0;
                    const itemNetPreTax = addonItem.netPreTaxAmount ?? addonItem.netPremium ?? Math.max(0, itemBase - itemDiscAmt);
                    const itemGstRate = addonItem.gstRatePercent ?? (addonItem.gstRate ? addonItem.gstRate * 100 : 18);
                    const itemGstAmt = addonItem.gstAmount ?? 0;
                    const itemFinal = addonItem.finalAddonAmount ?? addonItem.totalAmount ?? (itemNetPreTax + itemGstAmt);
                    return (
                      <div key={addonItem.addonCode || idx} className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="font-semibold text-foreground">
                          {addonItem.name || addonItem.addonCode}
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                          <span>Gross Base: ₹{Number(itemBase).toLocaleString('en-IN')}</span>
                          <span>Disc: {itemDiscPercent}% (−₹{Number(itemDiscAmt).toLocaleString('en-IN')})</span>
                          <span className="font-semibold text-foreground">Net Pre-tax: ₹{Number(itemNetPreTax).toLocaleString('en-IN')}</span>
                          <span className="text-primary font-bold">GST ({itemGstRate}%): ₹{Number(itemGstAmt).toLocaleString('en-IN')}</span>
                          <span className="font-extrabold text-foreground">Total: ₹{Number(itemFinal).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Component Tax Summary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-sky-100/70 dark:bg-sky-950/50 border border-sky-200">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-sky-950 dark:text-sky-100">Statutory GST (CGST + SGST):</span>
                <span className="font-extrabold text-primary font-mono text-sm">
                  ₹{totalGstAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  (TP: ₹{tpGstAmount.toLocaleString('en-IN')} | Add-ons: ₹{addonGstAmount.toLocaleString('en-IN')})
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground">Total Premium (incl. GST):</span>
                <span className="font-extrabold text-sky-800 dark:text-sky-200 font-mono text-base">
                  ₹{finalPayableTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

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
              max="100"
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
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 shrink-0">
                <button
                  type="button"
                  aria-label="Subtract commercial adjustment"
                  aria-pressed={(data.commercialAdjustmentDirection || 'SUBTRACT') === 'SUBTRACT'}
                  onClick={() => onChange({ ...data, commercialAdjustmentDirection: 'SUBTRACT' })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
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
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
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

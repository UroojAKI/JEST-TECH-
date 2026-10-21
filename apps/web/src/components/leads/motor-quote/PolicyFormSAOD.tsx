import React, { useEffect, useRef } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Info, Percent } from 'lucide-react';
import { INSURER_OPTIONS, NCB_OPTIONS, ADDON_OPTIONS } from './motorFormConfig';
import type { PolicyFormSAOD, SaodTpVerification, VehicleCategory, MotorEligibilityContext } from './motorFormTypes';
import { GstRateSelector } from './GstRateSelector';
import { useMotorCalculator } from './useMotorCalculator';
import { NcbSlider } from './NcbSlider';
import { OverrideFieldCard } from './OverrideFieldCard';
import { SaodTpVerificationCard } from './SaodTpVerificationCard';

interface Props {
  category?: VehicleCategory;
  vehicleStatus?: 'NEW' | 'EXISTING';
  data: PolicyFormSAOD;
  onChange: (data: PolicyFormSAOD) => void;
  eligibility?: MotorEligibilityContext;
  vehicleDetails?: Record<string, string>;
  targetInsurer?: string;
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

export function PolicyFormSAODForm({ category, vehicleStatus, data, onChange, eligibility, vehicleDetails, targetInsurer }: Props) {
  const set = (key: keyof PolicyFormSAOD) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });

  const setVerification = (key: keyof SaodTpVerification, value: string | boolean) => {
    const shouldResetConfirmation = key !== 'verifiedByUserConfirmed' && key !== 'verificationStatus';
    const updatedVerification: SaodTpVerification = {
      ...data.tpVerification,
      [key]: value,
      ...(shouldResetConfirmation ? { verifiedByUserConfirmed: false, verificationStatus: 'PENDING' } : {}),
    };
    onChange({
      ...data,
      tpVerification: updatedVerification,
      activeTPInsurerName: updatedVerification.tpInsurer,
      activeTPPolicyNumberValidity: `${updatedVerification.tpPolicyNumber} | Valid Till ${updatedVerification.tpExpiryDate}`,
    });
  };

  const effectiveCategory = category || 'PRIVATE_CAR';
  const effectiveStatus = eligibility ? eligibility.vehicleStatus : (vehicleStatus || 'EXISTING');
  const activeTpIsVerified = Boolean(
    data.tpVerification?.tpInsurer &&
    data.tpVerification?.tpPolicyNumber &&
    data.tpVerification?.tpStartDate &&
    data.tpVerification?.tpExpiryDate &&
    data.tpVerification?.verificationMethod &&
    data.tpVerification?.verificationStatus === 'VERIFIED' &&
    data.tpVerification?.verifiedByUserConfirmed
  );

  useEffect(() => {
    if (data.odCommissionPercent || data.commissionAmount || data.ncbDiscountOverride !== undefined) {
      onChange({
        ...data,
        odCommissionPercent: '',
        commissionAmount: '',
        ncbDiscountOverride: undefined,
      });
    }
    // Clear legacy commission and manual NCB amount overrides when opening the SAOD form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engineCc = parseFloat(vehicleDetails?.engineCapacity || vehicleDetails?.engineCc || '0') || undefined;
  const seatingCapacity = parseInt(vehicleDetails?.seatingCapacity || vehicleDetails?.seatLoadCapacity || '0') || undefined;
  const gvwKg = parseFloat(vehicleDetails?.grossVehicleWeight || vehicleDetails?.gvw || '0') || undefined;

  const { result, loading, error } = useMotorCalculator({
    vehicleCategory: effectiveCategory,
    vehicleStatus: effectiveStatus,
    policyType: 'STANDALONE_OD',
    policyTenure: 1,
    // Do not calculate SAOD premium against unconfirmed TP information.
    activeTpPolicyNumber: activeTpIsVerified ? data.tpVerification?.tpPolicyNumber : undefined,
    activeTpExpiryDate: activeTpIsVerified ? data.tpVerification?.tpExpiryDate : undefined,
    activeTpInsurer: activeTpIsVerified ? data.tpVerification?.tpInsurer : undefined,
    activeTpStartDate: activeTpIsVerified ? data.tpVerification?.tpStartDate : undefined,
    activeTpVerificationMethod: activeTpIsVerified ? data.tpVerification?.verificationMethod : undefined,
    activeTpVerificationStatus: activeTpIsVerified ? data.tpVerification?.verificationStatus : undefined,
    activeTpVerifiedByUserConfirmed: activeTpIsVerified ? data.tpVerification?.verifiedByUserConfirmed : false,
    idv: parseFloat(data.insuredDeclaredValue || '0') || 0,
    // NCB eligibility remains derived from the policy; the separate NCB amount override is removed from the SAOD UI.
    ncbPercent: parseInt(data.ncbPercentage || '0') || 0,
    claimInExpiringPolicy: data.claimInExpiringODPolicy === 'Yes',
    odDiscountPercent: parseFloat(data.odDiscountPercent || data.discountPercent || '0') || 0,
    discountPercent: parseFloat(data.discountPercent || '0') || 0,
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
    engineCc,
    seatingCapacity,
    gvwKg,
    odGstRate: data.odGstRate ? parseInt(data.odGstRate) : (data.gstRate ? parseInt(data.gstRate) : 18),
    // Direct OD premium ₹ (canonical Field 1)
    ...(data.odPremiumAmount !== undefined && data.odPremiumAmount !== '' && !isNaN(parseFloat(data.odPremiumAmount))
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
    // SAOD discount is entered as a percentage through discountPercent/odDiscountPercent.
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
    addons: (data.addonsSelected || []).map((a) => ({
      addonCode: a,
      editedPrice: data.addonPrices?.[a] && parseFloat(data.addonPrices[a]) > 0 ? parseFloat(data.addonPrices[a]) : undefined,
      amount: data.addonPrices?.[a] && parseFloat(data.addonPrices[a]) > 0 ? parseFloat(data.addonPrices[a]) : undefined,
      discountPercent: data.addonDiscounts?.[a] && !isNaN(parseFloat(data.addonDiscounts[a])) ? parseFloat(data.addonDiscounts[a]) : undefined,
      gstRate: data.addonGstRates?.[a] && !isNaN(parseInt(data.addonGstRates[a])) ? parseInt(data.addonGstRates[a]) : undefined,
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
      const outputs = result.outputs;
      const current = dataRef.current;
      const netOd = (outputs.netOdPremium ?? outputs.netOdComponent ?? 0).toString();
      const ncbDiscount = (outputs.ncbDiscount ?? 0).toString();
      const addOnsTotal = (outputs.addonPremium ?? 0).toString();
      const gst = (outputs.summary?.totalGst ?? outputs.totalGst ?? outputs.gstOnOd ?? 0).toString();
      const total = (outputs.summary?.finalPayable ?? outputs.finalPayableAmount ?? outputs.totalPremium ?? 0).toString();
      const dAmt = (outputs.specialDiscount ?? 0).toString();
      const baseOd = (outputs.baseOdPremium ?? 0).toString();

      onChange({
        ...current,
        odPremiumBase: baseOd || current.odPremiumBase,
        addOnsPremium: current.addonPremiumOverride ?? addOnsTotal,
        ncbDiscountAmount: ncbDiscount,
        odPremium: current.netOdPremiumOverride ?? netOd,
        gstAmount: current.gstAmountOverride ?? gst,
        totalPremiumInclGST: current.totalPremiumOverride ?? total,
        discountAmount: dAmt,
        odCommissionPercent: '',
        commissionAmount: '',
        finalPayableAmount: current.totalPremiumOverride ?? total,
        gstRate: (result.rateConfig?.gstRatePercent ?? (current.gstRate ? parseInt(current.gstRate) : 18)).toString(),
        calculatedResult: result,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const handleNcbChange = (val: string) => onChange({ ...data, ncbPercentage: val });

  const handleClaimChange = (val: string) => {
    const ncb = val === 'Yes' ? '0' : data.ncbPercentage;
    onChange({ ...data, claimInExpiringODPolicy: val, ncbPercentage: ncb });
  };

  const toggleAddon = (key: string) => {
    const current = data.addonsSelected || [];
    const updated = current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
    onChange({ ...data, addonsSelected: updated });
  };

  const handleDiscountPercentChange = (val: string) => {
    onChange({ ...data, discountPercent: val, odDiscountPercent: val });
  };

  const verification = data.tpVerification;
  const isVerified = verification?.verificationStatus === 'VERIFIED' && verification?.verifiedByUserConfirmed;
  const tpExpired = verification?.tpExpiryDate ? new Date(verification.tpExpiryDate) <= new Date() : false;
  const effectiveResult = result || data.calculatedResult;
  const hasValidCalculation = Boolean(effectiveResult?.outputs);
  const outputs = effectiveResult?.outputs || {};
  const itemizedAddons: any[] = Array.isArray(outputs.itemizedAddons) ? outputs.itemizedAddons : [];

  const hasOdBaseOverride = Boolean((data.odPremiumAmount !== undefined && data.odPremiumAmount !== '') || (data.odBasePremiumOverride !== undefined && data.odBasePremiumOverride !== ''));
  const hasAddonOverride = Boolean(data.addonPremiumOverride !== undefined && data.addonPremiumOverride !== '');
  const hasNetOdOverride = Boolean(data.netOdPremiumOverride !== undefined && data.netOdPremiumOverride !== '');
  const hasGstOverride = Boolean(data.gstAmountOverride !== undefined && data.gstAmountOverride !== '');
  const hasTotalOverride = Boolean(data.totalPremiumOverride !== undefined && data.totalPremiumOverride !== '');

  const odBaseStatus = hasOdBaseOverride ? 'MANUAL' : 'CALCULATED';
  const addonStatus = hasAddonOverride ? 'MANUAL' : 'CALCULATED';
  const netOdStatus = hasNetOdOverride ? 'MANUAL' : ((hasOdBaseOverride || hasAddonOverride) ? 'RECALCULATED' : 'CALCULATED');
  const gstStatus = hasGstOverride ? 'MANUAL' : ((hasOdBaseOverride || hasAddonOverride || hasNetOdOverride) ? 'RECALCULATED' : 'CALCULATED');
  const totalStatus = hasTotalOverride ? 'MANUAL' : ((hasOdBaseOverride || hasAddonOverride || hasNetOdOverride || hasGstOverride) ? 'RECALCULATED' : 'CALCULATED');

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
      <SaodTpVerificationCard
        value={data.tpVerification}
        onChange={(updated) => {
          onChange({
            ...data,
            tpVerification: updated,
            activeTPInsurerName: updated.tpInsurer,
            activeTPPolicyNumberValidity: `${updated.tpPolicyNumber} | Valid Till ${updated.tpExpiryDate}`,
          });
        }}
      />

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
        <div className="col-span-1">
          <NcbSlider
            value={data.ncbPercentage || '0'}
            onChange={handleNcbChange}
            disabled={data.claimInExpiringODPolicy === 'Yes'}
            disabledReason={data.claimInExpiringODPolicy === 'Yes' ? 'Locked to 0% due to claim in expiring OD policy' : undefined}
          />
        </div>
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

      {/* Field 10 & 11: Premium Calculator Breakdown */}
      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-foreground">OD Premium Calculator (Fields 10 & 11)</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-semibold">
            OD Filed Rate + {String(data.gstRate || '18') === '5' ? '5%' : '18%'} GST
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
          <span className="text-xs font-bold text-foreground">OD Applicable GST Rate:</span>
          <select
            value={data.odGstRate || data.gstRate || '18'}
            onChange={(e) => onChange({ ...data, gstRate: e.target.value, odGstRate: e.target.value })}
            className="p-1 text-xs font-bold rounded border bg-background text-primary"
          >
            <option value="18">18% GST (Standard)</option>
            <option value="5">5% GST (Concessional)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <OverrideFieldCard
            label="OD Base Premium (₹)"
            mandatory
            status={odBaseStatus}
            value={data.odPremiumAmount ?? data.odBasePremiumOverride ?? (hasValidCalculation ? (outputs.baseOdPremium?.toString() ?? data.odPremiumBase) : '')}
            onChange={(val) => onChange({ ...data, odPremiumAmount: val, odBasePremiumOverride: val })}
            onReset={() => onChange({ ...data, odPremiumAmount: undefined, odBasePremiumOverride: undefined })}
            hint="Direct OD premium in ₹. Enter manually or defaults from tariff."
            placeholder="Direct OD premium ₹"
          />

          <OverrideFieldCard
            label="Discount (%)"
            status={data.discountPercent !== undefined && data.discountPercent !== '' ? 'MANUAL' : 'CALCULATED'}
            value={data.discountPercent ?? ''}
            onChange={handleDiscountPercentChange}
            onReset={() => onChange({ ...data, discountPercent: '', odDiscountPercent: '' })}
            hint="Enter OD discount percentage; the discount amount is calculated by the server."
            placeholder="e.g. 10"
            min={0}
            step={0.5}
          />

          <OverrideFieldCard
            label="Add-ons Premium (₹)"
            status={addonStatus}
            value={data.addonPremiumOverride ?? (hasValidCalculation ? (outputs.addonPremium?.toString() ?? data.addOnsPremium) : '')}
            onChange={(val) => onChange({ ...data, addonPremiumOverride: val })}
            onReset={() => onChange({ ...data, addonPremiumOverride: undefined })}
            hint="Sum of individual add-on inputs. Editable override."
            placeholder="₹0"
          />

          <OverrideFieldCard
            label="Net OD Premium (₹) [Field 10]"
            status={netOdStatus}
            value={data.netOdPremiumOverride ?? (hasValidCalculation ? (outputs.netOdPremium?.toString() ?? outputs.netOdComponent?.toString() ?? data.odPremium) : '')}
            onChange={(val) => onChange({ ...data, netOdPremiumOverride: val })}
            onReset={() => onChange({ ...data, netOdPremiumOverride: undefined })}
            hint="Auto-calc: OD Base - NCB + Add-ons. Editable override."
            placeholder="Auto-calculated"
            accentColor="font-bold text-foreground"
          />

          <OverrideFieldCard
            label={`Statutory GST (${String(data.gstRate || '18') === '5' ? '5%' : '18%'}) ₹`}
            status={gstStatus}
            value={data.gstAmountOverride ?? (hasValidCalculation ? (outputs.gstOnOd?.toString() ?? outputs.totalGst?.toString() ?? data.gstAmount) : '')}
            onChange={(val) => onChange({ ...data, gstAmountOverride: val })}
            onReset={() => onChange({ ...data, gstAmountOverride: undefined })}
            hint={`${String(data.gstRate || '18') === '5' ? '5%' : '18%'} of Net OD Premium. Editable override.`}
            placeholder="Auto-calculated"
          />

          <OverrideFieldCard
            label="Total Premium incl. GST (₹) [Field 11]"
            mandatory
            status={totalStatus}
            value={data.totalPremiumOverride ?? (hasValidCalculation ? (outputs.finalPayableAmount?.toString() ?? outputs.totalPremium?.toString() ?? data.totalPremiumInclGST) : '')}
            onChange={(val) => onChange({ ...data, totalPremiumOverride: val })}
            onReset={() => onChange({ ...data, totalPremiumOverride: undefined })}
            hint="System-calculated authoritative gross. Editable override."
            placeholder="Auto-calculated"
            accentColor="font-black text-primary text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">

        </div>
      </div>

      {/* Field 12: Policy Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Policy Start Date" hint="Must be within the active TP period">
          <input type="date" value={data.policyStartDate} onChange={(e) => {
            const val = e.target.value;
            if (val) {
              const d = new Date(val);
              d.setFullYear(d.getFullYear() + 1);
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

      {/* Discounts & Commercial Adjustment */}
      <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-foreground">Discounts & Commercial Adjustment</span>
            <span className="text-[9px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              Server-Calculated
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow
            label="OD Discount Amount (₹)"
            hint="Server-calculated amount from the entered discount percentage"
          >
            <input
              type="number"
              value={hasValidCalculation ? (outputs.summary?.odDiscountAmount ?? outputs.od?.discount ?? outputs.odDiscountAmount ?? '0') : ''}
              readOnly
              className={`${readonlyInput} font-mono font-bold text-amber-600`}
              placeholder="₹0"
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <FieldRow
            label="Commercial Adjustment (₹)"
            hint="Fixed ₹ adjustment to payable base"
          >
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
                value={data.commercialAdjustmentAmount || ''}
                onChange={(e) => onChange({ ...data, commercialAdjustmentAmount: e.target.value, commercialDiscountPercent: undefined })}
                placeholder="₹0"
                className={`${inputBase} font-mono`}
              />
            </div>
          </FieldRow>
          <FieldRow
            label="Total Discounts & Adjustments (₹)"
            hint="Itemized OD discount + Commercial adjustment"
          >
            <input
              type="text"
              readOnly
              value={hasValidCalculation ? '₹' + Number(outputs.summary?.totalDiscount ?? outputs.totalDiscountAmount ?? 0).toLocaleString('en-IN') : '—'}
              className={`${readonlyInput} font-mono font-bold text-amber-700`}
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
              Server-calculated premium after applicable discounts and tax
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {hasValidCalculation ? '₹' + Number(outputs.finalPayableAmount ?? outputs.totalPremium ?? data.finalPayableAmount ?? data.totalPremiumInclGST ?? 0).toLocaleString('en-IN') : '—'}
          </div>
        </div>
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">Premium calculation failed: {error}</div>}
    </div>
  );
}

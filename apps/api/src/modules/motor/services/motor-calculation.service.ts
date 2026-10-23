import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  MotorCalculationInputDto,
  PayableDiscount,
  PayableSummary,
  UnderwritingMetadata,
} from '../dto/motor-calculation.dto';
import { MotorTariffService } from './motor-tariff.service';
import { MotorPolicyDateService } from './motor-policy-date.service';

export const VALID_NCB_PERCENTAGES = [0, 20, 25, 35, 45, 50];
import {
  ConfigurationMissingEntity,
  MotorCalculationOverrideInputDto,
} from '../dto/motor-pricing-contract.dto';

const round2 = (num: number): number =>
  Math.round((num + Number.EPSILON) * 100) / 100;

// Statutory OD Base Rate fallback (filed insurer schedule)
const FALLBACK_OD_RATES: Record<string, number> = {
  PRIVATE_CAR: 3.127,
  BIKE: 1.708,
  GCV: 2.15,
  PCV: 2.15,
  TRACTOR: 2.15,
  AUTO: 2.15,
  TAXI: 2.15,
  BUS_COACH: 2.15,
  MISC_CLASS_D: 2.15,
};

// IRDAI Compulsory PA Cover premium (₹15 Lakh cover, fixed IRDAI rate)
const COMPULSORY_PA_OWNER_DRIVER = 275;
// Legal Liability to Paid Driver (per IRDAI notification)
const PAID_DRIVER_LL_RATE = 50;

@Injectable()
export class MotorCalculationService {
  private readonly logger = new Logger(MotorCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly motorTariffService: MotorTariffService,
    @Optional()
    private readonly policyDateService: MotorPolicyDateService = new MotorPolicyDateService(),
  ) {}

  async calculate(input: MotorCalculationInputDto) {
    // ── 1. Structural Validation ───────────────────────────────────────────
    this.validateInputs(input);

    // ── 2. TP Tenure Resolution ────────────────────────────────────────────
    const tpTenure = this.resolveTpTenure(input);

    // ── 3. NCB Resolution (NEW vehicle = strictly 0, or reset if claim) ───
    const effectiveNcb =
      input.vehicleStatus === 'NEW'
        ? 0
        : input.claimInExpiringPolicy
          ? 0
          : input.ncbPercent || 0;

    // ── 4. Fetch Configuration-Driven Rates ────────────────────────────────
    const { tpRates, odRates, gstRate, discountConfig, addonRates } =
      await this.fetchConfiguration(input);

    // ── 5. Dual Discount Authority Validation (OD + TP) ───────────────────
    // Thresholds come from DB config, not hardcoded constants.
    this.validateDiscountAuthority(input, discountConfig);
    this.validateTpDiscountAuthority(input, discountConfig);

    // ── 5b. Pricing Overrides & Editable Fields Resolution ────────────────
    const overridesApplied: Array<{
      field: string;
      systemValue: number;
      overrideValue: number;
      status: 'APPLIED' | 'REQUIRES_APPROVAL';
      reason?: string;
    }> = [];

    // ── Phase 1 & 3: Direct OD Premium Resolution ─────────────────────────
    // Direct OD Premium in ₹ (canonical path) takes total precedence.
    // The obsolete OD-rate bounds validation (0.1% - 15.0%) is completely removed.
    const odBaseOverride = input.overrides?.find((o) => o.field === 'OD_BASE' || o.field === 'OD_PREMIUM_DIRECT');
    const directOdInput = input.odPremium !== undefined
      ? input.odPremium
      : input.odPremiumAmount !== undefined
        ? input.odPremiumAmount
        : (input.odBasePremium !== undefined
            ? input.odBasePremium
            : (odBaseOverride ? odBaseOverride.overrideValue : undefined));
    const hasDirectOd = directOdInput !== undefined && directOdInput !== null && !isNaN(Number(directOdInput));
    const directOdAmount = hasDirectOd ? round2(Number(directOdInput)) : undefined;

    let effectiveOdRate = odRates.rate;
    let isOdRateEdited = false;

    if (hasDirectOd && directOdAmount !== undefined) {
      isOdRateEdited = true;
      overridesApplied.push({
        field: 'OD_PREMIUM_DIRECT',
        systemValue: round2((input.idv ?? 0) * (odRates.rate / 100)),
        overrideValue: directOdAmount,
        status: 'APPLIED',
        reason: odBaseOverride?.reason || 'Direct OD premium ₹ input (agent-entered gross)',
      });
    } else {
      // Legacy / backwards-compatible path for callers providing editedOdRate or OD_RATE override.
      // Crucial: No out-of-bounds error is thrown regardless of rate percentage (e.g. 0.013%).
      const odOverride = input.overrides?.find((o) => o.field === 'OD_RATE');
      const candidateOd = input.editedOdRate !== undefined
        ? Number(input.editedOdRate)
        : (odOverride ? Number(odOverride.overrideValue) : undefined);

      if (candidateOd !== undefined && !isNaN(candidateOd) && candidateOd >= 0) {
        effectiveOdRate = candidateOd;
        isOdRateEdited = Math.abs(candidateOd - odRates.rate) > 0.0001;
        if (isOdRateEdited) {
          overridesApplied.push({
            field: 'OD_RATE',
            systemValue: odRates.rate,
            overrideValue: candidateOd,
            status: 'APPLIED',
            reason: odOverride?.reason || 'Agent OD rate edit',
          });
        }
      }
    }

    // TP Premium Override / Edit (Canonical: annualTpPremium / editedTpAnnualPremium)
    const tpOverride = input.overrides?.find((o) => o.field === 'TP_PREMIUM');
    let effectiveTpAnnual = tpRates.annualPremium;
    let isTpEdited = false;
    const rawEditedTp =
      (input as any).annualTpPremium !== undefined
        ? (input as any).annualTpPremium
        : input.editedTpAnnualPremium !== undefined
          ? input.editedTpAnnualPremium
          : input.editedTpPremium;
    if (rawEditedTp !== undefined || tpOverride) {
      const candidateTp = rawEditedTp !== undefined
        ? Number(rawEditedTp)
        : Number(tpOverride?.overrideValue);

      if (!isNaN(candidateTp) && candidateTp >= 0 && candidateTp <= 500000) {
        effectiveTpAnnual = candidateTp;
        isTpEdited = Math.abs(candidateTp - tpRates.annualPremium) > 0.01;
        if (isTpEdited) {
          overridesApplied.push({
            field: 'TP_PREMIUM',
            systemValue: tpRates.annualPremium,
            overrideValue: candidateTp,
            status: 'APPLIED',
            reason: tpOverride?.reason || 'Agent TP premium edit within permissible bounds',
          });
        }
      } else {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'TP_PREMIUM_OUT_OF_BOUNDS',
          message: `Edited TP premium (₹${candidateTp}) must be a valid non-negative number within maximum permissible limit (₹500,000).`,
        });
      }
    }

    // PA Premium Override / Edit
    const paOverride = input.overrides?.find((o) => o.field === 'PA_PREMIUM');
    let effectivePaRate = COMPULSORY_PA_OWNER_DRIVER;
    let isPaEdited = false;
    if (input.editedPaPremium !== undefined || paOverride) {
      const candidatePa = input.editedPaPremium !== undefined
        ? Number(input.editedPaPremium)
        : Number(paOverride?.overrideValue);
      if (candidatePa >= 0 && candidatePa <= 5000) {
        effectivePaRate = candidatePa;
        isPaEdited = Math.abs(candidatePa - COMPULSORY_PA_OWNER_DRIVER) > 0.01;
        if (isPaEdited) {
          overridesApplied.push({
            field: 'PA_PREMIUM',
            systemValue: COMPULSORY_PA_OWNER_DRIVER,
            overrideValue: candidatePa,
            status: 'APPLIED',
            reason: paOverride?.reason || 'Agent PA premium edit within bounds',
          });
        }
      }
    }

    // Paid Driver Premium Override / Edit
    const driverOverride = input.overrides?.find((o) => o.field === 'PAID_DRIVER_PREMIUM');
    let effectiveDriverRate = PAID_DRIVER_LL_RATE;
    let isDriverEdited = false;
    if (input.editedPaidDriverPremium !== undefined || driverOverride) {
      const candidateDriver = input.editedPaidDriverPremium !== undefined
        ? Number(input.editedPaidDriverPremium)
        : Number(driverOverride?.overrideValue);
      if (candidateDriver >= 0 && candidateDriver <= 2000) {
        effectiveDriverRate = candidateDriver;
        isDriverEdited = Math.abs(candidateDriver - PAID_DRIVER_LL_RATE) > 0.01;
        if (isDriverEdited) {
          overridesApplied.push({
            field: 'PAID_DRIVER_PREMIUM',
            systemValue: PAID_DRIVER_LL_RATE,
            overrideValue: candidateDriver,
            status: 'APPLIED',
            reason: driverOverride?.reason || 'Agent Paid Driver edit within bounds',
          });
        }
      }
    }

    // ── 6. OD Component ────────────────────────────────────────────────────
    let baseOdPremium = 0;
    let ncbDiscountAmount = 0;
    let specialDiscountAmount = 0;
    let netOdAfterDiscount = 0;
    let addonPremiumTotal = 0;
    let totalAddonDiscountAmount = 0;
    let totalAddonGstAmount = 0;
    let odDiscountAmount = 0;
    let effectiveOdDiscountPercent = 0;
    let isNcbOverridden = false;
    let isAddonTotalOverridden = false;
    let isNetOdOverridden = false;
    let isGstOverridden = false;
    let isTotalOverridden = false;
    let systemAddonPremiumTotal = 0;
    let systemNetOdComponent = 0;
    let systemGstOnOd = 0;
    let systemFinalPayable = 0;
    const itemizedAddons: Array<{
      addonCode: string;
      name: string;
      amount: number;
      premium?: number;
      systemPremium?: number;
      editedPremium?: number;
      discountPercent?: number;
      discountPercentage?: number;
      discountAmount?: number;
      netPreTaxAmount?: number;
      netPremium?: number;
      taxableAddonAmount?: number;
      taxableBase?: number;
      gstRate?: number;
      gstRatePercent?: number;
      gstAmount?: number;
      totalAmount?: number;
      finalAddonAmount?: number;
      systemRate?: number;
      isEdited?: boolean;
      isInvalid?: boolean;
      warning?: string;
    }> = [];

    if (['STANDALONE_OD', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      if (!input.idv)
        throw new BadRequestException('IDV is required for OD calculation');

      const minIdv = 10000;
      const maxIdv = 50_000_000;
      if (input.idv < minIdv || input.idv > maxIdv) {
        throw new BadRequestException(
          `IDV must be between ₹${minIdv.toLocaleString('en-IN')} and ₹${maxIdv.toLocaleString('en-IN')}`,
        );
      }

      // Phase 1, 2, 3, 4 — Direct ₹ OD Premium path (canonical):
      // When directOdAmount is provided, it IS the gross OD premium.
      // Bypasses IDV × rate formula entirely.
      if (hasDirectOd && directOdAmount !== undefined) {
        baseOdPremium = directOdAmount;
      } else {
        baseOdPremium = round2(input.idv! * (effectiveOdRate / 100));
      }

      // Canonical Business Rule: NCB is strictly underwriting risk metadata;
      // it does NOT deduct a monetary discount from baseOdPremium or the payable total,
      // UNLESS an explicit manual override is provided.
      const ncbOverride = input.overrides?.find((o) => o.field === 'NCB_DISCOUNT');
      const candidateNcbDiscount = input.ncbDiscount !== undefined
        ? input.ncbDiscount
        : (input.ncbDiscountAmount !== undefined
            ? input.ncbDiscountAmount
            : (ncbOverride ? ncbOverride.overrideValue : undefined));

      if (candidateNcbDiscount !== undefined && candidateNcbDiscount !== null && !isNaN(Number(candidateNcbDiscount))) {
        const manualNcb = round2(Math.max(0, Number(candidateNcbDiscount)));
        if (manualNcb > baseOdPremium) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'NCB_DISCOUNT_EXCEEDS_BASE',
            message: `NCB discount (₹${manualNcb.toLocaleString('en-IN')}) cannot exceed OD base premium (₹${baseOdPremium.toLocaleString('en-IN')}).`,
          });
        }
        ncbDiscountAmount = manualNcb;
        isNcbOverridden = true;
        overridesApplied.push({
          field: 'NCB_DISCOUNT',
          systemValue: 0,
          overrideValue: ncbDiscountAmount,
          status: 'APPLIED',
          reason: ncbOverride?.reason || 'User manual override of NCB discount amount',
        });
      } else {
        ncbDiscountAmount = 0;
      }

      effectiveOdDiscountPercent = Number(
        input.odDiscountPercent ||
          (input.policyType === 'STANDALONE_OD'
            ? (input.commercialDiscountPercent ?? input.discountPercent ?? 0)
            : 0),
      );

      odDiscountAmount = round2(
        baseOdPremium * (effectiveOdDiscountPercent / 100),
      );
      specialDiscountAmount = odDiscountAmount;
      netOdAfterDiscount = round2(Math.max(0, baseOdPremium - ncbDiscountAmount - odDiscountAmount));
    }

    // ── 7. TP Component (PA and Paid Driver are separate sub-components) ───
    let baseTpPremium = 0;
    let paPremium = 0; // Compulsory PA for Owner-Driver (₹15L cover)
    let paidDriverPremium = 0; // Legal Liability to Paid Driver
    let tpDiscountAmount = 0;

    const effectiveTpDiscountPercent = Number(
      input.tpDiscountPercent ||
        (input.policyType === 'THIRD_PARTY_ONLY' && input.commercialDiscountPercent === undefined
          ? (input.discountPercent ?? 0)
          : 0),
    );

    if (
      ['THIRD_PARTY_ONLY', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)
    ) {
      baseTpPremium = round2(effectiveTpAnnual * tpTenure);
      // PA for Owner-Driver is COMPULSORY unless explicitly opted out with a waiver.
      if (input.paCover !== false) paPremium = effectivePaRate;
      if (input.paidDriverLiability) paidDriverPremium = effectiveDriverRate;

      tpDiscountAmount = round2(
        baseTpPremium * (effectiveTpDiscountPercent / 100),
      );
    }

    // ── 8. Add-on Premiums with Independent Discounts & GST (Phase 3) ───
    // Applicable across Standalone OD, Comprehensive Package, and Third-Party Only
    const hasOd = ['STANDALONE_OD', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType);
    const defaultAddonGstRate = hasOd
      ? (input.odGstRate !== undefined ? (Number(input.odGstRate) > 1 ? Number(input.odGstRate) / 100 : Number(input.odGstRate)) : gstRate)
      : (input.tpGstRate !== undefined ? (Number(input.tpGstRate) > 1 ? Number(input.tpGstRate) / 100 : Number(input.tpGstRate)) : gstRate);

    for (const addon of input.addons || []) {
      let price = 0;
      let systemPrice = 0;
      let isAddonEdited = false;

      try {
        const config = addonRates[addon.addonCode];
        if (config) {
          switch (config.pricingModel) {
            case 'PERCENT_OF_IDV':
              systemPrice = round2((input.idv || 0) * (Number(config.rateValue) / 100));
              break;
            case 'PERCENT_OF_OD':
              systemPrice = round2(baseOdPremium * (Number(config.rateValue) / 100));
              break;
            case 'FIXED':
              systemPrice = round2(Number(config.rateValue));
              break;
            default:
              systemPrice = 0;
          }
        } else {
          systemPrice = this.resolveStandardAddonRate(
            addon.addonCode,
            input.idv || 0,
            baseOdPremium,
          );
        }

        // Check for client-specified or authorized edit
        const addonOverride = input.overrides?.find((o) => o.field === `ADDON:${addon.addonCode}`);
        const candidatePrice = addon.editedPrice !== undefined
          ? Number(addon.editedPrice)
          : (addon.amount !== undefined
              ? Number(addon.amount)
              : (addonOverride ? Number(addonOverride.overrideValue) : undefined));

        if (candidatePrice !== undefined && candidatePrice > 0) {
          price = round2(candidatePrice);
          isAddonEdited = Math.abs(price - systemPrice) > 0.01;
          if (isAddonEdited) {
            overridesApplied.push({
              field: `ADDON:${addon.addonCode}`,
              systemValue: systemPrice,
              overrideValue: price,
              status: 'APPLIED',
              reason: addon.overrideReason || addonOverride?.reason || 'Agent add-on edit within bounds',
            });
          }
        } else {
          price = systemPrice;
        }

        if (price > 0) {
          // Independent Add-on Discount
          const addonDiscPercent = Number(addon.discountPercent || 0);
          const addonDiscAmt = round2(price * (addonDiscPercent / 100));

          // Independent Add-on GST (5% vs 18%)
          const rawAddonGst = addon.gstRate !== undefined
            ? (Number(addon.gstRate) > 1 ? Number(addon.gstRate) / 100 : Number(addon.gstRate))
            : defaultAddonGstRate;
          const addonGstRateFinal = (rawAddonGst === 0.05) ? 0.05 : 0.18;
          const addonGstAmt = round2(price * addonGstRateFinal);
          const addonTotalAmt = round2(price - addonDiscAmt + addonGstAmt);

          const netPreTaxAddon = round2(Math.max(0, price - addonDiscAmt));
          addonPremiumTotal = round2(addonPremiumTotal + price);
          totalAddonDiscountAmount = round2(totalAddonDiscountAmount + addonDiscAmt);
          totalAddonGstAmount = round2(totalAddonGstAmount + addonGstAmt);

          itemizedAddons.push({
            addonCode: addon.addonCode,
            name: addon.addonCode.replace(/_/g, ' '),
            amount: price,
            premium: price,
            systemPremium: systemPrice,
            editedPremium: isAddonEdited ? price : undefined,
            discountPercent: addonDiscPercent,
            discountPercentage: addonDiscPercent,
            discountAmount: addonDiscAmt,
            netPreTaxAmount: netPreTaxAddon,
            netPremium: netPreTaxAddon,
            taxableAddonAmount: price, // CORE BUSINESS RULE: GST base = gross premium before discount
            taxableBase: price,
            gstRate: addonGstRateFinal,
            gstRatePercent: round2(addonGstRateFinal * 100),
            gstAmount: addonGstAmt,
            totalAmount: addonTotalAmt,
            finalAddonAmount: addonTotalAmt,
            systemRate: systemPrice,
            isEdited: isAddonEdited,
          });
        } else {
          itemizedAddons.push({
            addonCode: addon.addonCode,
            name: addon.addonCode.replace(/_/g, ' '),
            amount: 0,
            premium: 0,
            systemPremium: systemPrice,
            editedPremium: undefined,
            discountPercent: 0,
            discountPercentage: 0,
            discountAmount: 0,
            netPreTaxAmount: 0,
            netPremium: 0,
            taxableAddonAmount: 0,
            taxableBase: 0,
            gstRate: 0.18,
            gstRatePercent: 18,
            gstAmount: 0,
            totalAmount: 0,
            finalAddonAmount: 0,
            systemRate: systemPrice,
            isEdited: isAddonEdited,
            isInvalid: true,
            warning: `Add-on "${addon.addonCode}" has zero or unresolvable premium and was omitted from calculation total.`,
          });
        }
      } catch (addonErr) {
        this.logger.warn(
          `Skipping invalid add-on "${addon.addonCode}": ${(addonErr as Error)?.message || addonErr}`,
        );
        itemizedAddons.push({
          addonCode: addon.addonCode,
          name: addon.addonCode.replace(/_/g, ' '),
          amount: 0,
          premium: 0,
          systemPremium: 0,
          editedPremium: undefined,
          discountPercent: 0,
          discountPercentage: 0,
          discountAmount: 0,
          netPreTaxAmount: 0,
          netPremium: 0,
          taxableAddonAmount: 0,
          taxableBase: 0,
          gstRate: 0.18,
          gstRatePercent: 18,
          gstAmount: 0,
          totalAmount: 0,
          finalAddonAmount: 0,
          systemRate: 0,
          isEdited: false,
          isInvalid: true,
          warning: (addonErr as Error)?.message || 'Invalid add-on',
        });
      }
    }

    // ── 8b. Add-ons Total Override ─────────────────────────────────────────
    systemAddonPremiumTotal = addonPremiumTotal;
    const addonTotalOverride = input.overrides?.find((o) => o.field === 'ADDON_TOTAL' || o.field === 'ADDON_PREMIUM');
    const candidateAddonTotal = input.addonPremium !== undefined
      ? input.addonPremium
      : (input.addOnsPremium !== undefined
          ? input.addOnsPremium
          : (addonTotalOverride ? addonTotalOverride.overrideValue : undefined));

    if (candidateAddonTotal !== undefined && candidateAddonTotal !== null && !isNaN(Number(candidateAddonTotal))) {
      const manualAddon = round2(Math.max(0, Number(candidateAddonTotal)));
      addonPremiumTotal = manualAddon;
      isAddonTotalOverridden = true;
      overridesApplied.push({
        field: 'ADDON_TOTAL',
        systemValue: systemAddonPremiumTotal,
        overrideValue: addonPremiumTotal,
        status: 'APPLIED',
        reason: addonTotalOverride?.reason || 'User manual override of add-ons total premium',
      });
    }

    // ── 9. Undiscounted Gross Components (pre-discount, pre-tax) ───────────
    systemNetOdComponent = round2(netOdAfterDiscount + (hasOd ? addonPremiumTotal : 0));

    let netOdComponent = systemNetOdComponent;
    const netOdOverride = input.overrides?.find((o) => o.field === 'NET_OD_PREMIUM');
    const candidateNetOd = input.netOdPremium !== undefined
      ? input.netOdPremium
      : ((input as any).odPremiumNet !== undefined
          ? (input as any).odPremiumNet
          : (netOdOverride ? netOdOverride.overrideValue : undefined));

    if (candidateNetOd !== undefined && candidateNetOd !== null && !isNaN(Number(candidateNetOd))) {
      const manualNetOd = round2(Math.max(0, Number(candidateNetOd)));
      netOdComponent = manualNetOd;
      isNetOdOverridden = true;
      overridesApplied.push({
        field: 'NET_OD_PREMIUM',
        systemValue: systemNetOdComponent,
        overrideValue: netOdComponent,
        status: 'APPLIED',
        reason: netOdOverride?.reason || 'User manual override of Net OD Premium (Field 10)',
      });
    }

    const netTpComponent = round2(
      Math.max(0, baseTpPremium - tpDiscountAmount),
    );
    const netPaComponent = paPremium; // PA is fixed
    const netPaidDriverComponent = paidDriverPremium; // Fixed

    // Step 1: Gross Premium Before Discount (undiscounted reference total)
    const premiumBeforeDiscount = round2(
      baseOdPremium + (hasOd ? addonPremiumTotal : 0) + baseTpPremium + netPaComponent + netPaidDriverComponent + (hasOd ? 0 : addonPremiumTotal),
    );
    const netCustomerPremium = premiumBeforeDiscount;

    // ── 10. Component-Level GST Calculation on GROSS Premium Base ──────────
    // CORE BUSINESS RULE: GST base = gross premium before discount.
    // If Net OD (Field 10) was overridden, the accepted Net OD becomes the taxable base for OD GST.
    const odGrossBase = hasOd
      ? (isNetOdOverridden ? netOdComponent : round2(baseOdPremium + addonPremiumTotal))
      : 0;
    const tpGrossBase = baseTpPremium;
    const paGrossBase = paPremium;
    const paidDriverGrossBase = paidDriverPremium;

    // Resolve component GST rates:
    const odGstRate = input.odGstRate !== undefined
      ? (Number(input.odGstRate) > 1 ? Number(input.odGstRate) / 100 : Number(input.odGstRate))
      : gstRate;

    const tpGstRate = input.tpGstRate !== undefined
      ? (Number(input.tpGstRate) > 1 ? Number(input.tpGstRate) / 100 : Number(input.tpGstRate))
      : (gstRate === 0.05 ? 0.05 : gstRate);

    const paGstRate = input.paGstRate !== undefined
      ? (Number(input.paGstRate) > 1 ? Number(input.paGstRate) / 100 : Number(input.paGstRate))
      : gstRate;

    const paidDriverGstRate = input.paidDriverGstRate !== undefined
      ? (Number(input.paidDriverGstRate) > 1 ? Number(input.paidDriverGstRate) / 100 : Number(input.paidDriverGstRate))
      : gstRate;

    systemGstOnOd = hasOd ? round2(odGrossBase * odGstRate) : 0;
    let gstOnOd = systemGstOnOd;
    const gstOverride = input.overrides?.find((o) => o.field === 'GST_AMOUNT');
    const candidateGst = input.gstAmount !== undefined
      ? input.gstAmount
      : ((input as any).odGstAmount !== undefined
          ? (input as any).odGstAmount
          : (gstOverride ? gstOverride.overrideValue : undefined));

    if (candidateGst !== undefined && candidateGst !== null && !isNaN(Number(candidateGst))) {
      const manualGst = round2(Math.max(0, Number(candidateGst)));
      gstOnOd = manualGst;
      isGstOverridden = true;
      overridesApplied.push({
        field: 'GST_AMOUNT',
        systemValue: systemGstOnOd,
        overrideValue: gstOnOd,
        status: 'APPLIED',
        reason: gstOverride?.reason || 'User manual override of Statutory GST amount',
      });
    }

    const gstOnTp = round2(tpGrossBase * tpGstRate);
    const gstOnPa = round2(paGrossBase * paGstRate);
    const gstOnPaidDriver = round2(paidDriverGrossBase * paidDriverGstRate);

    // Step 2: Component-Level GST Total
    // If hasOd, odGrossBase already includes addon premiums at odGstRate.
    // If !hasOd (TP Only), add-on GST is computed per-addon and added to componentGstTotal.
    const componentGstTotal = round2(gstOnOd + gstOnTp + gstOnPa + gstOnPaidDriver + (hasOd ? 0 : totalAddonGstAmount));
    const totalGst = componentGstTotal;
    const cgst = round2(totalGst / 2);
    const sgst = round2(totalGst - cgst);

    const gstBreakdown = {
      base: 'GROSS',
      od: {
        base: odGrossBase,
        rate: odGstRate,
        amount: gstOnOd,
      },
      tp: {
        base: tpGrossBase,
        rate: tpGstRate,
        amount: gstOnTp,
      },
      pa: {
        base: paGrossBase,
        rate: paGstRate,
        amount: gstOnPa,
      },
      paidDriver: {
        base: paidDriverGrossBase,
        rate: paidDriverGstRate,
        amount: gstOnPaidDriver,
      },
      addons: {
        base: addonPremiumTotal,
        taxableBase: addonPremiumTotal,
        discount: totalAddonDiscountAmount,
        netPreTaxBase: round2(Math.max(0, addonPremiumTotal - totalAddonDiscountAmount)),
        rate: defaultAddonGstRate,
        ratePercent: round2(defaultAddonGstRate * 100),
        amount: totalAddonGstAmount,
        items: itemizedAddons,
      },
    };

    // ── 11. Payable Base, Commercial Adjustment (ADD / SUBTRACT), and Final Payable ──
    // Step 3: Payable Base = Gross Premium Before Discount + Component GST Total
    const payableBase = round2(premiumBeforeDiscount + componentGstTotal);

    // Step 4: Independent Discounts & Signed Commercial Adjustment (Phase 4)
    // Direction: ADD (+ loading/surcharge) or SUBTRACT (- discount)
    const rawDirection = (input as any).commercialAdjustmentDirection || (input as any).commercialAdjustmentType || 'SUBTRACT';
    const commercialAdjustmentDirection: 'ADD' | 'SUBTRACT' = String(rawDirection).toUpperCase() === 'ADD' ? 'ADD' : 'SUBTRACT';
    const isAdd = commercialAdjustmentDirection === 'ADD';

    // Commercial discount percentage (legacy fallback)
    const commercialDiscountPercent = Number(
      input.commercialDiscountPercent !== undefined
        ? input.commercialDiscountPercent
        : (input.odDiscountPercent === undefined && input.tpDiscountPercent === undefined && input.discountPercent !== undefined
            ? input.discountPercent
            : 0),
    );

    // Phase 3 & 4 canonical: fixed ₹ amount takes priority over percentage
    const directCommAdj = (input as any).commercialAdjustment !== undefined
      ? (input as any).commercialAdjustment
      : input.commercialAdjustmentAmount;
    const isFixedRupeeCommercial = directCommAdj !== undefined && directCommAdj !== null && !isNaN(Number(directCommAdj));
    const commercialAdjustmentRupees = isFixedRupeeCommercial
      ? round2(Math.abs(Number(directCommAdj)))
      : round2(payableBase * (commercialDiscountPercent / 100));

    // Deductions before commercial adjustment: OD discount + TP discount + Addon discounts
    const componentDiscountsTotal = round2(
      odDiscountAmount + tpDiscountAmount + totalAddonDiscountAmount,
    );

    if (componentDiscountsTotal > payableBase) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'DISCOUNTS_EXCEED_PAYABLE_BASE',
        message: `Total component discounts (₹${componentDiscountsTotal.toLocaleString('en-IN')}) exceed payable base (₹${payableBase.toLocaleString('en-IN')}). Final payable cannot be negative.`,
      });
    }

    const payableBeforeAdjustment = round2(
      Math.max(0, payableBase - componentDiscountsTotal),
    );

    // Signed Commercial Adjustment: S = +1 for ADD, S = -1 for SUBTRACT
    // P_final = P_before adjustment + S * A
    const signedCommercialAdjustment = isAdd ? commercialAdjustmentRupees : -commercialAdjustmentRupees;
    systemFinalPayable = isNetOdOverridden && input.policyType === 'STANDALONE_OD'
      ? round2(Math.max(0, netOdComponent + gstOnOd + signedCommercialAdjustment))
      : round2(payableBeforeAdjustment + signedCommercialAdjustment);
    let finalPayableAmount = systemFinalPayable;

    const totalOverride = input.overrides?.find((o) => o.field === 'TOTAL_PREMIUM' || o.field === 'FIELD_11');
    const candidateTotal = (input as any).totalPremiumOverride !== undefined && (input as any).totalPremiumOverride !== '' && !isNaN(Number((input as any).totalPremiumOverride))
      ? Number((input as any).totalPremiumOverride)
      : (totalOverride ? totalOverride.overrideValue : undefined);

    if (candidateTotal !== undefined && candidateTotal !== null && !isNaN(Number(candidateTotal))) {
      finalPayableAmount = round2(Math.max(0, Number(candidateTotal)));
      isTotalOverridden = true;
      overridesApplied.push({
        field: 'TOTAL_PREMIUM',
        systemValue: systemFinalPayable,
        overrideValue: finalPayableAmount,
        status: 'APPLIED',
        reason: totalOverride?.reason || 'Field 11 total premium manual override',
      });
    }

    if (finalPayableAmount < 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'COMMERCIAL_ADJUSTMENT_EXCEEDS_PAYABLE',
        message: `Commercial adjustment of ₹${commercialAdjustmentRupees.toLocaleString('en-IN')} (${commercialAdjustmentDirection}) exceeds payable base (payable before adjustment: ₹${payableBeforeAdjustment.toLocaleString('en-IN')}). Total deductions cannot exceed payable base and final payable cannot be negative.`,
      });
    }

    // Commercial discount amount (for total discount reporting):
    // When SUBTRACT, it's a discount of ₹A. When ADD, commercial discount is 0 (it is a surcharge / loading).
    const commercialDiscountAmount = isAdd ? 0 : commercialAdjustmentRupees;
    const totalDiscountAmount = round2(componentDiscountsTotal + commercialDiscountAmount);

    const commercialDiscount: PayableDiscount = {
      percentage: isFixedRupeeCommercial ? 0 : (isAdd ? 0 : commercialDiscountPercent),
      baseAmount: payableBase,
      amount: commercialDiscountAmount,
      reason: input.discountReason || input.approvalReference || undefined,
      fixedRupeeAmount: isFixedRupeeCommercial ? commercialAdjustmentRupees : undefined,
    };

    // Underwriting Metadata (NCB selection & claim history)
    const underwriting: UnderwritingMetadata = {
      ncbPercentage: effectiveNcb,
      ncbEligible: effectiveNcb > 0,
      claimReported: Boolean(input.claimInExpiringPolicy),
    };

    // Canonical Payable Summary
    const payableSummary: PayableSummary = {
      odGrossPremium: baseOdPremium,
      odPremium: baseOdPremium,
      tpGrossPremium: baseTpPremium,
      annualTpPremium: effectiveTpAnnual,
      tenure: tpTenure,
      paGrossPremium: paPremium,
      paCoverPremium: paPremium,
      paidDriverGrossPremium: paidDriverPremium,
      addonGrossPremium: round2(addonPremiumTotal),
      grossPremium: premiumBeforeDiscount,
      premiumBeforeDiscount,
      componentGstTotal,
      gstTotal: componentGstTotal,
      payableBase,
      odDiscountAmount,
      odDiscount: odDiscountAmount,
      tpDiscountAmount,
      tpDiscount: tpDiscountAmount,
      addonDiscountAmount: totalAddonDiscountAmount,
      addonDiscount: totalAddonDiscountAmount,
      addonGstTotal: totalAddonGstAmount,
      addonGst: totalAddonGstAmount,
      commercialDiscountAmount,
      commercialAdjustment: isFixedRupeeCommercial ? commercialAdjustmentRupees : undefined,
      commercialAdjustmentAmount: isFixedRupeeCommercial ? commercialAdjustmentRupees : undefined,
      commercialAdjustmentDirection,
      commercialDiscount,
      totalDiscount: totalDiscountAmount,
      totalDiscounts: totalDiscountAmount,
      finalPayableAmount,
      finalPayable: finalPayableAmount,
      gstBreakdown,
    };

    const authoritativeDates = this.policyDateService.calculateMotorDates({
      vehicleStatus: input.vehicleStatus,
      vehicleCategory: input.vehicleCategory?.toString(),
      policyType: input.policyType,
      policyTenure: tpTenure,
      previousExpiryDate: input.previousPolicyExpiryDate,
      requestedStartDate: input.policyStartDate,
    });

    return {
      inputs: {
        ...input,
        effectiveNcb,
        tpTenure,
        statutoryAnnualTpPremium: tpRates.annualPremium,
        tpTenureYears: tpTenure,
        statutoryTotalTpPremium: round2(tpRates.annualPremium * tpTenure),
        effectiveAnnualTpPremium: effectiveTpAnnual,
        tpGrossPremium: baseTpPremium,
        odGrossPremium: baseOdPremium,
      },
      authoritativeDates,
      rateConfig: {
        odRate: effectiveOdRate,
        systemOdRate: odRates.rate,
        tpAnnualRate: effectiveTpAnnual,
        systemTpAnnualRate: tpRates.annualPremium,
        tpSource: tpRates.source ?? 'IRDAI_TARIFF',
        tpTariffId: tpRates.tariffId,
        gstRatePercent: gstRate * 100,
        odGstRatePercent: round2(odGstRate * 100),
        tpGstRatePercent: round2(tpGstRate * 100),
        paGstRatePercent: round2(paGstRate * 100),
        paidDriverGstRatePercent: round2(paidDriverGstRate * 100),
        addonGstRatePercent: round2(defaultAddonGstRate * 100),
        discountConfig,
        overridesApplied,
      },
      overridesApplied,
      gstBreakdown,
      outputs: {
        // Phase 3 & 4 Canonical Contract Fields
        idv: input.idv ?? 0,
        odPremium: baseOdPremium,
        annualTpPremium: effectiveTpAnnual,
        tenure: tpTenure,
        paGrossPremium: paPremium,
        paCoverPremium: paPremium,
        paidDriverGrossPremium: paidDriverPremium,
        odDiscount: odDiscountAmount,
        tpDiscount: tpDiscountAmount,
        addonDiscount: totalAddonDiscountAmount,
        commercialAdjustment: isAdd ? commercialAdjustmentRupees : commercialAdjustmentRupees,
        commercialAdjustmentAmount: commercialAdjustmentRupees,
        commercialAdjustmentDirection,
        signedCommercialAdjustment,
        payableBeforeAdjustment,
        gstTotal: componentGstTotal,
        finalPayable: finalPayableAmount,

        gstBreakdown,
        overridesApplied,
        underwriting,
        payableSummary,
        commercialDiscount,
        commercialDiscountAmount,
        odDiscountAmount,
        tpDiscountAmount,
        totalDiscountAmount,

        isOverridden: {
          odBasePremium: hasDirectOd,
          ncbDiscount: isNcbOverridden,
          addonPremium: isAddonTotalOverridden,
          netOdPremium: isNetOdOverridden,
          gstAmount: isGstOverridden,
          totalPremium: isTotalOverridden,
        },
        referenceValues: {
          odBasePremium: round2((input.idv ?? 0) * (odRates.rate / 100)),
          ncbDiscount: 0,
          addonPremium: systemAddonPremiumTotal,
          netOdPremium: systemNetOdComponent,
          gstAmount: systemGstOnOd,
          totalPremium: systemFinalPayable,
        },

        // Structured Component Breakdown (preserves undiscounted reference figures)
        od: {
          gross: baseOdPremium,
          ncbDiscount: ncbDiscountAmount,
          specialDiscount: odDiscountAmount,
          addons: round2(addonPremiumTotal),
          net: netOdComponent,
          gst: gstOnOd,
          isEdited: isOdRateEdited,
        },
        tp: {
          statutory: round2(tpRates.annualPremium * tpTenure),
          base: baseTpPremium,
          discount: tpDiscountAmount,
          net: netTpComponent,
          gst: gstOnTp,
          isEdited: isTpEdited,
        },
        pa: {
          premium: paPremium,
          gst: gstOnPa,
          isEdited: isPaEdited,
        },
        paidDriver: {
          premium: paidDriverPremium,
          gst: gstOnPaidDriver,
          isEdited: isDriverEdited,
        },
        discounts: {
          od: {
            percent: effectiveOdDiscountPercent,
            base: baseOdPremium,
            amount: odDiscountAmount,
          },
          tp: {
            percent: effectiveTpDiscountPercent,
            base: baseTpPremium,
            amount: tpDiscountAmount,
          },
          commercial: {
            percent: commercialDiscountPercent,
            base: payableBase,
            amount: commercialDiscountAmount,
          },
          total: totalDiscountAmount,
        },
        summary: {
          grossPremium: premiumBeforeDiscount,
          totalDiscount: totalDiscountAmount,
          netPremium: premiumBeforeDiscount,
          totalGst: componentGstTotal,
          finalPayable: finalPayableAmount,
          gstBreakdown,
        },

        // Own Damage
        baseOdPremium,
        ncbDiscount: ncbDiscountAmount,
        specialDiscount: odDiscountAmount,
        netOdAfterDiscount,
        netOdPremium: netOdComponent,
        addonPremium: round2(addonPremiumTotal),
        itemizedAddons,
        netOdComponent,

        // Third Party (including PA and Paid Driver as sub-components)
        baseTpPremium,
        paPremium, // Compulsory Owner-Driver PA
        paidDriverPremium, // Legal Liability to Paid Driver
        netTpComponent,
        netTpPremium: round2(
          netTpComponent + netPaComponent + netPaidDriverComponent,
        ),
        netPaComponent,
        netPaidDriverComponent,

        // Compatibility Aliases (explicitly mapped)
        grossBasePremium: premiumBeforeDiscount,
        totalDiscount: totalDiscountAmount,
        netCustomerPremium: premiumBeforeDiscount,
        basePremium: premiumBeforeDiscount,

        // GST — per component and total
        gstOnOd,
        gstOnTp,
        gstOnPa,
        gstOnPaidDriver,
        cgst,
        sgst,
        totalGst: componentGstTotal,
        gstRatePercent: gstRate * 100,

        // Final
        totalPremium: finalPayableAmount,
        finalPayableAmount,
      },
      calculationVersion: 'motor-v4-payable-discount',
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private validateInputs(input: MotorCalculationInputDto) {
    // Approval references and approver names supplied by the client are not trusted authorization.
    // Add-on pricing must come from configured rates; no public calculation endpoint accepts manual prices.
    if ((input.addons || []).some((addon) => addon.manualPrice !== undefined)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'ADDON_MANUAL_OVERRIDE_DISABLED',
        message: 'Client-supplied add-on prices are disabled. Configure the add-on rate through the approved rate master; approval text fields cannot authorize a price override.',
      });
    }
    const directOd = input.odPremium !== undefined
      ? input.odPremium
      : (input.odPremiumAmount !== undefined ? input.odPremiumAmount : input.odBasePremium);
    if (directOd !== undefined && (isNaN(Number(directOd)) || Number(directOd) < 0)) {
      throw new BadRequestException('OD premium amount must be a valid non-negative number.');
    }
    const ncbDisc = input.ncbDiscount !== undefined ? input.ncbDiscount : input.ncbDiscountAmount;
    if (ncbDisc !== undefined && (isNaN(Number(ncbDisc)) || Number(ncbDisc) < 0)) {
      throw new BadRequestException('NCB discount must be a valid non-negative number.');
    }
    const addonPrem = input.addonPremium !== undefined ? input.addonPremium : input.addOnsPremium;
    if (addonPrem !== undefined && (isNaN(Number(addonPrem)) || Number(addonPrem) < 0)) {
      throw new BadRequestException('Add-on premium must be a valid non-negative number.');
    }
    const netOd = input.netOdPremium !== undefined ? input.netOdPremium : (input as any).odPremiumNet;
    if (netOd !== undefined && (isNaN(Number(netOd)) || Number(netOd) < 0)) {
      throw new BadRequestException('Net OD premium must be a valid non-negative number.');
    }
    const gstAmt = input.gstAmount !== undefined ? input.gstAmount : (input as any).odGstAmount;
    if (gstAmt !== undefined && (isNaN(Number(gstAmt)) || Number(gstAmt) < 0)) {
      throw new BadRequestException('GST amount must be a valid non-negative number.');
    }
    const totPrem = input.totalPremium !== undefined
      ? input.totalPremium
      : (input.totalPremiumInclGST !== undefined ? input.totalPremiumInclGST : input.finalPayableAmount);
    if (totPrem !== undefined && (isNaN(Number(totPrem)) || Number(totPrem) < 0)) {
      throw new BadRequestException('Total premium must be a valid non-negative number.');
    }
    for (const ov of input.overrides || []) {
      if (ov.overrideValue !== undefined && (isNaN(Number(ov.overrideValue)) || Number(ov.overrideValue) < 0)) {
        throw new BadRequestException(`Override value for ${ov.field} must be a valid non-negative number.`);
      }
    }
    const commAdj = (input as any).commercialAdjustment !== undefined
      ? (input as any).commercialAdjustment
      : input.commercialAdjustmentAmount;
    if (commAdj !== undefined && (isNaN(Number(commAdj)) || Number(commAdj) < 0)) {
      throw new BadRequestException('Commercial adjustment amount must be a valid non-negative number.');
    }
    const commDir = (input as any).commercialAdjustmentDirection || (input as any).commercialAdjustmentType;
    if (commDir !== undefined && commDir !== 'ADD' && commDir !== 'SUBTRACT') {
      throw new BadRequestException('Commercial adjustment direction must be either "ADD" or "SUBTRACT".');
    }

    for (const addon of input.addons || []) {
      if (addon.discountPercent !== undefined && (isNaN(Number(addon.discountPercent)) || Number(addon.discountPercent) < 0 || Number(addon.discountPercent) > 100)) {
        throw new BadRequestException(`Add-on discount percent for "${addon.addonCode}" must be between 0 and 100.`);
      }
      if (addon.gstRate !== undefined) {
        const r = Number(addon.gstRate) > 1 ? Number(addon.gstRate) / 100 : Number(addon.gstRate);
        if (r !== 0.05 && r !== 0.18) {
          throw new BadRequestException(`Add-on GST rate for "${addon.addonCode}" must be either 5% or 18%.`);
        }
      }
    }

    if (
      (input.idv !== undefined && input.idv < 0) ||
      (input.discountPercent !== undefined && input.discountPercent < 0) ||
      (input.commercialDiscountPercent !== undefined && input.commercialDiscountPercent < 0) ||
      (input.tpDiscountPercent !== undefined && input.tpDiscountPercent < 0) ||
      (input.odDiscountPercent !== undefined && input.odDiscountPercent < 0) ||
      (directOd !== undefined && Number(directOd) < 0) ||
      (commAdj !== undefined && Number(commAdj) < 0) ||
      (ncbDisc !== undefined && Number(ncbDisc) < 0) ||
      (addonPrem !== undefined && Number(addonPrem) < 0) ||
      (netOd !== undefined && Number(netOd) < 0) ||
      (gstAmt !== undefined && Number(gstAmt) < 0) ||
      (totPrem !== undefined && Number(totPrem) < 0)
    ) {
      throw new BadRequestException(
        'Negative premium, IDV, or discount parameters are disallowed.',
      );
    }

    // Discrete NCB validation & claim / vehicle status rules:
    if (input.ncbPercent !== undefined && !VALID_NCB_PERCENTAGES.includes(input.ncbPercent)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'UNSUPPORTED_NCB_PERCENTAGE',
        message: `NCB percentage (${input.ncbPercent}%) is unsupported. Permitted discrete tiers are 0%, 20%, 25%, 35%, 45%, 50%.`,
      });
    }

    if (input.vehicleStatus === 'NEW' && input.policyType === 'STANDALONE_OD') {
      throw new BadRequestException(
        'Standalone OD is not applicable for new vehicles',
      );
    }

    if (input.policyType === 'STANDALONE_OD') {
      const missingActiveTpDetails =
        !input.activeTpInsurer?.trim() ||
        !input.activeTpPolicyNumber?.trim() ||
        !input.activeTpStartDate ||
        !input.activeTpExpiryDate ||
        !input.activeTpVerificationMethod?.trim();

      if (missingActiveTpDetails) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_DETAILS_REQUIRED',
          message:
            'SAOD requires the active TP insurer, policy number, start date, expiry date, and verification method.',
        });
      }

      if (
        input.activeTpVerificationStatus !== 'VERIFIED' ||
        input.activeTpVerifiedByUserConfirmed !== true
      ) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_VERIFICATION_REQUIRED',
          message:
            'Active TP policy details must be marked VERIFIED and explicitly confirmed before SAOD premium calculation.',
        });
      }

      const start = new Date(input.activeTpStartDate!);
      const expiry = new Date(input.activeTpExpiryDate!);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(expiry.getTime()) ||
        expiry < start
      ) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_DATES_INVALID',
          message: 'Active TP policy start and expiry dates must be valid and expiry must not precede start.',
        });
      }

      const startBusinessDate = this.policyDateService.toBusinessDate(input.activeTpStartDate!);
      const expiryBusinessDate = this.policyDateService.toBusinessDate(input.activeTpExpiryDate!);
      const todayBusinessDate = this.policyDateService.getBusinessToday();
      if (startBusinessDate > todayBusinessDate) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_NOT_YET_IN_FORCE',
          message: 'Active TP policy start date is in the future; it cannot establish current SAOD eligibility.',
        });
      }
      if (expiryBusinessDate < startBusinessDate) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_DATES_INVALID',
          message: 'Active TP policy expiry must not precede its start date.',
        });
      }

      if (this.policyDateService.isExpired(input.activeTpExpiryDate!)) {
        throw new BadRequestException(
          'Active TP Policy has expired. Cannot issue SAOD policy against an expired TP.',
        );
      }
    }
  }

  private validateDiscountAuthority(
    input: MotorCalculationInputDto,
    discountConfig: { standardLimit: number; absoluteLimit: number },
  ) {
    const d = Math.max(
      input.commercialDiscountPercent ?? 0,
      input.discountPercent ?? 0,
      input.odDiscountPercent ?? 0,
    );
    if (d <= 0) return;

    if (d > 100) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'DISCOUNT_CEILING_EXCEEDED',
        message: 'Discounts exceeding 100% are strictly prohibited.',
      });
    }

    if (d > discountConfig.absoluteLimit) {
      throw new BadRequestException(
        `Requested discount (${d}%) exceeds the absolute configured ceiling of ${discountConfig.absoluteLimit}%. Disallowed.`,
      );
    }
    if (d > discountConfig.standardLimit && !input.approvalReference) {
      throw new BadRequestException(
        `Requested discount (${d}%) exceeds the configured standard authority limit (${discountConfig.standardLimit}%). ` +
          `A Branch Manager approval reference is required.`,
      );
    }
  }

  private validateTpDiscountAuthority(
    input: MotorCalculationInputDto,
    discountConfig: {
      standardLimit: number;
      absoluteLimit: number;
      tpStandardLimit?: number;
      tpAbsoluteLimit?: number;
    },
  ) {
    const d =
      input.tpDiscountPercent ??
      (input.policyType === 'THIRD_PARTY_ONLY' && input.commercialDiscountPercent === undefined
        ? (input.discountPercent ?? 0)
        : 0);
    if (d <= 0) return;

    if (d > 100) {
      throw new BadRequestException(
        'Discounts exceeding 100% are strictly prohibited.',
      );
    }

    const absoluteLimit =
      discountConfig.tpAbsoluteLimit ?? discountConfig.absoluteLimit;
    const standardLimit =
      discountConfig.tpStandardLimit ?? discountConfig.standardLimit;

    if (d > absoluteLimit) {
      throw new BadRequestException(
        `Requested TP discount (${d}%) exceeds the absolute configured ceiling of ${absoluteLimit}%. Disallowed.`,
      );
    }
    if (d > standardLimit && !input.approvalReference) {
      throw new BadRequestException(
        `Requested TP discount (${d}%) exceeds the configured standard authority limit (${standardLimit}%). ` +
          `A Branch Manager approval reference is required.`,
      );
    }
  }

  private resolveTpTenure(input: MotorCalculationInputDto): number {
    if (input.policyType === 'STANDALONE_OD') {
      return 1;
    }

    const explicitTenure = (input as any).tenure !== undefined
      ? Number((input as any).tenure)
      : (input.policyTenure !== undefined ? Number(input.policyTenure) : undefined);

    const cat = input.vehicleCategory?.toString() ?? 'PRIVATE_CAR';
    const isNew = input.vehicleStatus === 'NEW';
    const isCommercial = [
      'GOODS_CARRYING_PUBLIC',
      'GOODS_CARRYING_PRIVATE',
      'PASSENGER_CARRYING_4_PLUS_1',
      'TRAILER',
      'PASSENGER_BUS',
      'MISCELLANEOUS',
      'COMMERCIAL',
    ].includes(cat);

    if (isNew) {
      if (cat === 'PRIVATE_CAR') {
        if (explicitTenure !== undefined && explicitTenure !== 3) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'INVALID_TP_TENURE',
            message: `For NEW Private Cars, IRDAI mandates a 3-Year Long Term TP policy. Selected tenure (${explicitTenure} year(s)) is unavailable.`,
          });
        }
        return 3;
      }

      if (cat === 'BIKE') {
        if (explicitTenure !== undefined && explicitTenure !== 5) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'INVALID_TP_TENURE',
            message: `For NEW Two-Wheelers, IRDAI mandates a 5-Year Long Term TP policy. Selected tenure (${explicitTenure} year(s)) is unavailable.`,
          });
        }
        return 5;
      }

      if (isCommercial) {
        if (explicitTenure !== undefined && explicitTenure !== 1) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'INVALID_TP_TENURE',
            message: `Commercial vehicles only support a 1-Year TP policy. Long-term TP (${explicitTenure} year(s)) is unavailable.`,
          });
        }
        return 1;
      }
    } else {
      // Existing / Renewal vehicles
      if (isCommercial) {
        if (explicitTenure !== undefined && explicitTenure !== 1) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'INVALID_TP_TENURE',
            message: `Commercial vehicles only support a 1-Year TP policy. Tenure ${explicitTenure} year(s) is unavailable.`,
          });
        }
        return 1;
      }

      if (cat === 'PRIVATE_CAR') {
        if (explicitTenure !== undefined) {
          if (explicitTenure < 1 || explicitTenure > 3 || !Number.isInteger(explicitTenure)) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              errorCode: 'INVALID_TP_TENURE',
              message: `Invalid policy tenure (${explicitTenure} year(s)). Permitted tenure for Private Car is 1 to 3 years.`,
            });
          }
          return explicitTenure;
        }
        return 1;
      }

      if (cat === 'BIKE') {
        if (explicitTenure !== undefined) {
          if (explicitTenure < 1 || explicitTenure > 5 || !Number.isInteger(explicitTenure)) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              errorCode: 'INVALID_TP_TENURE',
              message: `Invalid policy tenure (${explicitTenure} year(s)). Permitted tenure for Two-Wheeler is 1 to 5 years.`,
            });
          }
          return explicitTenure;
        }
        return 1;
      }
    }

    return explicitTenure || 1;
  }

  private resolveStandardAddonRate(
    addonCode: string,
    idv: number,
    baseOdPremium: number,
  ): number {
    switch (addonCode) {
      case 'ZERO_DEP':
      case 'NIL_DEP':
        return round2(idv * 0.009);
      case 'ENGINE_PROTECT':
        return round2(idv * 0.003);
      case 'RTI':
      case 'RETURN_TO_INVOICE':
        return round2(idv * 0.005);
      case 'RSA':
      case 'ROADSIDE_ASSISTANCE':
        return 499;
      case 'KEY_REPLACEMENT':
        return 350;
      case 'CONSUMABLES':
        return round2(idv * 0.002);
      case 'TYRE_SECURE':
        return 550;
      case 'PERSONAL_BAGGAGE':
        return round2(baseOdPremium * 0.01);
      case 'PA_UNNAMED_PASSENGER':
        return 250;
      case 'LEGAL_LIABILITY_PAID_DRIVER':
      case 'LL_PAID_DRIVER':
        return 50;
      case 'LEGAL_LIABILITY_EMPLOYEES':
      case 'LL_EMPLOYEES':
        return 100;
      case 'BI_FUEL_TP':
      case 'CNG_KIT_TP':
        return 60;
      case 'TPPD_RESTRICTED':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Fetch all configuration-driven rates from the database.
   * Falls back to hardcoded IRDAI-published values with a warning log if DB has no records.
   */
  private async fetchConfiguration(input: MotorCalculationInputDto) {
    const vehicleCategoryStr =
      input.vehicleCategory?.toString() ?? 'PRIVATE_CAR';
    const quotationDate = new Date();

    // ── TP Tariff (DB-backed via MotorTariffService, Fail-Closed per D-04/T-06) ──
    let tpRates: {
      annualPremium: number;
      tariffId?: string;
      source?: string;
      isVerified?: boolean;
    } = { annualPremium: 0, source: 'NOT_APPLICABLE' };

    if (input.policyType !== 'STANDALONE_OD') {
      try {
        const tariffResult = await this.motorTariffService.lookupTpTariff({
          vehicleCategory: input.vehicleCategory,
          engineCc: (input as any).engineCc,
          seatingCapacity: (input as any).seatingCapacity,
          gvwKg: (input as any).gvwKg,
          policyType:
            input.policyType === 'THIRD_PARTY_ONLY' ? 'TP_ONLY' : 'PACKAGE',
          quotationDate,
        });

        if (!tariffResult.found || tariffResult.annualPremium <= 0) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            errorCode: 'CONFIGURATION_ERROR',
            missingEntity: ConfigurationMissingEntity.TP_TARIFF,
            vehicleCategory: vehicleCategoryStr,
            policyType: input.policyType,
            message: `No active regulatory TP tariff found for vehicleCategory=${vehicleCategoryStr}, policyType=${input.policyType} on date ${quotationDate.toISOString().split('T')[0]}. Calculation cannot proceed without approved regulatory tariff schedule (Decision D-04, T-06).`,
            effectiveDate: quotationDate.toISOString(),
          });
        }

        tpRates = {
          annualPremium: tariffResult.annualPremium,
          tariffId: tariffResult.tariffId,
          source: tariffResult.source ?? 'MOTOR_TARIFF_DB',
          isVerified: tariffResult.isVerified,
        };

        if (!tariffResult.isVerified) {
          this.logger.warn(
            `[EPIC-16] Unverified tariff used for ${vehicleCategoryStr}: ${tariffResult.warning}`,
          );
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.error(`[EPIC-16] Tariff lookup failed: ${err}`);
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'CONFIGURATION_ERROR',
          missingEntity: ConfigurationMissingEntity.TP_TARIFF,
          vehicleCategory: vehicleCategoryStr,
          policyType: input.policyType,
          message: `Tariff lookup failed for ${vehicleCategoryStr}: ${(err as Error)?.message || err}`,
          effectiveDate: quotationDate.toISOString(),
        });
      }
    }

    // ── OD Rate (from ProductRate or RatingEngine DB, fallback to IRDAI) ──
    let odRates = { rate: FALLBACK_OD_RATES[vehicleCategoryStr] ?? 3.127 };
    try {
      const productRate = await (
        this.prisma as any
      ).ratingEngineRule?.findFirst({
        where: {
          vehicleCategory: input.vehicleCategory,
          isActive: true,
          effectiveFrom: { lte: quotationDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: quotationDate } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (productRate && Number(productRate.odRatePercent) > 0) {
        odRates = { rate: Number(productRate.odRatePercent) };
      }
    } catch {
      // RatingEngineRule table may not exist yet — fallback is safe.
    }

    // ── GST Rate (Selector: 5% vs 18%, or from TaxRule DB fallback to 18%) ──
    let gstRate = 0.18; // Default: 18% per GST Act for motor insurance
    if (input.gstRate !== undefined && input.gstRate !== null) {
      const rawGst = Number(input.gstRate);
      if (rawGst === 5 || Math.abs(rawGst - 0.05) < 0.001) {
        gstRate = 0.05;
      } else if (rawGst === 18 || Math.abs(rawGst - 0.18) < 0.001) {
        gstRate = 0.18;
      } else {
        throw new BadRequestException(
          `Invalid GST rate: ${rawGst}%. The GST selector supports exactly 5% and 18% options.`,
        );
      }
    } else {
      try {
        const taxRule = await (this.prisma as any).taxRule?.findFirst({
          where: {
            code: 'GST_MOTOR',
            isActive: true,
            effectiveFrom: { lte: quotationDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: quotationDate } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        if (taxRule && Number(taxRule.ratePercent) > 0) {
          gstRate = Number(taxRule.ratePercent) / 100;
        }
      } catch {
        // TaxRule table may not exist yet — 18% fallback is IRDAI-compliant.
      }
    }

    // ── Discount Configuration (from SystemConfig DB) ─────────────────────
    const discountConfig = { standardLimit: 100, absoluteLimit: 100 };
    try {
      const stdConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_STANDARD_LIMIT' },
      });
      const absConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_ABSOLUTE_LIMIT' },
      });
      if (stdConfig)
        discountConfig.standardLimit = Number(stdConfig.value) || 100;
      if (absConfig)
        discountConfig.absoluteLimit = Number(absConfig.value) || 100;
    } catch {
      // SystemConfig table may not exist yet — defaults are permissive-safe.
    }

    // ── Addon Rates (from ProductAddonRate DB) ────────────────────────────
    let addonRates: Record<string, any> = {};
    try {
      const addonRecords = await (
        this.prisma as any
      ).productAddonRate?.findMany({
        where: { isActive: true },
      });
      addonRates = Object.fromEntries(
        addonRecords.map((a) => [a.addonCode, a]),
      );
    } catch {
      // Falls back to resolveStandardAddonRate() in the caller.
    }

    return { tpRates, odRates, gstRate, discountConfig, addonRates };
  }

  /**
   * Controlled Tax & Tariff Override Calculation (D-03, T-08)
   * Permissioned for Admin/Back-Office only with append-only audit logging.
   */
  async calculateWithOverride(
    overrideInput: MotorCalculationOverrideInputDto,
    actor?: any,
  ) {
    if (!overrideInput.approvalReference || !overrideInput.overrideReason) {
      throw new BadRequestException(
        'Tax/Tariff override requires an approved approvalReference and overrideReason (Decision D-03, T-08).',
      );
    }

    const calculationInput = { ...overrideInput.calculationInput } as MotorCalculationInputDto;
    if (overrideInput.customGstRate !== undefined) {
      calculationInput.gstRate = overrideInput.customGstRate;
    }

    const result = await this.calculate(calculationInput);

    // Record append-only audit log
    try {
      if (typeof (this.prisma as any)?.auditLog?.create === 'function') {
        await (this.prisma as any).auditLog.create({
          data: {
            action: 'APPROVE',
            entity: 'MOTOR_TAX_TARIFF_OVERRIDE',
            entityId: overrideInput.approvalReference,
            performedById: actor?.userId || actor?.id || 'SYSTEM_ADMIN',
            metadata: {
              approvalReference: overrideInput.approvalReference,
              approvedBy: overrideInput.approvedBy,
              overrideReason: overrideInput.overrideReason,
              customGstRate: overrideInput.customGstRate,
              customOdRate: overrideInput.customOdRate,
              customTpPremium: overrideInput.customTpPremium,
              calculatedTotalPremium: result.outputs.totalPremium,
            },
          },
        });
      }
    } catch (auditErr) {
      this.logger.warn(`Could not persist auditLog for override: ${auditErr}`);
    }

    return {
      ...result,
      overrideDetails: {
        approvalReference: overrideInput.approvalReference,
        approvedBy: overrideInput.approvedBy,
        overrideReason: overrideInput.overrideReason,
      },
    };
  }
}

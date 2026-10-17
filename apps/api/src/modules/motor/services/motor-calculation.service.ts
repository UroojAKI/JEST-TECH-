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
    const directOdInput = input.odPremium !== undefined
      ? input.odPremium
      : input.odPremiumAmount;
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
        reason: 'Direct OD premium ₹ input (agent-entered gross)',
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

      if (!isNaN(candidateTp) && candidateTp >= 0) {
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
          message: `Edited TP premium (₹${candidateTp}) must be a valid non-negative number.`,
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
    let odDiscountAmount = 0;
    let effectiveOdDiscountPercent = 0;
    const itemizedAddons: Array<{
      addonCode: string;
      name: string;
      amount: number;
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
      // it does NOT deduct a monetary discount from baseOdPremium or the payable total.
      ncbDiscountAmount = 0;

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
      netOdAfterDiscount = round2(Math.max(0, baseOdPremium - odDiscountAmount));

      // Add-on premiums (not subject to NCB/special discount)
      // SPEC RULE: The quote should continue calculating other components if one add-on has an invalid value.
      for (const addon of input.addons || []) {
        let price = 0;
        let systemPrice = 0;
        let isAddonEdited = false;

        try {
          const config = addonRates[addon.addonCode];
          if (config) {
            switch (config.pricingModel) {
              case 'PERCENT_OF_IDV':
                systemPrice = round2(input.idv * (Number(config.rateValue) / 100));
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
              input.idv,
              baseOdPremium,
            );
          }

          // Check for authorized edit
          const addonOverride = input.overrides?.find((o) => o.field === `ADDON:${addon.addonCode}`);
          const candidatePrice = addon.editedPrice !== undefined
            ? Number(addon.editedPrice)
            : (addonOverride ? Number(addonOverride.overrideValue) : undefined);

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
            addonPremiumTotal = round2(addonPremiumTotal + price);
            itemizedAddons.push({
              addonCode: addon.addonCode,
              name: addon.addonCode.replace(/_/g, ' '),
              amount: price,
              systemRate: systemPrice,
              isEdited: isAddonEdited,
            });
          } else {
            itemizedAddons.push({
              addonCode: addon.addonCode,
              name: addon.addonCode.replace(/_/g, ' '),
              amount: 0,
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
            systemRate: 0,
            isEdited: false,
            isInvalid: true,
            warning: (addonErr as Error)?.message || 'Invalid add-on',
          });
        }
      }
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

    // ── 8. Undiscounted Gross Components (pre-discount, pre-tax) ───────────
    const netOdComponent = round2(netOdAfterDiscount + addonPremiumTotal);
    const netTpComponent = round2(
      Math.max(0, baseTpPremium - tpDiscountAmount),
    );
    const netPaComponent = paPremium; // PA is fixed
    const netPaidDriverComponent = paidDriverPremium; // Fixed

    // Step 1: Gross Premium Before Discount (undiscounted reference total)
    const premiumBeforeDiscount = round2(
      round2(baseOdPremium + addonPremiumTotal) + baseTpPremium + netPaComponent + netPaidDriverComponent,
    );
    const netCustomerPremium = premiumBeforeDiscount;

    // ── 9. Component-Level GST Calculation on GROSS Premium Base ──────────
    // CORE BUSINESS RULE: GST base = gross premium before discount.
    // OD Gross -> OD GST
    // TP Gross -> TP GST
    // PA Gross -> PA GST
    // Paid Driver Gross -> Paid Driver GST
    // A commercial discount does NOT reduce the statutory GST base.

    const odGrossBase = round2(baseOdPremium + addonPremiumTotal);
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

    const gstOnOd = round2(odGrossBase * odGstRate);
    const gstOnTp = round2(tpGrossBase * tpGstRate);
    const gstOnPa = round2(paGrossBase * paGstRate);
    const gstOnPaidDriver = round2(paidDriverGrossBase * paidDriverGstRate);

    // Step 2: Component-Level GST Total
    const componentGstTotal = round2(gstOnOd + gstOnTp + gstOnPa + gstOnPaidDriver);
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
    };

    // ── 10. Payable Base, Commercial Discount, and Final Payable ──────────
    // Step 3: Payable Base = Gross Premium Before Discount + Component GST Total
    const payableBase = round2(premiumBeforeDiscount + componentGstTotal);

    // Step 4: Independent Discounts (OD, TP, Commercial)
    // D_OD: Calculated from gross OD premium
    // D_TP: Calculated from gross TP premium (annual * tenure)
    // D_C:  Phase 3 canonical path — fixed ₹ amount entered directly.
    //        Legacy fallback — percentage of payable base.

    // Resolve commercial discount: fixed-₹ supersedes percentage.
    const commercialDiscountPercent = Number(
      input.commercialDiscountPercent !== undefined
        ? input.commercialDiscountPercent
        : (input.odDiscountPercent === undefined && input.tpDiscountPercent === undefined && input.discountPercent !== undefined
            ? input.discountPercent
            : 0),
    );

    // Phase 3 canonical: fixed ₹ amount takes priority over percentage
    const directCommAdj = (input as any).commercialAdjustment !== undefined
      ? (input as any).commercialAdjustment
      : input.commercialAdjustmentAmount;
    const isFixedRupeeCommercial = directCommAdj !== undefined && directCommAdj !== null && !isNaN(Number(directCommAdj));
    const commercialDiscountAmount = isFixedRupeeCommercial
      ? round2(Number(directCommAdj))
      : round2(payableBase * (commercialDiscountPercent / 100));

    // Total Discounts: OD discount + TP discount + Commercial discount (each deducted exactly once)
    const totalDiscountAmount = round2(
      odDiscountAmount + tpDiscountAmount + commercialDiscountAmount,
    );

    const commercialDiscount: PayableDiscount = {
      percentage: isFixedRupeeCommercial ? 0 : commercialDiscountPercent,
      baseAmount: payableBase,
      amount: commercialDiscountAmount,
      reason: input.discountReason || input.approvalReference || undefined,
    };

    // Step 5: Final Payable Amount = Payable Base - Total Discounts
    // Reject if commercial adjustment alone would make payable negative (never silently clamp)
    if (isFixedRupeeCommercial && commercialDiscountAmount > payableBase) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'COMMERCIAL_ADJUSTMENT_EXCEEDS_PAYABLE',
        message: `Commercial adjustment ₹${commercialDiscountAmount.toLocaleString('en-IN')} exceeds payable base ₹${payableBase.toLocaleString('en-IN')}. Final payable cannot be negative.`,
      });
    }

    if (totalDiscountAmount > payableBase) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'DISCOUNTS_EXCEED_PAYABLE_BASE',
        message: `Total discounts and adjustments (₹${totalDiscountAmount.toLocaleString('en-IN')}) exceed payable base (₹${payableBase.toLocaleString('en-IN')}). Final payable cannot be negative.`,
      });
    }

    const finalPayableAmount = round2(
      Math.max(0, payableBase - totalDiscountAmount),
    );

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
      commercialDiscountAmount,
      commercialAdjustment: isFixedRupeeCommercial ? commercialDiscountAmount : undefined,
      commercialAdjustmentAmount: isFixedRupeeCommercial ? commercialDiscountAmount : undefined,
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
      policyTenure: input.policyTenure,
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
        discountConfig,
        overridesApplied,
      },
      overridesApplied,
      gstBreakdown,
      outputs: {
        // Phase 3 Canonical Contract Fields
        idv: input.idv ?? 0,
        odPremium: baseOdPremium,
        annualTpPremium: effectiveTpAnnual,
        tenure: tpTenure,
        odDiscount: odDiscountAmount,
        tpDiscount: tpDiscountAmount,
        commercialAdjustment: commercialDiscountAmount,
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

        // Structured Component Breakdown (preserves undiscounted reference figures)
        od: {
          gross: baseOdPremium,
          ncbDiscount: 0,
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
        ncbDiscount: 0,
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
    const directOd = input.odPremium !== undefined ? input.odPremium : input.odPremiumAmount;
    if (directOd !== undefined && (isNaN(Number(directOd)) || Number(directOd) < 0)) {
      throw new BadRequestException('OD premium amount must be a valid non-negative number.');
    }
    const commAdj = (input as any).commercialAdjustment !== undefined
      ? (input as any).commercialAdjustment
      : input.commercialAdjustmentAmount;
    if (commAdj !== undefined && (isNaN(Number(commAdj)) || Number(commAdj) < 0)) {
      throw new BadRequestException('Commercial adjustment amount must be a valid non-negative number.');
    }

    if (
      (input.idv !== undefined && input.idv < 0) ||
      (input.discountPercent !== undefined && input.discountPercent < 0) ||
      (input.commercialDiscountPercent !== undefined && input.commercialDiscountPercent < 0) ||
      (input.tpDiscountPercent !== undefined && input.tpDiscountPercent < 0) ||
      (input.odDiscountPercent !== undefined && input.odDiscountPercent < 0) ||
      (directOd !== undefined && Number(directOd) < 0) ||
      (commAdj !== undefined && Number(commAdj) < 0)
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
      if (!input.activeTpPolicyNumber || !input.activeTpExpiryDate) {
        throw new BadRequestException(
          'Active TP Policy details are required for Standalone OD policies',
        );
      }
      if (this.policyDateService.isExpired(input.activeTpExpiryDate)) {
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

    if (d >= 100) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'DISCOUNT_CEILING_EXCEEDED',
        message: 'Discounts of 100% or higher are strictly prohibited.',
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

    if (d >= 100) {
      throw new BadRequestException(
        '100% TP discounts are strictly prohibited per IRDAI statutory regulations.',
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
    if (input.vehicleStatus === 'NEW') {
      const cat = input.vehicleCategory?.toString() ?? '';
      if (cat === 'PRIVATE_CAR') return 3;
      if (cat === 'BIKE') return 5;
    }
    return (input as any).tenure || input.policyTenure || 1;
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
    const discountConfig = { standardLimit: 15, absoluteLimit: 50 };
    try {
      const stdConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_STANDARD_LIMIT' },
      });
      const absConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_ABSOLUTE_LIMIT' },
      });
      if (stdConfig)
        discountConfig.standardLimit = Number(stdConfig.value) || 15;
      if (absConfig)
        discountConfig.absoluteLimit = Number(absConfig.value) || 50;
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

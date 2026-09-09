import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';
import { MotorTariffService } from './motor-tariff.service';

/**
 * EPIC-16 — Motor Calculation Engine V3
 *
 * Canonical formula (per specification v4.2):
 *
 *   Gross Premium Components  = OD + TP + PA + PaidDriver + Addons
 *   NCB Discount              = ncbPercent applied to OD base only
 *   Special Discount          = applied to (OD - NCB) component only
 *   Net Discounted Components = Each component after applicable discounts
 *   Tax Base                  = Net discounted premium (NOT gross)
 *   GST per component         = round2(componentNet * gstRate)
 *   Final Payable             = Σ Net components + Σ GST per component
 *
 * GST rate is configuration-driven from TaxRule DB table.
 * Discount thresholds are configuration-driven from SystemConfig/ProductConfig.
 * TP tariff is DB-backed via MotorTariffService.
 */

const round2 = (num: number): number =>
  Math.round((num + Number.EPSILON) * 100) / 100;

// Default fallback rates (used only when no DB tariff is found).
// These are IRDAI-published standard rates — kept here as a VERIFIED last resort.
const FALLBACK_TP_RATES: Record<string, number> = {
  PRIVATE_CAR: 3416,
  BIKE: 714,
  GCV: 15746,
  PCV: 7138,
};
const FALLBACK_OD_RATES: Record<string, number> = {
  PRIVATE_CAR: 3.127,
  BIKE: 1.708,
  GCV: 2.15,
  PCV: 2.15,
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
  ) {}

  async calculate(input: MotorCalculationInputDto) {
    // ── 1. Structural Validation ───────────────────────────────────────────
    this.validateInputs(input);

    // ── 2. TP Tenure Resolution ────────────────────────────────────────────
    const tpTenure = this.resolveTpTenure(input);

    // ── 3. NCB Resolution (reset to 0 if claim in expiring policy) ─────────
    const effectiveNcb = input.claimInExpiringPolicy ? 0 : (input.ncbPercent || 0);

    // ── 4. Fetch Configuration-Driven Rates ────────────────────────────────
    const { tpRates, odRates, gstRate, discountConfig, addonRates } =
      await this.fetchConfiguration(input);

    // ── 5. Discount Authority Validation ──────────────────────────────────
    // Thresholds come from DB config, not hardcoded constants.
    this.validateDiscountAuthority(input, discountConfig);

    // ── 6. OD Component ────────────────────────────────────────────────────
    let baseOdPremium = 0;
    let ncbDiscountAmount = 0;
    let specialDiscountAmount = 0;
    let netOdAfterDiscount = 0;
    let addonPremiumTotal = 0;
    const itemizedAddons: Array<{ addonCode: string; name: string; amount: number }> = [];

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

      baseOdPremium = round2(input.idv * (odRates.rate / 100));

      // NCB discount applies only to OD base premium.
      ncbDiscountAmount = round2(baseOdPremium * (effectiveNcb / 100));
      const odAfterNcb = round2(Math.max(0, baseOdPremium - ncbDiscountAmount));

      // Special/commercial discount applies to (OD after NCB) only.
      const specialDiscountPercent = input.discountPercent || 0;
      specialDiscountAmount = round2(odAfterNcb * (specialDiscountPercent / 100));

      netOdAfterDiscount = round2(Math.max(0, odAfterNcb - specialDiscountAmount));

      // Add-on premiums (not subject to NCB/special discount)
      for (const addon of input.addons || []) {
        let price = 0;
        const config = addonRates[addon.addonCode];
        if (addon.manualPrice !== undefined && addon.manualPrice >= 0) {
          price = round2(addon.manualPrice);
        } else if (config) {
          switch (config.pricingModel) {
            case 'PERCENT_OF_IDV':
              price = round2(input.idv * (Number(config.rateValue) / 100));
              break;
            case 'PERCENT_OF_OD':
              price = round2(baseOdPremium * (Number(config.rateValue) / 100));
              break;
            case 'FIXED':
              price = round2(Number(config.rateValue));
              break;
            default:
              price = 0;
          }
        } else {
          // Standard IRDAI-aligned defaults for well-known add-ons.
          price = this.resolveStandardAddonRate(addon.addonCode, input.idv, baseOdPremium);
        }

        // Zero-premium add-on prevention (IRDAI compliance).
        if (price <= 0) {
          throw new BadRequestException(
            `Add-on "${addon.addonCode}" has zero or negative calculated premium (₹${price}). ` +
              `Zero-premium add-ons are prohibited per IRDAI compliance. ` +
              `Provide a valid rate or deselect this add-on.`,
          );
        }

        addonPremiumTotal = round2(addonPremiumTotal + price);
        itemizedAddons.push({
          addonCode: addon.addonCode,
          name: addon.addonCode.replace(/_/g, ' '),
          amount: price,
        });
      }
    }

    // ── 7. TP Component (PA and Paid Driver are separate sub-components) ───
    let baseTpPremium = 0;
    let paPremium = 0;       // Compulsory PA for Owner-Driver (₹15L cover)
    let paidDriverPremium = 0; // Legal Liability to Paid Driver

    if (['THIRD_PARTY_ONLY', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      baseTpPremium = round2(tpRates.annualPremium * tpTenure);
      // PA for Owner-Driver is COMPULSORY unless explicitly opted out with a waiver.
      if (input.paCover !== false) paPremium = COMPULSORY_PA_OWNER_DRIVER;
      if (input.paidDriverLiability) paidDriverPremium = PAID_DRIVER_LL_RATE;
    }

    // ── 8. Net Premium per Component (post-discount, pre-tax) ─────────────
    // SPEC: Tax is applied to net discounted premium per component, NOT gross.
    const netOdComponent = round2(netOdAfterDiscount + addonPremiumTotal);
    const netTpComponent = baseTpPremium; // TP has no discount
    const netPaComponent = paPremium;     // PA is fixed IRDAI rate, no discount
    const netPaidDriverComponent = paidDriverPremium; // Fixed, no discount

    const netCustomerPremium = round2(
      netOdComponent + netTpComponent + netPaComponent + netPaidDriverComponent,
    );

    // ── 9. Component-Level GST Calculation ────────────────────────────────
    // GST is applied to each net component separately, then summed.
    // This ensures discounts correctly reduce the tax base (per specification v4.2).
    const gstOnOd = round2(netOdComponent * gstRate);
    const gstOnTp = round2(netTpComponent * gstRate);
    const gstOnPa = round2(netPaComponent * gstRate);
    const gstOnPaidDriver = round2(netPaidDriverComponent * gstRate);
    const totalGst = round2(gstOnOd + gstOnTp + gstOnPa + gstOnPaidDriver);
    const cgst = round2(totalGst / 2);
    const sgst = round2(totalGst - cgst);

    // ── 10. Final Payable ─────────────────────────────────────────────────
    const finalPayableAmount = round2(netCustomerPremium + totalGst);

    // ── 11. Gross (pre-discount) totals for transparency ─────────────────
    const grossBasePremium = round2(
      baseOdPremium + addonPremiumTotal + baseTpPremium + paPremium + paidDriverPremium,
    );
    const totalDiscountAmount = round2(ncbDiscountAmount + specialDiscountAmount);

    return {
      inputs: { ...input, effectiveNcb, tpTenure },
      rateConfig: {
        odRate: odRates.rate,
        tpAnnualRate: tpRates.annualPremium,
        tpSource: tpRates.source ?? 'IRDAI_TARIFF',
        tpTariffId: tpRates.tariffId,
        gstRatePercent: gstRate * 100,
        discountConfig,
      },
      outputs: {
        // Own Damage
        baseOdPremium,
        ncbDiscount: ncbDiscountAmount,
        specialDiscount: specialDiscountAmount,
        netOdAfterDiscount,
        netOdPremium: netOdComponent,
        addonPremium: round2(addonPremiumTotal),
        itemizedAddons,
        netOdComponent,

        // Third Party (including PA and Paid Driver as sub-components)
        baseTpPremium,
        paPremium,        // Compulsory Owner-Driver PA
        paidDriverPremium, // Legal Liability to Paid Driver
        netTpComponent,
        netTpPremium: round2(netTpComponent + netPaComponent + netPaidDriverComponent),
        netPaComponent,
        netPaidDriverComponent,

        // Combined
        grossBasePremium,
        totalDiscount: totalDiscountAmount,
        netCustomerPremium,
        basePremium: netCustomerPremium,

        // GST — per component and total
        gstOnOd,
        gstOnTp,
        gstOnPa,
        gstOnPaidDriver,
        cgst,
        sgst,
        totalGst,
        gstRatePercent: gstRate * 100,

        // Final
        totalPremium: finalPayableAmount,
        finalPayableAmount,
      },
      calculationVersion: 'motor-v3-epic16',
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private validateInputs(input: MotorCalculationInputDto) {
    if (input.policyType === 'STANDALONE_OD') {
      if (!input.activeTpPolicyNumber || !input.activeTpExpiryDate) {
        throw new BadRequestException(
          'Active TP Policy details are required for Standalone OD policies',
        );
      }
      if (new Date(input.activeTpExpiryDate) <= new Date()) {
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
    const d = input.discountPercent ?? 0;
    if (d <= 0) return;

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

  private resolveTpTenure(input: MotorCalculationInputDto): number {
    if (input.vehicleStatus === 'NEW') {
      const cat = input.vehicleCategory?.toString() ?? '';
      if (cat === 'PRIVATE_CAR') return 3;
      if (cat === 'BIKE') return 5;
    }
    return input.policyTenure || 1;
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
    const vehicleCategoryStr = input.vehicleCategory?.toString() ?? 'PRIVATE_CAR';
    const quotationDate = new Date();

    // ── TP Tariff (DB-backed via MotorTariffService) ─────────────────────
    let tpRates: {
      annualPremium: number;
      tariffId?: string;
      source?: string;
      isVerified?: boolean;
    };
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
      if (tariffResult.found && tariffResult.annualPremium > 0) {
        tpRates = {
          annualPremium: tariffResult.annualPremium,
          tariffId: tariffResult.tariffId,
          source: tariffResult.source ?? 'MOTOR_TARIFF_DB',
          isVerified: tariffResult.isVerified,
        };
        if (!tariffResult.isVerified) {
          this.logger.warn(`[EPIC-16] Unverified tariff used for ${vehicleCategoryStr}: ${tariffResult.warning}`);
        }
      } else {
        const fallback = FALLBACK_TP_RATES[vehicleCategoryStr] ?? 3416;
        this.logger.warn(`[EPIC-16] No DB tariff found for ${vehicleCategoryStr}, using IRDAI fallback: ₹${fallback}`);
        tpRates = { annualPremium: fallback, source: 'IRDAI_FALLBACK' };
      }
    } catch (err) {
      const fallback = FALLBACK_TP_RATES[vehicleCategoryStr] ?? 3416;
      this.logger.error(`[EPIC-16] Tariff lookup failed, using fallback: ${err}`);
      tpRates = { annualPremium: fallback, source: 'IRDAI_FALLBACK' };
    }

    // ── OD Rate (from ProductRate or RatingEngine DB, fallback to IRDAI) ──
    let odRates = { rate: FALLBACK_OD_RATES[vehicleCategoryStr] ?? 3.127 };
    try {
      const productRate = await (this.prisma as any).ratingEngineRule?.findFirst({
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

    // ── GST Rate (from TaxRule DB, fallback to 18%) ───────────────────────
    let gstRate = 0.18; // Default: 18% per GST Act for motor insurance
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

    // ── Discount Configuration (from SystemConfig DB) ─────────────────────
    const discountConfig = { standardLimit: 15, absoluteLimit: 50 };
    try {
      const stdConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_STANDARD_LIMIT' },
      });
      const absConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_ABSOLUTE_LIMIT' },
      });
      if (stdConfig) discountConfig.standardLimit = Number(stdConfig.value) || 15;
      if (absConfig) discountConfig.absoluteLimit = Number(absConfig.value) || 50;
    } catch {
      // SystemConfig table may not exist yet — defaults are permissive-safe.
    }

    // ── Addon Rates (from ProductAddonRate DB) ────────────────────────────
    let addonRates: Record<string, any> = {};
    try {
      const addonRecords = await (this.prisma as any).productAddonRate?.findMany({
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
}

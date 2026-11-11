import { Injectable } from '@nestjs/common';
import { IdvService } from './idv.service';
import { PremiumService } from './premium.service';
import { NcbService } from './ncb.service';
import { AddonsService, SelectedAddons } from './addons.service';
import { GstService } from './gst.service';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, ProductType } from '@prisma/client';

export interface QuotationInput {
  coverType?: ProductType;
  exShowroomPrice?: number;
  registrationYear?: number;
  engineCc?: number;
  manualOverrideIdv?: number;
  ncbPercentage?: number;
  hadClaimInPreviousYear?: boolean;
  selectedAddons?: SelectedAddons;
  rtoZone?: 'ZONE_A' | 'ZONE_B';
  includePaCover?: boolean;
  selectedInsurerIds?: string[];
}

export interface ComparativeInsurerQuote {
  insurerId: string;
  insurerName: string;
  logo: string;
  coverType: ProductType;
  idv: number;
  odPremium: number;
  ncbDiscount: number;
  tpPremium: number;
  paCoverPremium: number;
  addonsPremium: number;
  addonsList: any[];
  taxableNetPremium: number;
  cgst: number;
  sgst: number;
  gstTotal: number;
  totalPremium: number;
  isRecommended?: boolean;
}

@Injectable()
export class ComparisonService {
  constructor(
    private readonly idvService: IdvService,
    private readonly premiumService: PremiumService,
    private readonly ncbService: NcbService,
    private readonly addonsService: AddonsService,
    private readonly gstService: GstService,
    private readonly prisma: PrismaService,
  ) {}

  async generateComparativeQuotesAsync(input: QuotationInput): Promise<{
    idvDetails: any;
    comparativeQuotes: Array<ComparativeInsurerQuote & {
      quoteSource: 'ADMIN_CONFIGURED_RATING_RULE';
      ratingProductCode: string;
    }>;
    unavailableInsurers: Array<{ insurerId: string; insurerName: string; reason: string }>;
  }> {
    const coverType: ProductType = input.coverType || ProductType.PACKAGE_COMPREHENSIVE;
    const exShowroom = input.exShowroomPrice || 1000000;
    const regYear = input.registrationYear || new Date().getFullYear() - 1;
    const engineCc = input.engineCc || 1197;

    const idvDetails = this.idvService.calculateIdv(exShowroom, regYear, input.manualOverrideIdv);
    const idv = idvDetails.finalIdv;
    const basePrem = this.premiumService.calculateMotorPremium(
      coverType, idv, engineCc, input.rtoZone || 'ZONE_A', input.includePaCover !== false,
    );
    const ncb = this.ncbService.calculateNcbDiscount(
      basePrem.odPremium, input.ncbPercentage ?? 0, input.hadClaimInPreviousYear || false,
    );
    const addons = this.addonsService.calculateAddons(idv, input.selectedAddons || {});

    // Admin Insurer Master is the only source of partner identities. Never inject demo carriers.
    const insurers = await this.prisma.insurer.findMany({
      where: { isActive: true, ...(input.selectedInsurerIds?.length ? { id: { in: input.selectedInsurerIds } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, logoUrl: true },
    });
    if (insurers.length === 0) {
      return { idvDetails, comparativeQuotes: [], unavailableInsurers: [] };
    }

    // An insurer receives a priced comparison only when Admin has configured an active
    // product + BASE_RATE rule for the requested product type. No index-based multipliers
    // or generic premium fallback are permitted to masquerade as insurer pricing.
    const rules = await this.prisma.ratingRule.findMany({
      where: {
        isActive: true,
        insurerId: { in: insurers.map((insurer) => insurer.id) },
        product: { is: { isActive: true, type: coverType } },
      },
      include: { product: { select: { id: true, code: true, name: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const comparativeQuotes: Array<ComparativeInsurerQuote & {
      quoteSource: 'ADMIN_CONFIGURED_RATING_RULE';
      ratingProductCode: string;
    }> = [];
    const unavailableInsurers: Array<{ insurerId: string; insurerName: string; reason: string }> = [];

    for (const insurer of insurers) {
      const insurerRules = rules.filter((rule) => rule.insurerId === insurer.id);
      const baseRateRule = insurerRules.find((rule) => rule.ruleType === 'BASE_RATE');
      const rawRate = baseRateRule ? Number((baseRateRule.formulaOrRate as any)?.rate) : NaN;
      if (!baseRateRule || !Number.isFinite(rawRate) || rawRate <= 0) {
        unavailableInsurers.push({
          insurerId: insurer.id,
          insurerName: insurer.name,
          reason: 'No active product-specific BASE_RATE is configured in Admin rating rules.',
        });
        continue;
      }

      const age = Math.max(0, new Date().getFullYear() - regYear);
      const ageRule = insurerRules.find((rule) => rule.ruleType === 'AGE_LOADING');
      const ageLoading = age > 5 ? Number((ageRule?.formulaOrRate as any)?.loadingPct || 0) : 0;
      const discountRule = insurerRules.find((rule) => rule.ruleType === 'OD_DISCOUNT');
      const odDiscount = Number((discountRule?.formulaOrRate as any)?.discountPct || 0);
      if (![ageLoading, odDiscount].every(Number.isFinite) || ageLoading < 0 || odDiscount < 0 || odDiscount >= 1) {
        unavailableInsurers.push({
          insurerId: insurer.id,
          insurerName: insurer.name,
          reason: 'Configured rating rule contains an invalid loading or discount value.',
        });
        continue;
      }

      const grossOd = idv * rawRate * (1 + ageLoading);
      const discountAmount = grossOd * odDiscount;
      const ncbDiscount = (grossOd - discountAmount) * (ncb.applicableNcbPercent / 100);
      const odPremium = Math.max(0, Math.round(grossOd - discountAmount - ncbDiscount));
      const tpPremium = coverType === ProductType.STANDALONE_OWN_DAMAGE ? 0 : basePrem.tpPremium;
      const paCoverPremium = input.includePaCover === false ? 0 : basePrem.paCoverPremium;
      const addonsPremium = addons.totalAddonsPremium;
      const taxableNetPremium = odPremium + tpPremium + paCoverPremium + addonsPremium;
      const tax = this.gstService.calculateTax(taxableNetPremium);

      comparativeQuotes.push({
        insurerId: insurer.id,
        insurerName: insurer.name,
        logo: insurer.logoUrl || insurer.code,
        coverType,
        idv,
        odPremium,
        ncbDiscount: Math.round(ncbDiscount),
        tpPremium,
        paCoverPremium,
        addonsPremium,
        addonsList: addons.breakup,
        taxableNetPremium,
        cgst: tax.cgst,
        sgst: tax.sgst,
        gstTotal: tax.totalGst,
        totalPremium: tax.finalTotalPremium,
        quoteSource: 'ADMIN_CONFIGURED_RATING_RULE',
        ratingProductCode: baseRateRule.product.code,
      });
    }

    return { idvDetails, comparativeQuotes, unavailableInsurers };
  }

  async getComparisonMatrix(input: QuotationInput) {
    const result = await this.generateComparativeQuotesAsync(input);
    const features = [
      { key: 'premium', label: 'Premium Payable' },
      { key: 'idv', label: 'Insured Declared Value (IDV)' },
      { key: 'ncbDiscount', label: 'NCB Discount' },
      { key: 'zeroDep', label: 'Zero Depreciation Cover' },
      { key: 'engineProtect', label: 'Engine Protector' },
      { key: 'rsa', label: 'Roadside Assistance (RSA)' },
    ];
    return {
      features,
      quotes: result.comparativeQuotes.map((quote) => ({
        insurerId: quote.insurerId,
        insurerName: quote.insurerName,
        logo: quote.logo,
        premium: `₹${quote.totalPremium}`,
        idv: `₹${quote.idv}`,
        ncbDiscount: `₹${quote.ncbDiscount}`,
        finalPremium: `₹${quote.totalPremium}`,
        quoteSource: quote.quoteSource,
      })),
      unavailableInsurers: result.unavailableInsurers,
    };
  }

  compare(quotations: any[]) {
    return {
      comparedCount: quotations.length,
      items: quotations,
    };
  }

  /**
   * Enterprise comparison is an adapter over the same Admin-managed insurer
   * master and rating-rule engine. It must never synthesize carriers or rates.
   */
  async generateEnterpriseInsurerComparisons(payload: {
    coverType?: ProductType;
    exShowroomPrice?: Prisma.Decimal | string | number;
    registrationYear?: number;
    engineCc?: number;
    rtoCode?: string;
    rtoZone?: 'ZONE_A' | 'ZONE_B';
    ncbPercentage?: number;
    hadClaimInPreviousYear?: boolean;
    selectedAddons?: SelectedAddons;
    includePaCover?: boolean;
    selectedCarrierIds?: string[];
  }) {
    const result = await this.generateComparativeQuotesAsync({
      coverType: payload.coverType,
      exShowroomPrice: payload.exShowroomPrice === undefined ? undefined : Number(payload.exShowroomPrice),
      registrationYear: payload.registrationYear,
      engineCc: payload.engineCc,
      rtoZone: payload.rtoZone || (payload.rtoCode ? 'ZONE_A' : undefined),
      ncbPercentage: payload.ncbPercentage,
      hadClaimInPreviousYear: payload.hadClaimInPreviousYear,
      selectedAddons: payload.selectedAddons,
      includePaCover: payload.includePaCover,
      selectedInsurerIds: payload.selectedCarrierIds,
    });

    return {
      statutoryIdvEvaluation: {
        exShowroomPrice: String(payload.exShowroomPrice ?? ''),
        finalStatutoryIdv: String(result.idvDetails.finalIdv),
      },
      gatewayResponseSummary: {
        totalCarriersEvaluated: result.comparativeQuotes.length + result.unavailableInsurers.length,
        configuredCarrierQuotes: result.comparativeQuotes.length,
        notConfiguredCarriers: result.unavailableInsurers.length,
      },
      comparativeMatrix: result.comparativeQuotes.map((quote) => ({
        insurerId: quote.insurerId,
        insurerName: quote.insurerName,
        logo: quote.logo,
        gatewayStatus: 'ADMIN_CONFIGURED_RATING_RULE',
        pricingSource: quote.quoteSource,
        ratingProductCode: quote.ratingProductCode,
        insuredDeclaredValue: String(quote.idv),
        grossOwnDamagePremium: String(quote.odPremium + quote.ncbDiscount),
        noClaimBonusDiscount: String(quote.ncbDiscount),
        netOwnDamagePremium: String(quote.odPremium),
        netThirdPartyPremium: String(quote.tpPremium),
        addonsPremium: String(quote.addonsPremium),
        taxableNetPremium: String(quote.taxableNetPremium),
        segregatedGstLedger: {
          totalGstPayable: String(quote.gstTotal),
        },
        finalCustomerPayablePremium: String(quote.totalPremium),
      })),
      unavailableInsurers: result.unavailableInsurers,
    };
  }

}

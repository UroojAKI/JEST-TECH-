import { Injectable } from '@nestjs/common';
import { IdvService } from './idv.service';
import { PremiumService, CoverType } from './premium.service';
import { NcbService } from './ncb.service';
import { AddonsService, SelectedAddons } from './addons.service';
import { GstService } from './gst.service';
import { PrismaService } from '../../../database/prisma.service';

export interface QuotationInput {
  coverType?: CoverType;
  exShowroomPrice?: number;
  registrationYear?: number;
  engineCc?: number;
  manualOverrideIdv?: number;
  ncbPercentage?: number;
  hadClaimInPreviousYear?: boolean;
  selectedAddons?: SelectedAddons;
  rtoZone?: 'ZONE_A' | 'ZONE_B';
  includePaCover?: boolean;
}

export interface ComparativeInsurerQuote {
  insurerId: string;
  insurerName: string;
  logo: string;
  coverType: CoverType;
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
    comparativeQuotes: ComparativeInsurerQuote[];
  }> {
    const coverType: CoverType = input.coverType || 'COMPREHENSIVE';
    const exShowroom = input.exShowroomPrice || 1000000;
    const regYear = input.registrationYear || new Date().getFullYear() - 1;
    const engineCc = input.engineCc || 1197;

    const idvDetails = this.idvService.calculateIdv(exShowroom, regYear, input.manualOverrideIdv);
    const idv = idvDetails.finalIdv;

    const basePrem = this.premiumService.calculateMotorPremium(
      coverType,
      idv,
      engineCc,
      input.rtoZone || 'ZONE_A',
      input.includePaCover !== false,
    );

    const ncb = this.ncbService.calculateNcbDiscount(
      basePrem.odPremium,
      input.ncbPercentage || 20,
      input.hadClaimInPreviousYear || false,
    );

    const addons = this.addonsService.calculateAddons(idv, input.selectedAddons || { zeroDepreciation: true, roadsideAssistance: true });

    // Fetch active insurers configured by Admin in Insurer Master
    const dbInsurers = await this.prisma.insurer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    let insurersList: { id: string; name: string; logo: string; odFactor: number; isRec: boolean }[] = [];

    if (dbInsurers && dbInsurers.length > 0) {
      insurersList = dbInsurers.map((ins, idx) => ({
        id: ins.id,
        name: ins.name,
        logo: ins.logoUrl || ins.name.substring(0, 4).toUpperCase(),
        odFactor: 1.0 - (idx % 3) * 0.04,
        isRec: idx === 0,
      }));
    } else {
      // Dynamic fallback when Insurer Master is empty prior to admin configuration
      insurersList = [
        { id: 'hdfc-ergo', name: 'HDFC ERGO General Insurance', logo: 'HDFC', odFactor: 1.0, isRec: true },
        { id: 'icici-lombard', name: 'ICICI Lombard General Insurance', logo: 'ICICI', odFactor: 0.95, isRec: false },
        { id: 'bajaj-allianz', name: 'Bajaj Allianz General Insurance', logo: 'BAJAJ', odFactor: 0.92, isRec: false },
        { id: 'tata-aig', name: 'Tata AIG General Insurance', logo: 'TATA', odFactor: 0.97, isRec: false },
      ];
    }

    const comparativeQuotes: ComparativeInsurerQuote[] = insurersList.map((ins) => {
      const odPremium = Math.round(basePrem.odPremium * ins.odFactor);
      const ncbDiscount = Math.round(odPremium * (ncb.applicableNcbPercent / 100));
      const tpPremium = basePrem.tpPremium;
      const paCoverPremium = basePrem.paCoverPremium;
      const addonsPremium = addons.totalAddonsPremium;

      const taxableNetPremium = (odPremium - ncbDiscount) + tpPremium + paCoverPremium + addonsPremium;
      const tax = this.gstService.calculateTax(taxableNetPremium);

      return {
        insurerId: ins.id,
        insurerName: ins.name,
        logo: ins.logo,
        coverType,
        idv,
        odPremium,
        ncbDiscount,
        tpPremium,
        paCoverPremium,
        addonsPremium,
        addonsList: addons.breakup,
        taxableNetPremium,
        cgst: tax.cgst,
        sgst: tax.sgst,
        gstTotal: tax.totalGst,
        totalPremium: tax.finalTotalPremium,
        isRecommended: ins.isRec,
      };
    });

    return {
      idvDetails,
      comparativeQuotes,
    };
  }

  generateComparativeQuotes(input: QuotationInput): {
    idvDetails: any;
    comparativeQuotes: ComparativeInsurerQuote[];
  } {
    const coverType: CoverType = input.coverType || 'COMPREHENSIVE';
    const exShowroom = input.exShowroomPrice || 1000000;
    const regYear = input.registrationYear || new Date().getFullYear() - 1;
    const engineCc = input.engineCc || 1197;

    const idvDetails = this.idvService.calculateIdv(exShowroom, regYear, input.manualOverrideIdv);
    const idv = idvDetails.finalIdv;

    const basePrem = this.premiumService.calculateMotorPremium(
      coverType,
      idv,
      engineCc,
      input.rtoZone || 'ZONE_A',
      input.includePaCover !== false,
    );

    const ncb = this.ncbService.calculateNcbDiscount(
      basePrem.odPremium,
      input.ncbPercentage || 20,
      input.hadClaimInPreviousYear || false,
    );

    const addons = this.addonsService.calculateAddons(idv, input.selectedAddons || { zeroDepreciation: true, roadsideAssistance: true });

    const insurersList = [
      { id: 'hdfc-ergo', name: 'HDFC ERGO General Insurance', logo: 'HDFC', odFactor: 1.0, isRec: true },
      { id: 'icici-lombard', name: 'ICICI Lombard General Insurance', logo: 'ICICI', odFactor: 0.95, isRec: false },
      { id: 'bajaj-allianz', name: 'Bajaj Allianz General Insurance', logo: 'BAJAJ', odFactor: 0.92, isRec: false },
      { id: 'tata-aig', name: 'Tata AIG General Insurance', logo: 'TATA', odFactor: 0.97, isRec: false },
    ];

    const comparativeQuotes: ComparativeInsurerQuote[] = insurersList.map((ins) => {
      const odPremium = Math.round(basePrem.odPremium * ins.odFactor);
      const ncbDiscount = Math.round(odPremium * (ncb.applicableNcbPercent / 100));
      const tpPremium = basePrem.tpPremium;
      const paCoverPremium = basePrem.paCoverPremium;
      const addonsPremium = addons.totalAddonsPremium;

      const taxableNetPremium = (odPremium - ncbDiscount) + tpPremium + paCoverPremium + addonsPremium;
      const tax = this.gstService.calculateTax(taxableNetPremium);

      return {
        insurerId: ins.id,
        insurerName: ins.name,
        logo: ins.logo,
        coverType,
        idv,
        odPremium,
        ncbDiscount,
        tpPremium,
        paCoverPremium,
        addonsPremium,
        addonsList: addons.breakup,
        taxableNetPremium,
        cgst: tax.cgst,
        sgst: tax.sgst,
        gstTotal: tax.totalGst,
        totalPremium: tax.finalTotalPremium,
        isRecommended: ins.isRec,
      };
    });

    return {
      idvDetails,
      comparativeQuotes,
    };
  }

  getComparisonMatrix(input: QuotationInput) {
    const res = this.generateComparativeQuotes(input);
    const features = [
      { key: 'premium', label: 'Premium Payable' },
      { key: 'idv', label: 'Insured Declared Value (IDV)' },
      { key: 'ncbDiscount', label: 'NCB Discount (35%)' },
      { key: 'zeroDep', label: 'Zero Depreciation Cover' },
      { key: 'engineProtect', label: 'Engine Protector' },
      { key: 'rsa', label: 'Roadside Assistance (RSA)' },
      { key: 'consumables', label: 'Consumables Cover' },
      { key: 'claimSettlement', label: 'Claim Settlement Ratio' },
    ];

    const matrix = res.comparativeQuotes.map((q) => ({
      insurerId: q.insurerId,
      insurerName: q.insurerName,
      logo: q.logo,
      premium: `₹${q.totalPremium}`,
      idv: `₹${q.idv}`,
      ncbDiscount: `₹${q.ncbDiscount}`,
      zeroDep: true,
      engineProtect: true,
      rsa: true,
      consumables: true,
      claimSettlement: '98.5%',
      finalPremium: `₹${q.totalPremium}`,
    }));

    return {
      features,
      quotes: matrix,
    };
  }

  compare(quotations: any[]) {
    return {
      comparedCount: quotations.length,
      items: quotations,
    };
  }
}

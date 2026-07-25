import { Injectable } from '@nestjs/common';
import { IdvService } from './idv.service';
import { PremiumService, CoverType } from './premium.service';
import { NcbService } from './ncb.service';
import { AddonsService, SelectedAddons } from './addons.service';
import { GstService } from './gst.service';

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
  ) {}

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

  /**
   * Compares an array of quotation DTOs / models.
   */
  compare(quotations: any[]) {
    return {
      comparedCount: quotations.length,
      items: quotations,
    };
  }
}

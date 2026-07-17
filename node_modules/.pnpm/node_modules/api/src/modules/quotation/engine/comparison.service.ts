import { Injectable } from '@nestjs/common';
import { QuotationResponseDto } from '../dto/quotation-response.dto';

@Injectable()
export class ComparisonService {
  /**
   * Generates a comparison matrix of premiums, sum insured, and addons
   * across multiple insurer quotations.
   */
  compare(quotations: QuotationResponseDto[]): any {
    const comparisonCode = `COMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const items = quotations.map((q) => ({
      quotationId: q.id,
      quotationCode: q.quotationCode,
      insurerName: q.insurerName,
      productType: q.productType,
      sumInsured: q.sumInsured,
      basePremium: q.basePremium,
      discountAmount: q.discountAmount,
      gstAmount: q.gstAmount,
      totalPremium: q.totalPremium,
      addonsCount: q.addons?.length || 0,
      status: q.status,
    }));

    return {
      comparisonCode,
      comparedAt: new Date(),
      items,
    };
  }
}

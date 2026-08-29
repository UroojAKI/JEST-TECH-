import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleCategory } from '@prisma/client';

export interface TariffLookupParams {
  vehicleCategory: VehicleCategory;
  engineCc?: number;
  seatingCapacity?: number;
  gvwKg?: number;
  policyType: 'TP_ONLY' | 'PACKAGE';
  quotationDate: Date;
}

export interface TariffResult {
  found: boolean;
  annualPremium: number;
  tariffId?: string;
  version?: string;
  source?: string;
  isVerified: boolean;
  warning?: string;
}

@Injectable()
export class MotorTariffService {
  private readonly logger = new Logger(MotorTariffService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lookup the applicable TP tariff for a given vehicle on a given quotation date.
   * The tariff is effective-date based: we find the tariff where
   *   effectiveFrom <= quotationDate AND (effectiveTo IS NULL OR effectiveTo >= quotationDate)
   * This ensures renewals and historical quotations use the correct tariff.
   */
  async lookupTpTariff(params: TariffLookupParams): Promise<TariffResult> {
    const {
      vehicleCategory,
      engineCc,
      seatingCapacity,
      gvwKg,
      policyType,
      quotationDate,
    } = params;

    const tariffs = await this.prisma.motorTariff.findMany({
      where: {
        vehicleCategory,
        policyType,
        isActive: true,
        effectiveFrom: { lte: quotationDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: quotationDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (tariffs.length === 0) {
      this.logger.warn(
        `No active TP tariff found for category=${vehicleCategory}, policyType=${policyType}, date=${quotationDate}`,
      );
      return {
        found: false,
        annualPremium: 0,
        isVerified: false,
        warning:
          'No active IRDAI TP tariff configuration found for this vehicle category. Please contact the CRM administrator to configure tariff rates from the applicable IRDAI notification.',
      };
    }

    // Filter by capacity ranges if provided
    let matchedTariff = tariffs[0]; // default to first (most recent)

    for (const t of tariffs) {
      let matches = true;

      if (engineCc !== undefined) {
        if (t.engineCcMin !== null && engineCc < t.engineCcMin) matches = false;
        if (t.engineCcMax !== null && engineCc > t.engineCcMax) matches = false;
      }
      if (seatingCapacity !== undefined) {
        if (t.seatingCapMin !== null && seatingCapacity < t.seatingCapMin)
          matches = false;
        if (t.seatingCapMax !== null && seatingCapacity > t.seatingCapMax)
          matches = false;
      }
      if (gvwKg !== undefined && t.gvwMin !== null) {
        if (gvwKg < Number(t.gvwMin)) matches = false;
        if (t.gvwMax !== null && gvwKg > Number(t.gvwMax)) matches = false;
      }

      if (matches) {
        matchedTariff = t;
        break;
      }
    }

    return {
      found: true,
      annualPremium: Number(matchedTariff.annualPremium),
      tariffId: matchedTariff.id,
      version: matchedTariff.version,
      source: matchedTariff.source,
      isVerified: matchedTariff.isVerified,
      warning: matchedTariff.isVerified
        ? undefined
        : `Tariff version "${matchedTariff.version}" has not been verified against the IRDAI notification. Verify before issuing policies.`,
    };
  }

  /**
   * Calculate GST on premium (18% for Motor Insurance as per GST Act)
   */
  calculateGst(basePremium: number): number {
    return Math.round(basePremium * 0.18 * 100) / 100;
  }

  /**
   * Calculate OD Premium from IDV and insurer-filed rate
   * NOTE: OD premium is insurer-specific (not IRDAI tariff)
   * This applies insurer's OD rate and any NCB discount
   */
  calculateOdPremium(params: {
    idv: number;
    odRatePercent: number; // From insurer's filed rates
    ncbPercent: number; // 0 | 20 | 25 | 35 | 45 | 50
    addOnsPremium?: number;
  }): { basePremium: number; ncbDiscount: number; netPremium: number } {
    const basePremium = Math.round((params.idv * params.odRatePercent) / 100);
    const ncbDiscount = Math.round(basePremium * (params.ncbPercent / 100));
    const netPremium = basePremium - ncbDiscount + (params.addOnsPremium || 0);
    return { basePremium, ncbDiscount, netPremium };
  }
}

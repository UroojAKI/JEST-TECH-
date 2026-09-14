import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { PredictionProvider } from '../prediction-provider.interface';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StatisticalPredictionService implements PredictionProvider {
  private readonly logger = new Logger(StatisticalPredictionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Forecasts revenue using a simple Moving Average of the last 6 months + a 5% assumed growth.
   */
  async forecastRevenue(
    monthsAhead: number,
    branchId?: string,
  ): Promise<Decimal> {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    // Convert dates to YYYY-MM-DD
    const dateIdFilter = {
      gte: sixMonthsAgo.toISOString().split('T')[0],
    };

    const whereClause: any = { dateId: dateIdFilter };
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const result = await this.prisma.factRevenue.aggregate({
      where: whereClause,
      _sum: { amount: true },
    });

    const totalPastSixMonths = result._sum.amount || new Decimal(0);
    const averageMonthly = totalPastSixMonths.div(6);

    // Apply basic growth factor (e.g. 1% per month)
    const growthMultiplier = 1 + 0.01 * monthsAhead;

    const forecast = averageMonthly.mul(growthMultiplier);

    this.logger.log(
      `Forecasted Revenue for ${monthsAhead} months ahead: ${forecast}`,
    );
    return forecast;
  }

  async forecastRenewals(
    monthsAhead: number,
    branchId?: string,
  ): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + monthsAhead,
      1,
    );
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + monthsAhead + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const whereClause: any = {
      expiryDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      deletedAt: null,
    };
    if (branchId) {
      whereClause.createdBy = { branchId };
    }

    const totalExpiring = await this.prisma.policy.count({
      where: whereClause,
    });

    if (totalExpiring === 0) {
      return 0;
    }

    const pastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const pastExpiringCount = await this.prisma.policy.count({
      where: {
        expiryDate: { gte: pastYear, lt: startOfMonth },
        deletedAt: null,
        ...(branchId ? { createdBy: { branchId } } : {}),
      },
    });

    const renewedCount = await this.prisma.policyRenewal.count({
      where: {
        createdAt: { gte: pastYear },
        ...(branchId ? { policy: { createdBy: { branchId } } } : {}),
      },
    });

    const historicalRate =
      pastExpiringCount > 0
        ? Math.min(Math.max(renewedCount / pastExpiringCount, 0.5), 0.95)
        : 0.8;

    return Math.round(totalExpiring * historicalRate);
  }

  async forecastClaims(
    monthsAhead: number,
    branchId?: string,
  ): Promise<Decimal> {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const whereClause: any = {
      reportedDate: { gte: sixMonthsAgo },
      deletedAt: null,
    };
    if (branchId) {
      whereClause.createdBy = { branchId };
    }

    const result = await this.prisma.claim.aggregate({
      where: whereClause,
      _sum: { claimAmount: true },
    });

    const totalPastSixMonths = result._sum.claimAmount || new Decimal(0);
    const averageMonthly = totalPastSixMonths.div(6);

    if (averageMonthly.isZero()) {
      const policyAgg = await this.prisma.policy.aggregate({
        where: {
          deletedAt: null,
          ...(branchId ? { createdBy: { branchId } } : {}),
        },
        _sum: { premiumAmount: true },
      });
      const totalPremium = policyAgg._sum.premiumAmount || new Decimal(0);
      return totalPremium.div(12).mul(0.6);
    }

    const inflationMultiplier = 1 + 0.005 * monthsAhead;
    return averageMonthly.mul(inflationMultiplier);
  }

  async predictCustomerRisk(customerId: string): Promise<number> {
    const analytics = await this.prisma.customerAnalytics.findUnique({
      where: { contactId: customerId },
    });
    return analytics?.churnProbability || 50;
  }
}

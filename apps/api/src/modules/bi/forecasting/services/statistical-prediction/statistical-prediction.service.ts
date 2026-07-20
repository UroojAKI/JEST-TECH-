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
  async forecastRevenue(monthsAhead: number, branchId?: string): Promise<Decimal> {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    // Convert dates to YYYY-MM-DD
    const dateIdFilter = {
      gte: sixMonthsAgo.toISOString().split('T')[0]
    };

    const whereClause: any = { dateId: dateIdFilter };
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const result = await this.prisma.factRevenue.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    const totalPastSixMonths = result._sum.amount || new Decimal(0);
    const averageMonthly = totalPastSixMonths.div(6);

    // Apply basic growth factor (e.g. 1% per month)
    const growthMultiplier = 1 + (0.01 * monthsAhead);
    
    const forecast = averageMonthly.mul(growthMultiplier);
    
    this.logger.log(`Forecasted Revenue for ${monthsAhead} months ahead: ${forecast}`);
    return forecast;
  }

  async forecastRenewals(monthsAhead: number, branchId?: string): Promise<number> {
    // Basic logic: count expiring policies in target month * historical renewal rate
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthsAhead);
    
    // In a real system, we'd query FactPolicy for expirations matching targetDate month
    const totalExpiring = 1000; // Mocked for illustration
    
    // Assume historical renewal rate is 80%
    const expectedRenewals = totalExpiring * 0.8;
    return expectedRenewals;
  }

  async forecastClaims(monthsAhead: number, branchId?: string): Promise<Decimal> {
    return new Decimal(50000); // Mocked
  }

  async predictCustomerRisk(customerId: string): Promise<number> {
    const analytics = await this.prisma.customerAnalytics.findUnique({
      where: { contactId: customerId }
    });
    return analytics?.churnProbability || 50;
  }
}

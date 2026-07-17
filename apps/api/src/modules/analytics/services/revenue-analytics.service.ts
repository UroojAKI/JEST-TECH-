import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class RevenueAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSum(start: Date, end?: Date): Promise<number> {
    const whereClause: any = {
      status: PaymentStatus.SUCCESS,
      paymentDate: { gte: start },
    };
    if (end) {
      whereClause.paymentDate.lt = end;
    }

    const agg = await this.prisma.policyPayment.aggregate({
      _sum: {
        amount: true,
      },
      where: whereClause,
    });
    return agg._sum.amount ? Number(agg._sum.amount) : 0;
  }

  async getOverview() {
    const now = new Date();

    const getStartOfDay = (d: Date) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    const startOfToday = getStartOfDay(now);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);

    const today = await this.getSum(startOfToday);
    const yesterday = await this.getSum(startOfYesterday, startOfToday);
    const thisWeek = await this.getSum(startOfWeek);
    const thisMonth = await this.getSum(startOfMonth);
    const thisYear = await this.getSum(startOfYear);
    const lastYear = await this.getSum(startOfLastYear, startOfYear);

    return {
      today,
      yesterday,
      thisWeek,
      thisMonth,
      thisYear,
      lastYear,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyStatus } from '@prisma/client';

@Injectable()
export class RenewalAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();

    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const d20 = addDays(now, 20);
    const d30 = addDays(now, 30);
    const d45 = addDays(now, 45);

    const expiring20 = await this.prisma.policy.count({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: { gt: now, lte: d20 },
        deletedAt: null,
      },
    });

    const expiring30 = await this.prisma.policy.count({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: { gt: now, lte: d30 },
        deletedAt: null,
      },
    });

    const expiring45 = await this.prisma.policy.count({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: { gt: now, lte: d45 },
        deletedAt: null,
      },
    });

    const expired = await this.prisma.policy.count({
      where: {
        expiryDate: { lte: now },
        status: { not: PolicyStatus.ACTIVE },
        deletedAt: null,
      },
    });

    const renewed = await this.prisma.policyRenewal.count();

    return {
      expiring20,
      expiring30,
      expiring45,
      expired,
      renewed,
    };
  }
}

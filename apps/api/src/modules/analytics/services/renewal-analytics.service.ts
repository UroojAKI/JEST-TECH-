import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyStatus } from '@prisma/client';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class RenewalAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(actor: RequestUser) {
    const now = new Date();

    const companyId = actor.companyId || actor.organizationId;
    if (!companyId) {
      throw new ForbiddenException(
        'Company context is required for renewal analytics',
      );
    }

    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const d20 = addDays(now, 20);
    const d30 = addDays(now, 30);
    const d45 = addDays(now, 45);

    const [expiring20, expiring30, expiring45, expired, renewed] =
      await Promise.all([
        this.prisma.policy.count({
          where: {
            status: PolicyStatus.ACTIVE,
            expiryDate: { gt: now, lte: d20 },
            deletedAt: null,
            companyId,
          },
        }),
        this.prisma.policy.count({
          where: {
            status: PolicyStatus.ACTIVE,
            expiryDate: { gt: now, lte: d30 },
            deletedAt: null,
            companyId,
          },
        }),
        this.prisma.policy.count({
          where: {
            status: PolicyStatus.ACTIVE,
            expiryDate: { gt: now, lte: d45 },
            deletedAt: null,
            companyId,
          },
        }),
        this.prisma.policy.count({
          where: {
            expiryDate: { lte: now },
            status: { not: PolicyStatus.ACTIVE },
            deletedAt: null,
            companyId,
          },
        }),
        this.prisma.policyRenewal.count({
          where: { policy: { companyId } },
        }),
      ]);

    return {
      expiring20,
      expiring30,
      expiring45,
      expired,
      renewed,
    };
  }
}

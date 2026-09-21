import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyStatus } from '@prisma/client';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PolicyAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(actor: RequestUser) {
    const orgFilter = actor.organizationId ? { companyId: actor.organizationId } : {};

    const [
      total,
      active,
      cancelled,
      pendingRenewal,
      insurerGroup,
      productGroup,
    ] = await Promise.all([
      this.prisma.policy.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.policy.count({
        where: { status: PolicyStatus.ACTIVE, deletedAt: null, ...orgFilter },
      }),
      this.prisma.policy.count({
        where: { status: PolicyStatus.CANCELLED, deletedAt: null, ...orgFilter },
      }),
      this.prisma.policy.count({
        where: { status: PolicyStatus.PENDING_RENEWAL, deletedAt: null, ...orgFilter },
      }),
      this.prisma.quotation.groupBy({
        by: ['insurerName'],
        _count: { quotationCode: true },
        where: { policy: { isNot: null }, ...orgFilter },
      }),
      this.prisma.quotation.groupBy({
        by: ['productType'],
        _count: { quotationCode: true },
        where: { policy: { isNot: null }, ...orgFilter },
      }),
    ]);

    const topInsurers = insurerGroup
      .map((g) => ({
        insurer: g.insurerName,
        count: g._count.quotationCode,
      }))
      .sort((a, b) => b.count - a.count);

    const topProducts = productGroup
      .map((g) => ({
        product: g.productType,
        count: g._count.quotationCode,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      active,
      cancelled,
      pendingRenewal,
      topInsurers,
      topProducts,
    };
  }
}

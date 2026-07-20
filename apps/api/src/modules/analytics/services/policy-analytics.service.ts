import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyStatus } from '@prisma/client';

@Injectable()
export class PolicyAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [total, active, cancelled, pendingRenewal, insurerGroup, productGroup] = await Promise.all([
      this.prisma.policy.count({ where: { deletedAt: null } }),
      this.prisma.policy.count({ where: { status: PolicyStatus.ACTIVE, deletedAt: null } }),
      this.prisma.policy.count({ where: { status: PolicyStatus.CANCELLED, deletedAt: null } }),
      this.prisma.policy.count({ where: { status: PolicyStatus.PENDING_RENEWAL, deletedAt: null } }),
      this.prisma.quotation.groupBy({ by: ['insurerName'], _count: { id: true }, where: { policy: { isNot: null } } }),
      this.prisma.quotation.groupBy({ by: ['productType'], _count: { id: true }, where: { policy: { isNot: null } } }),
    ]);

    const topInsurers = insurerGroup.map((g) => ({
      insurer: g.insurerName,
      count: g._count.id,
    })).sort((a, b) => b.count - a.count);

    const topProducts = productGroup.map((g) => ({
      product: g.productType,
      count: g._count.id,
    })).sort((a, b) => b.count - a.count);

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

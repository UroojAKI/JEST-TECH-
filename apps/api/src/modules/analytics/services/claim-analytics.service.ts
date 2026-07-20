import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ClaimStatus, PolicyStatus } from '@prisma/client';

@Injectable()
export class ClaimAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      total,
      reported,
      registered,
      underAssessment,
      approved,
      settled,
      sumClaims,
      activePoliciesPremiumSum,
    ] = await Promise.all([
      this.prisma.claim.count({ where: { deletedAt: null } }),
      this.prisma.claim.count({
        where: { status: ClaimStatus.REPORTED, deletedAt: null },
      }),
      this.prisma.claim.count({
        where: { status: ClaimStatus.REGISTERED, deletedAt: null },
      }),
      this.prisma.claim.count({
        where: { status: ClaimStatus.UNDER_ASSESSMENT, deletedAt: null },
      }),
      this.prisma.claim.count({
        where: { status: ClaimStatus.APPROVED, deletedAt: null },
      }),
      this.prisma.claim.count({
        where: { status: ClaimStatus.SETTLED, deletedAt: null },
      }),
      this.prisma.claim.aggregate({
        _sum: { claimAmount: true, approvedAmount: true },
        where: { deletedAt: null },
      }),
      this.prisma.policy.aggregate({
        _sum: { premiumAmount: true },
        where: { status: PolicyStatus.ACTIVE, deletedAt: null },
      }),
    ]);

    const totalClaimAmount = sumClaims._sum.claimAmount
      ? Number(sumClaims._sum.claimAmount)
      : 0;
    const totalApprovedAmount = sumClaims._sum.approvedAmount
      ? Number(sumClaims._sum.approvedAmount)
      : 0;

    const totalPremiumSum = activePoliciesPremiumSum._sum.premiumAmount
      ? Number(activePoliciesPremiumSum._sum.premiumAmount)
      : 0;

    const lossRatio =
      totalPremiumSum > 0 ? (totalApprovedAmount / totalPremiumSum) * 100 : 0;

    return {
      total,
      byStatus: {
        reported,
        registered,
        underAssessment,
        approved,
        settled,
      },
      totalClaimAmount,
      totalApprovedAmount,
      lossRatio: Number(lossRatio.toFixed(1)),
    };
  }
}

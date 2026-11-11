import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * F-008 FIX: getSalesKpis now accepts companyId and scopes all queries to that tenant.
   * isManager only removes the userId/assignedToId filter, never bypasses tenant isolation.
   */
  async getSalesKpis(userId?: string, isManager = false, companyId?: string) {
    if (!companyId) {
      throw new ForbiddenException('Company context is required for sales KPIs');
    }
    const whereClause: any = { companyId };
    // Add deletedAt filter for soft-delete support
    whereClause.deletedAt = null;
    if (userId && !isManager) {
      whereClause.assignedToId = userId;
    }

    const totalLeads = await this.prisma.lead.count({ where: whereClause });
    const interestedLeads = await this.prisma.lead.count({
      where: {
        ...whereClause,
        currentWorkflowStep: {
          in: ['NEED_ANALYSIS', 'QUOTATION', 'PROPOSAL', 'NEGOTIATION'],
        },
      },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Call logs scoped via lead.companyId relation when isManager
    const todayCalls = await this.prisma.callLog.count({
      where: {
        ...(userId && !isManager ? { userId } : {}),
        lead: { companyId },
        createdAt: { gte: todayStart },
      },
    });

    const todayMeetings = await this.prisma.meetingLog.count({
      where: {
        ...(userId && !isManager ? { userId } : {}),
        lead: { companyId },
        scheduledAt: { gte: todayStart },
      },
    });

    const quotePending = await this.prisma.lead.count({
      where: { ...whereClause, currentWorkflowStep: 'QUOTATION' },
    });

    const proposalPending = await this.prisma.lead.count({
      where: { ...whereClause, currentWorkflowStep: 'PROPOSAL' },
    });

    const convertedLeadCount = await this.prisma.lead.count({
      where: {
        ...whereClause,
        currentWorkflowStep: { in: ['ISSUED', 'REFERRAL', 'CRM_UPDATED'] },
      },
    });

    const referralsCount = await this.prisma.referral.count({
      where: {
        assignedTo: { companyId },
        ...(userId && !isManager ? { assignedToId: userId } : {}),
      },
    });

    const conversionPercentage =
      totalLeads > 0 ? ((convertedLeadCount / totalLeads) * 100).toFixed(1) : '0.0';

    // Policy aggregations scoped to companyId
    const policyWhere: any = {
      status: { in: ['ACTIVE', 'ISSUED'] as any },
      deletedAt: null,
    };
    if (companyId) policyWhere.companyId = companyId;
    if (userId && !isManager) policyWhere.createdById = userId;

    const now = new Date();
    const [todayRevenueAgg, totalRevenueAgg, monthlyRevenueAgg, monthlyPoliciesCount, targetAgg] = await Promise.all([
      this.prisma.policy.aggregate({
        _sum: { premiumAmount: true },
        where: { ...policyWhere, createdAt: { gte: todayStart } },
      }),
      this.prisma.policy.aggregate({
        _sum: { premiumAmount: true },
        where: policyWhere,
      }),
      this.prisma.policy.aggregate({
        _sum: { premiumAmount: true },
        where: { ...policyWhere, createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      }),
      this.prisma.policy.count({
        where: { ...policyWhere, createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      }),
      this.prisma.salesTarget.aggregate({
        where: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          user: { companyId },
          ...(userId && !isManager ? { userId } : {}),
        },
        _sum: { targetGwp: true, targetPolicies: true },
      }),
    ]);;

    const todayRevenue = Number(todayRevenueAgg._sum?.premiumAmount || 0);
    const achievedGwp = Number(totalRevenueAgg._sum?.premiumAmount || 0);
    const monthlyAchievedGwp = Number(monthlyRevenueAgg._sum?.premiumAmount || 0);
    const monthlyTargetGwp = Number(targetAgg._sum?.targetGwp || 0);
    const monthlyTargetPolicies = Number(targetAgg._sum?.targetPolicies || 0);
    const targetAchievementPercent = monthlyTargetGwp > 0
      ? ((monthlyAchievedGwp / monthlyTargetGwp) * 100).toFixed(1)
      : null;
    const avgPolicyValue =
      monthlyPoliciesCount > 0 ? Math.round(monthlyAchievedGwp / monthlyPoliciesCount) : 0;

    return {
      topRow: {
        assignedLeads: totalLeads,
        interestedLeads,
        todayCalls,
        todayMeetings,
        quotePending,
        proposalPending,
        policiesSold: monthlyPoliciesCount,
        todayRevenue,
      },
      bottomRow: {
        referralCount: referralsCount,
        crossSellRatio: '—',
        conversionPercentage: `${conversionPercentage}%`,
        averageTatHours: '—',
        averagePolicyValue: `₹${avgPolicyValue.toLocaleString('en-IN')}`,
        targetAchievementPercent: targetAchievementPercent === null ? '—' : `${targetAchievementPercent}%`,
        monthlyTargetGwp: monthlyTargetGwp > 0 ? `₹${monthlyTargetGwp.toLocaleString('en-IN')}` : '—',
        achievedGwp: `₹${achievedGwp.toLocaleString('en-IN')}`,
        monthlyTargetPolicies: monthlyTargetPolicies > 0 ? monthlyTargetPolicies : '—',
        customerRating: '—',
      },
    };
  }

  /**
   * F-008 FIX: getSalesPipeline now accepts companyId and scopes all queries to that tenant.
   */
  async getSalesPipeline(userId?: string, companyId?: string) {
    if (!companyId) {
      throw new ForbiddenException('Company context is required for sales pipeline');
    }
    const where: any = { deletedAt: null, companyId };
    if (userId) where.assignedToId = userId;

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        contact: true,
        quotations: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const stages = [
      'ASSIGNED',
      'CONTACTED',
      'NEED_ANALYSIS',
      'QUOTATION',
      'PROPOSAL',
      'NEGOTIATION',
      'PAYMENT',
      'ISSUED',
      'REFERRAL',
      'CRM_UPDATED',
    ];

    const distribution = stages.reduce(
      (acc, stage) => {
        acc[stage] = leads.filter(
          (l) => (l.currentWorkflowStep || 'ASSIGNED') === stage,
        ).length;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      distribution,
      total: leads.length,
      leads,
    };
  }
}

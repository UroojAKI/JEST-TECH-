import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesKpis(userId?: string, isManager = false) {
    const whereClause: any = { deletedAt: null };
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

    const todayCalls = await this.prisma.callLog.count({
      where: {
        ...(userId && !isManager ? { userId } : {}),
        createdAt: { gte: todayStart },
      },
    });

    const todayMeetings = await this.prisma.meetingLog.count({
      where: {
        ...(userId && !isManager ? { userId } : {}),
        scheduledAt: { gte: todayStart },
      },
    });

    const quotePending = await this.prisma.lead.count({
      where: { ...whereClause, currentWorkflowStep: 'QUOTATION' },
    });

    const proposalPending = await this.prisma.lead.count({
      where: { ...whereClause, currentWorkflowStep: 'PROPOSAL' },
    });

    const policiesSold = await this.prisma.lead.count({
      where: {
        ...whereClause,
        currentWorkflowStep: { in: ['ISSUED', 'REFERRAL', 'CRM_UPDATED'] },
      },
    });

    const referralsCount = await this.prisma.referral.count({
      where: userId && !isManager ? { assignedToId: userId } : {},
    });

    const conversionPercentage =
      totalLeads > 0 ? ((policiesSold / totalLeads) * 100).toFixed(1) : '0.0';

    const [todayRevenueAgg, totalRevenueAgg] = await Promise.all([
      this.prisma.policy.aggregate({
        _sum: { premiumAmount: true },
        where: {
          ...(userId && !isManager ? { createdById: userId } : {}),
          status: { in: ['ACTIVE', 'ISSUED'] as any },
          createdAt: { gte: todayStart },
          deletedAt: null,
        },
      }),
      this.prisma.policy.aggregate({
        _sum: { premiumAmount: true },
        where: {
          ...(userId && !isManager ? { createdById: userId } : {}),
          status: { in: ['ACTIVE', 'ISSUED'] as any },
          deletedAt: null,
        },
      }),
    ]);

    const todayRevenue = Number(todayRevenueAgg._sum?.premiumAmount || 0);
    const achievedGwp = Number(totalRevenueAgg._sum?.premiumAmount || 0);
    const avgPolicyValue =
      policiesSold > 0 ? Math.round(achievedGwp / policiesSold) : 0;

    return {
      topRow: {
        assignedLeads: totalLeads,
        interestedLeads,
        todayCalls,
        todayMeetings,
        quotePending,
        proposalPending,
        policiesSold,
        todayRevenue,
      },
      bottomRow: {
        referralCount: referralsCount,
        crossSellRatio: '0.0%',
        conversionPercentage: `${conversionPercentage}%`,
        averageTatHours: '—',
        averagePolicyValue: `₹${avgPolicyValue.toLocaleString('en-IN')}`,
        targetAchievementPercent: '0.0%',
        monthlyTargetGwp: '—',
        achievedGwp: `₹${achievedGwp.toLocaleString('en-IN')}`,
        customerRating: '—',
      },
    };
  }

  async getSalesPipeline(userId?: string) {
    const where: any = { deletedAt: null };
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

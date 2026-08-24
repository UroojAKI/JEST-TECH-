import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class DashboardAnalyticsService {
  private readonly logger = new Logger(DashboardAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSalesMetrics(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeLeadsCount = await this.prisma.lead.count({
      where: { assignedToId: userId, status: { notIn: ['CONVERTED', 'LOST'] } },
    });

    const revenue = await this.prisma.factRevenue.aggregate({
      _sum: { amount: true },
      where: { agentId: userId }
    });

    let myPremium = Number(revenue._sum?.amount ?? 0);
    if (myPremium === 0) {
      const policies = await this.prisma.policy.findMany({ where: { createdById: userId } });
      myPremium = policies.reduce((sum, p) => sum + Number(p.premiumAmount || 0), 0);
    }

    const totalLeads = await this.prisma.lead.count({ where: { assignedToId: userId } });
    const convertedLeads = await this.prisma.lead.count({ where: { assignedToId: userId, status: 'CONVERTED' } });
    const conversionRatio = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    const policiesIssued = await this.prisma.policy.count({ where: { createdById: userId } });

    return {
      kpi: {
        myLeads: activeLeadsCount,
        myPremium: myPremium,
        conversionRatio: conversionRatio.toFixed(1),
        policiesIssued: policiesIssued,
      },
      table: [
        { reference: 'POL-2026-8841', entity: 'Ramesh Motors Pvt Ltd', amount: 145000 },
        { reference: 'CLM-2026-3391', entity: 'Suresh Kumar', amount: 85000 },
      ],
      list: [
        { title: 'Follow-up with Ankit Shah (Health Renewal)', status: 'warning' },
        { title: 'Corporate Fleet Quote Approval', status: 'success' },
      ]
    };
  }

  async getSalesManagerMetrics(userId: string, branchId?: string) {
    const activeLeadsCount = await this.prisma.lead.count({
      where: {
        status: { notIn: ['CONVERTED', 'LOST'] },
        ...(branchId ? { branchId } : {}),
      },
    });

    const revenue = await this.prisma.factRevenue.aggregate({
      _sum: { amount: true },
      where: branchId ? { branchId } : undefined
    });
    
    let teamPremium = Number(revenue._sum?.amount ?? 0);
    if (teamPremium === 0) {
      const policies = await this.prisma.policy.findMany();
      teamPremium = policies.reduce((sum, p) => sum + Number(p.premiumAmount || 0), 0);
    }

    const policiesIssued = await this.prisma.policy.count();

    return {
      kpi: {
        teamLeads: activeLeadsCount,
        teamPremium: teamPremium,
        policiesIssued: policiesIssued,
      }
    };
  }

  async getRenewalMetrics(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const expiring30d = await this.prisma.policy.count({
      where: { expiryDate: { gte: today, lte: in30Days } }
    });

    return {
      kpi: {
        expiring30d,
        renewed: 0,
        lapsed: 0,
      }
    };
  }
}
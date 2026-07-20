import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeadStatus } from '@prisma/client';

@Injectable()
export class LeadAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      total,
      open,
      converted,
      lost,
      todayLeads,
      funnelNew,
      funnelContacted,
      funnelFollowUp,
      funnelQualified,
      funnelQuote,
      funnelPolicy,
      funnelLost,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { deletedAt: null } }),
      this.prisma.lead.count({ where: { status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED] }, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.CONVERTED, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.LOST, deletedAt: null } }),
      this.prisma.lead.count({ where: { createdAt: { gte: startOfToday }, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.NEW, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.CONTACTED, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.CONTACTED, OR: [{ activities: { some: {} } }, { notes: { some: {} } }], deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.QUALIFIED, deletedAt: null } }),
      this.prisma.lead.count({ where: { quotations: { some: {} }, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.CONVERTED, deletedAt: null } }),
      this.prisma.lead.count({ where: { status: LeadStatus.LOST, deletedAt: null } }),
    ]);

    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    return {
      total,
      open,
      converted,
      lost,
      todayLeads,
      conversionRate: Number(conversionRate.toFixed(1)),
      funnel: [
        { stage: 'NEW', count: funnelNew },
        { stage: 'CONTACTED', count: funnelContacted },
        { stage: 'FOLLOW_UP', count: funnelFollowUp },
        { stage: 'QUALIFIED', count: funnelQualified },
        { stage: 'QUOTE', count: funnelQuote },
        { stage: 'POLICY', count: funnelPolicy },
        { stage: 'LOST', count: funnelLost },
      ],
    };
  }
}

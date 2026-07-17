import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeadStatus } from '@prisma/client';

@Injectable()
export class LeadAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const total = await this.prisma.lead.count({ where: { deletedAt: null } });
    const open = await this.prisma.lead.count({
      where: {
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED] },
        deletedAt: null,
      },
    });
    const converted = await this.prisma.lead.count({
      where: { status: LeadStatus.CONVERTED, deletedAt: null },
    });
    const lost = await this.prisma.lead.count({
      where: { status: LeadStatus.LOST, deletedAt: null },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayLeads = await this.prisma.lead.count({
      where: {
        createdAt: { gte: startOfToday },
        deletedAt: null,
      },
    });

    // Funnel Steps Calculations
    const funnelNew = await this.prisma.lead.count({
      where: { status: LeadStatus.NEW, deletedAt: null },
    });
    const funnelContacted = await this.prisma.lead.count({
      where: { status: LeadStatus.CONTACTED, deletedAt: null },
    });
    const funnelFollowUp = await this.prisma.lead.count({
      where: {
        status: LeadStatus.CONTACTED,
        OR: [
          { activities: { some: {} } },
          { notes: { some: {} } },
        ],
        deletedAt: null,
      },
    });
    const funnelQualified = await this.prisma.lead.count({
      where: { status: LeadStatus.QUALIFIED, deletedAt: null },
    });
    const funnelQuote = await this.prisma.lead.count({
      where: {
        quotations: { some: {} },
        deletedAt: null,
      },
    });
    const funnelPolicy = await this.prisma.lead.count({
      where: {
        status: LeadStatus.CONVERTED,
        deletedAt: null,
      },
    });
    const funnelLost = await this.prisma.lead.count({
      where: { status: LeadStatus.LOST, deletedAt: null },
    });

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

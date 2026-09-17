import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeadStatus } from '@prisma/client';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class LeadAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(actor: RequestUser) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const orgFilter = actor.organizationId ? { organizationId: actor.organizationId } : {};

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
      this.prisma.lead.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.lead.count({
        where: {
          status: {
            in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED],
          },
          deletedAt: null,
          ...orgFilter,
        },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.CONVERTED, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.LOST, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { createdAt: { gte: startOfToday }, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.NEW, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.CONTACTED, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: {
          status: LeadStatus.CONTACTED,
          OR: [{ activities: { some: {} } }, { notes: { some: {} } }],
          deletedAt: null,
          ...orgFilter,
        },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.QUALIFIED, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { quotations: { some: {} }, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.CONVERTED, deletedAt: null, ...orgFilter },
      }),
      this.prisma.lead.count({
        where: { status: LeadStatus.LOST, deletedAt: null, ...orgFilter },
      }),
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

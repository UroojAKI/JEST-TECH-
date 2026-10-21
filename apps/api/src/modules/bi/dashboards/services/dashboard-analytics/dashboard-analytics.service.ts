import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class DashboardAnalyticsService {
  private readonly logger = new Logger(DashboardAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSalesMetrics(userId: string, companyId?: string) {
    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      throw new ForbiddenException('Tenant companyId is required for sales dashboard');
    }
    const cleanCompanyId = companyId.trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeLeadsCount = await this.prisma.lead.count({
      where: {
        assignedToId: userId,
        status: { notIn: ['CONVERTED', 'LOST'] },
        companyId: cleanCompanyId,
      },
    });

    const tenantBranches = await this.prisma.branch.findMany({
      where: { zone: { region: { companyId: cleanCompanyId } } },
      select: { id: true },
    });
    const branchIds = tenantBranches.map((b) => b.id);

    const revenue = await this.prisma.factRevenue.aggregate({
      _sum: { amount: true },
      where: {
        agentId: userId,
        branchId: { in: branchIds },
      },
    });

    let myPremium = Number(revenue._sum?.amount ?? 0);
    if (myPremium === 0) {
      const policies = await this.prisma.policy.findMany({
        where: {
          createdById: userId,
          companyId: cleanCompanyId,
        },
      });
      myPremium = policies.reduce(
        (sum, p) => sum + Number(p.premiumAmount || 0),
        0,
      );
    }

    const totalLeads = await this.prisma.lead.count({
      where: {
        assignedToId: userId,
        companyId: cleanCompanyId,
      },
    });
    const convertedLeads = await this.prisma.lead.count({
      where: {
        assignedToId: userId,
        status: 'CONVERTED',
        companyId: cleanCompanyId,
      },
    });
    const conversionRatio =
      totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    const policiesIssued = await this.prisma.policy.count({
      where: {
        createdById: userId,
        companyId: cleanCompanyId,
      },
    });

    const recentPolicies = await this.prisma.policy.findMany({
      where: {
        createdById: userId,
        companyId: cleanCompanyId,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { contact: true },
    });

    const table = recentPolicies.map((p) => ({
      reference: p.policyNumber,
      entity: p.contact
        ? `${p.contact.firstName} ${p.contact.lastName}`.trim()
        : 'N/A',
      amount: Number(p.premiumAmount || 0),
    }));

    const followUps = await this.prisma.lead.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ['CONVERTED', 'LOST'] },
        companyId: cleanCompanyId,
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    const list = followUps.map((lead) => ({
      title: `Lead: ${lead.title || lead.leadCode}`,
      status: lead.priority === 'HIGH' ? 'warning' : 'info',
    }));

    return {
      kpi: {
        myLeads: activeLeadsCount,
        myPremium: myPremium,
        conversionRatio: conversionRatio.toFixed(1),
        policiesIssued: policiesIssued,
      },
      table,
      list,
    };
  }

  async getSalesManagerMetrics(
    userId: string,
    branchId?: string,
    companyId?: string,
  ) {
    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      throw new ForbiddenException('Tenant companyId is required for sales manager dashboard');
    }
    const cleanCompanyId = companyId.trim();

    const activeLeadsCount = await this.prisma.lead.count({
      where: {
        status: { notIn: ['CONVERTED', 'LOST'] },
        companyId: cleanCompanyId,
        ...(branchId ? { branchId } : {}),
      },
    });

    const tenantBranches = await this.prisma.branch.findMany({
      where: { zone: { region: { companyId: cleanCompanyId } } },
      select: { id: true },
    });
    const tenantBranchIds = tenantBranches.map((b) => b.id);
    const effectiveBranchIds = branchId
      ? tenantBranchIds.filter((id) => id === branchId)
      : tenantBranchIds;

    const revenue = await this.prisma.factRevenue.aggregate({
      _sum: { amount: true },
      where: {
        branchId: { in: effectiveBranchIds },
      },
    });

    let teamPremium = Number(revenue._sum?.amount ?? 0);
    if (teamPremium === 0) {
      const policies = await this.prisma.policy.findMany({
        where: {
          companyId: cleanCompanyId,
          ...(branchId ? { createdBy: { branchId } } : {}),
        },
      });
      teamPremium = policies.reduce(
        (sum, p) => sum + Number(p.premiumAmount || 0),
        0,
      );
    }

    const policiesIssued = await this.prisma.policy.count({
      where: {
        companyId: cleanCompanyId,
        ...(branchId ? { createdBy: { branchId } } : {}),
      },
    });

    return {
      kpi: {
        teamLeads: activeLeadsCount,
        teamPremium: teamPremium,
        policiesIssued: policiesIssued,
      },
    };
  }

  async getRenewalMetrics(userId: string, companyId?: string) {
    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      throw new ForbiddenException('Tenant companyId is required for renewal dashboard');
    }
    const cleanCompanyId = companyId.trim();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const [expiring30d, renewed, lapsed] = await Promise.all([
      this.prisma.policy.count({
        where: {
          expiryDate: { gte: today, lte: in30Days },
          status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
          companyId: cleanCompanyId,
        },
      }),
      this.prisma.policy.count({
        where: {
          status: 'RENEWED',
          companyId: cleanCompanyId,
        },
      }),
      this.prisma.policy.count({
        where: {
          status: 'LAPSED',
          companyId: cleanCompanyId,
        },
      }),
    ]);

    return {
      kpi: {
        expiring30d,
        renewed,
        lapsed,
      },
    };
  }
}

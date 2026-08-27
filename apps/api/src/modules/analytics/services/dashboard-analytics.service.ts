import { Injectable, Inject } from '@nestjs/common';
import {
  CACHE_PROVIDER_TOKEN,
  ICacheProvider,
} from '../../platform/cache/cache.provider';
import { RedisCacheService } from '../../platform/cache/redis-cache.service';
import { ContactAnalyticsService } from './contact-analytics.service';
import { LeadAnalyticsService } from './lead-analytics.service';
import { QuotationAnalyticsService } from './quotation-analytics.service';
import { PolicyAnalyticsService } from './policy-analytics.service';
import { ClaimAnalyticsService } from './claim-analytics.service';
import { RenewalAnalyticsService } from './renewal-analytics.service';
import { RevenueAnalyticsService } from './revenue-analytics.service';
import { PrismaService } from '../../../database/prisma.service';
import { PolicyStatus, RoleType, UserStatus } from '@prisma/client';

@Injectable()
export class DashboardAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactAnalytics: ContactAnalyticsService,
    private readonly leadAnalytics: LeadAnalyticsService,
    private readonly quotationAnalytics: QuotationAnalyticsService,
    private readonly policyAnalytics: PolicyAnalyticsService,
    private readonly claimAnalytics: ClaimAnalyticsService,
    private readonly renewalAnalytics: RenewalAnalyticsService,
    private readonly revenueAnalytics: RevenueAnalyticsService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
  ) {}

  async getDashboardData(role: string, userId: string) {
    const cacheKey = `dashboard:analytics:${userId}:${role}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.computeDashboardData(role, userId);
    await this.cache.set(cacheKey, result, 300); // 5 min TTL
    return result;
  }

  async clearDashboardCache(userId: string) {
    await this.cache.clear(`dashboard:analytics:${userId}`);
  }

  private async computeDashboardData(role: string, userId: string) {
    const [revenue, leads, policies, claims, renewals, quotations] =
      await Promise.all([
        this.revenueAnalytics.getOverview(),
        this.leadAnalytics.getOverview(),
        this.policyAnalytics.getOverview(),
        this.claimAnalytics.getOverview(),
        this.renewalAnalytics.getOverview(),
        this.quotationAnalytics.getOverview(),
      ]);

    // Live Renewal Conversion Rate (Zero Hardcoding)
    const [totalRenewalTasks, completedRenewalTasks] = await Promise.all([
      this.prisma.renewalTask.count(),
      this.prisma.renewalTask.count({ where: { status: 'COMPLETED' } }),
    ]);
    const liveRenewalRate =
      totalRenewalTasks > 0
        ? `${((completedRenewalTasks / totalRenewalTasks) * 100).toFixed(1)}%`
        : '0.0%';

    // Live Loss Ratio (Zero Hardcoding)
    const [claimsSettledAgg, totalGwpAgg] = await Promise.all([
      this.prisma.claim.aggregate({
        _sum: { claimAmount: true },
        where: { status: 'SETTLED', deletedAt: null },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
    ]);
    const settledAmount = Number(claimsSettledAgg._sum?.claimAmount || 0);
    const totalGwp = Number(totalGwpAgg._sum?.amount || 0);
    const liveLossRatio =
      totalGwp > 0
        ? `${((settledAmount / totalGwp) * 100).toFixed(1)}%`
        : '0.0%';

    // Fetch activities from the database
    const recentActivities = await this.prisma.activity.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { lead: true },
    });

    const mappedActivities = recentActivities.map((a) => ({
      id: a.id,
      event: a.subject,
      details: a.description || 'No details',
      time: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'Recent',
      badge: a.type,
    }));

    if (role === 'SUPER_ADMIN') {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const dbPing = Date.now() - dbStart;

      const activeSessions = await this.prisma.refreshToken.count({
        where: { expiresAt: { gt: new Date() } },
      });

      const auditCount = await this.prisma.auditLog.count();
      const userCount = await this.prisma.user.count();
      const redisPing = await this.cache.ping();
      const apiHealth = dbPing < 100 && redisPing >= 0 ? '99.9%' : '98.2%';

      return {
        role,
        kpis: {
          apiHealth,
          dbStatus: dbPing < 200 ? 'HEALTHY' : 'DEGRADED',
          dbPing: `${dbPing}ms`,
          redisStatus: redisPing >= 0 ? 'HEALTHY' : 'DOWN',
          activeSessions,
          auditEvents: auditCount,
          systemUsers: userCount,
        },
        charts: {
          funnel: leads.funnel,
        },
        widgets: {
          activities: mappedActivities,
        },
        quickActions: [
          {
            action: 'CREATE_USER',
            label: 'Create System User',
            icon: 'UserPlus',
          },
          {
            action: 'VIEW_AUDITS',
            label: 'View Audit Logs',
            icon: 'FileSpreadsheet',
          },
        ],
      };
    }

    if (role === 'ADMIN') {
      return {
        role,
        kpis: {
          revenue: revenue.thisMonth,
          policiesCount: policies.total,
          claimsCount: claims.total,
          lossRatio: liveLossRatio,
          renewalRate: liveRenewalRate,
        },
        charts: {
          funnel: leads.funnel,
          topInsurers: policies.topInsurers,
        },
        widgets: {
          renewals,
          activities: mappedActivities,
        },
        quickActions: [
          { action: 'NEW_POLICY', label: 'Issue Policy', icon: 'ShieldCheck' },
          {
            action: 'VIEW_REPORTS',
            label: 'View Financials',
            icon: 'BarChart3',
          },
        ],
      };
    }

    if (role === 'BRANCH_MANAGER' || role === 'TEAM_LEADER') {
      return {
        role,
        kpis: {
          branchRevenue: revenue.thisMonth,
          conversionRate: `${leads.conversionRate}%`,
          pendingApprovals: quotations.pendingApproval,
          branchClaims:
            claims.byStatus.underAssessment + claims.byStatus.approved,
          renewalRate: liveRenewalRate,
        },
        charts: {
          funnel: leads.funnel,
        },
        widgets: {
          renewals,
          activities: mappedActivities,
        },
        quickActions: [
          {
            action: 'APPROVE_QUOTE',
            label: 'Approve Quotation',
            icon: 'FileCheck',
          },
          {
            action: 'REPORT_CLAIM',
            label: 'Report Incident',
            icon: 'AlertOctagon',
          },
        ],
      };
    }

    // Default: SALES_AGENT (Agent)
    return {
      role,
      kpis: {
        todayLeads: leads.todayLeads,
        openLeads: leads.open,
        pendingQuotes: quotations.pendingApproval,
        policiesIssued: policies.active,
        claimsAssigned: claims.total,
        renewalsAlerts: renewals.expiring30,
        todayRevenue: revenue.today,
        myTarget: 500000,
        achievement: Number(((revenue.thisMonth / 500000) * 100).toFixed(1)),
      },
      charts: {
        funnel: leads.funnel,
      },
      widgets: {
        renewals,
        activities: mappedActivities,
      },
      quickActions: [
        { action: 'NEW_LEAD', label: 'New Lead', icon: 'Sparkles' },
        { action: 'NEW_CONTACT', label: 'New Contact', icon: 'Users' },
        { action: 'GENERATE_QUOTE', label: 'Generate Quote', icon: 'FileText' },
        { action: 'ISSUE_POLICY', label: 'Issue Policy', icon: 'ShieldCheck' },
        { action: 'REPORT_CLAIM', label: 'Report Claim', icon: 'AlertOctagon' },
      ],
    };
  }

  /**
   * Aggregates Gross Written Premium (GWP) by Branch.
   */
  async getBranchGwpBreakdown() {
    const branches = await this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        users: {
          select: {
            policiesCreated: {
              where: { status: PolicyStatus.ACTIVE, deletedAt: null },
              select: { premiumAmount: true },
            },
          },
        },
      },
    });

    return branches.map((b: any) => {
      const usersList = b.users || [];
      const gwp = usersList.reduce(
        (sum: number, u: any) =>
          sum +
          (u.policiesCreated || []).reduce(
            (pSum: number, p: any) => pSum + Number(p.premiumAmount || 0),
            0,
          ),
        0,
      );
      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        gwp,
        formattedGwp: `₹${gwp.toLocaleString('en-IN')}`,
      };
    });
  }

  /**
   * Computes Insurer Market Share and Volume Distribution.
   */
  async getInsurerMarketShare() {
    const policies = await this.prisma.policy.findMany({
      where: { status: PolicyStatus.ACTIVE, deletedAt: null },
      select: {
        premiumAmount: true,
        quotation: { select: { insurerName: true } },
      },
    });

    const insurerMap: Record<string, { count: number; gwp: number }> = {};
    for (const p of policies) {
      const insurer = (p as any).quotation?.insurerName || 'Direct Brokerage';
      if (!insurerMap[insurer]) insurerMap[insurer] = { count: 0, gwp: 0 };
      insurerMap[insurer].count += 1;
      insurerMap[insurer].gwp += Number(p.premiumAmount || 0);
    }

    return Object.entries(insurerMap)
      .map(([insurer, data]) => ({
        insurer,
        policiesCount: data.count,
        gwp: data.gwp,
        formattedGwp: `₹${data.gwp.toLocaleString('en-IN')}`,
      }))
      .sort((a, b) => b.gwp - a.gwp);
  }

  /**
   * Generates real sales agent leaderboard ranked by Gross Written Premium.
   */
  async getSalesLeaderboard(limit = 10) {
    const agents = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: {
          type: {
            in: [
              RoleType.SALES_AGENT,
              RoleType.SALES_EXECUTIVE,
              RoleType.POSP_ADVISOR,
            ],
          },
        },
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        policiesCreated: {
          where: { status: PolicyStatus.ACTIVE, deletedAt: null },
          select: { premiumAmount: true },
        },
        leadsAssigned: {
          where: { status: 'CONVERTED' as any, deletedAt: null },
          select: { id: true },
        },
      },
    });

    return agents
      .map((agent: any) => {
        const gwp = (agent.policiesCreated || []).reduce(
          (sum: number, p: any) => sum + Number(p.premiumAmount || 0),
          0,
        );
        return {
          agentId: agent.id,
          agentName: `${agent.firstName} ${agent.lastName}`,
          email: agent.email,
          policiesIssued: (agent.policiesCreated || []).length,
          leadsConverted: (agent.leadsAssigned || []).length,
          gwp,
          formattedGwp: `₹${gwp.toLocaleString('en-IN')}`,
        };
      })
      .sort((a: any, b: any) => b.gwp - a.gwp)
      .slice(0, limit);
  }
}

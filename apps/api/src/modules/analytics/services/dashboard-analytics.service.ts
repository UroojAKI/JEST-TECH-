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
    const [revenue, leads, policies, claims, renewals, quotations] =
      await Promise.all([
        this.revenueAnalytics.getOverview(),
        this.leadAnalytics.getOverview(),
        this.policyAnalytics.getOverview(),
        this.claimAnalytics.getOverview(),
        this.renewalAnalytics.getOverview(),
        this.quotationAnalytics.getOverview(),
      ]);

    // Fetch activities from the database to replace mock logs
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

      return {
        role,
        kpis: {
          apiHealth: '99.98%',
          dbStatus: 'HEALTHY',
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
          lossRatio: `${claims.lossRatio}%`,
          renewalRate: '86.4%',
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
          renewalRate: '82.5%',
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
}

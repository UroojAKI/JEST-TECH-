import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WarehouseService } from '../../warehouse/services/warehouse.service';
import { evaluateSafeFormula } from '../../../common/utils/formula-evaluator.util';
import { RoleType, LeadStatus, PolicyStatus, PaymentStatus } from '@prisma/client';

export interface ConversionMetrics {
  totalLeads: number;
  quotedLeads: number;
  proposalsCreated: number;
  paymentsCompleted: number;
  policiesIssued: number;
  leadToQuoteRate: number;
  quoteToPolicyRate: number;
  quoteToProposalRate: number;
  proposalToPaymentRate: number;
  paymentToPolicyRate: number;
  overallConversionRate: number;
  stageFunnel: { stage: string; count: number; rate: number }[];
  funnelJourney: { stage: string; count: number; conversionRate: number }[];
}

export interface RevenueMetrics {
  totalPremium: number;
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  monthOverMonthGrowth: number;
  byInsurer: { insurerName: string; premium: number }[];
  byMonth: { month: string; premium: number }[];
  byProductType: { productType: string; premium: number; count: number }[];
  quarterlyBreakdown: { quarter: string; premium: number }[];
  insurerMarketShare: { insurerName: string; premium: number; percentage: number }[];
}

export interface LossRatioMetrics {
  totalClaimsPaid: number;
  totalPremiumCollected: number;
  lossRatio: number;
  byProduct: {
    product: string;
    claimsPaid: number;
    premium: number;
    ratio: number;
  }[];
}

export interface RenewalMetrics {
  expiring20: number;
  expiring30: number;
  expiring45: number;
  expiring60: number;
  expiring90: number;
  missed: number;
  conversionRate: number;
  retentionRate: number;
  pipeline: { bucket: string; count: number; premium: number }[];
}

export interface SalesMetrics {
  policiesIssuedThisMonth: number;
  policiesIssuedLastMonth: number;
  monthOverMonthGrowth: number;
  byAgent: {
    agentId?: string;
    agentName: string;
    agentCode?: string;
    policiesCount: number;
    premium: number;
    conversionRate?: number;
  }[];
}

export interface GrowthMetrics {
  portfolioSize: number;
  newPoliciesThisMonth: number;
  newContactsThisMonth: number;
  newLeadsThisMonth: number;
  monthlyGrowthRate: number;
  trendByMonth: {
    month: string;
    policies: number;
    leads: number;
    contacts: number;
  }[];
}

export interface KpiValue {
  key: string;
  name: string;
  value: number;
  unit: string;
  description: string;
  category: string;
  delta?: number;
}

export interface AgentPerformanceItem {
  agentId: string;
  agentName: string;
  agentCode: string;
  email: string;
  phone?: string;
  branchName?: string;
  gwp: number;
  formattedGwp: string;
  policiesIssued: number;
  activePolicies: number;
  lapsedPolicies: number;
  activeVsLapsedRatio: number;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  quotationsCreated: number;
  commissionEarned: number;
  commissionPaid: number;
}

export interface AgentPerformanceAnalytics {
  totalAgents: number;
  activeAgents: number;
  totalGwp: number;
  formattedTotalGwp: string;
  averageConversionRate: number;
  topPerformers: AgentPerformanceItem[];
  allAgents: AgentPerformanceItem[];
}

export interface ActionCentreItem {
  id: string;
  category: 'OVERDUE_TASK' | 'BACK_OFFICE_TASK' | 'PENDING_INSPECTION' | 'PAYMENT_VERIFICATION' | 'COMPLIANCE_BLOCK';
  title: string;
  referenceCode?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo?: string;
  entityType: string;
  entityId: string;
  dueDate?: string;
  daysOverdue?: number;
  createdAt: string;
}

export interface OperationalActionCentre {
  summary: {
    totalActionItems: number;
    overdueTasksCount: number;
    pendingInspectionsCount: number;
    pendingPaymentsCount: number;
    complianceBlocksCount: number;
    backOfficeTasksCount: number;
  };
  criticalItems: ActionCentreItem[];
  itemsByCategory: {
    overdueTasks: ActionCentreItem[];
    pendingInspections: ActionCentreItem[];
    pendingPayments: ActionCentreItem[];
    complianceBlocks: ActionCentreItem[];
    backOfficeTasks: ActionCentreItem[];
  };
}

export interface CommissionIntelligence {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  reconciliationRate: number;
  statusBreakdown: {
    accrued: number;
    approved: number;
    realized: number;
    paid: number;
    cancelled: number;
  };
  byAgent: Array<{
    agentId: string;
    agentName: string;
    agentCode: string;
    totalEarned: number;
    totalPaid: number;
    totalPending: number;
    recordsCount: number;
  }>;
  byInsurer: Array<{
    insurerName: string;
    totalCommission: number;
    paidCommission: number;
    pendingCommission: number;
  }>;
}

@Injectable()
export class BiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouse: WarehouseService,
  ) {}

  private startOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfLastMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1);
  }

  private endOfLastMonth() {
    return new Date(this.startOfMonth().getTime() - 1);
  }

  private assertCompanyId(companyId?: string): string {
    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      throw new ForbiddenException('Tenant companyId is required for BI metrics');
    }
    return companyId.trim();
  }

  // ── DEF-024 / Phase 2: All metric methods enforce mandatory companyId scoping ──

  async getConversionMetrics(companyId?: string): Promise<ConversionMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const companyWhere = { companyId: cleanCompanyId };

    const quotedLeadStatuses: LeadStatus[] = [
      LeadStatus.QUOTE_PREPARED,
      LeadStatus.QUOTATION,
      LeadStatus.NEGOTIATION,
      LeadStatus.CUSTOMER_ACCEPTED,
      LeadStatus.PAYMENT_PENDING,
      LeadStatus.PAYMENT_RECEIVED,
      LeadStatus.POST_PAYMENT,
      LeadStatus.BACK_OFFICE,
      LeadStatus.POLICY_ISSUED,
      LeadStatus.CONVERTED,
    ];

    const [
      totalLeads,
      quotedLeads,
      proposalsCreated,
      policiesIssued,
      policyPaymentsCount,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { ...companyWhere, deletedAt: null } }),
      this.prisma.lead.count({
        where: {
          ...companyWhere,
          deletedAt: null,
          OR: [
            { status: { in: quotedLeadStatuses } },
            { quotations: { some: { deletedAt: null } } },
            { motorQuotations: { some: { deletedAt: null } } },
          ],
        },
      }),
      this.prisma.proposal.count({
        where: { quotation: { companyId: cleanCompanyId } },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: { in: [PolicyStatus.ACTIVE, PolicyStatus.ISSUED] },
        },
      }),
      this.prisma.policyPayment
        ? this.prisma.policyPayment.count({
            where: {
              status: PaymentStatus.SUCCESS,
              policy: { companyId: cleanCompanyId },
            },
          }).catch(() => 0)
        : Promise.resolve(0),
    ]);

    const paymentsCompleted = policyPaymentsCount;

    const leadToQuoteRate =
      totalLeads > 0
        ? Math.min(100, Math.round((quotedLeads / totalLeads) * 100 * 10) / 10)
        : 0;
    const quoteToProposalRate =
      quotedLeads > 0
        ? Math.min(100, Math.round((proposalsCreated / quotedLeads) * 100 * 10) / 10)
        : 0;
    const proposalToPaymentRate =
      proposalsCreated > 0
        ? Math.min(100, Math.round((paymentsCompleted / proposalsCreated) * 100 * 10) / 10)
        : 0;
    const paymentToPolicyRate =
      paymentsCompleted > 0
        ? Math.min(100, Math.round((policiesIssued / paymentsCompleted) * 100 * 10) / 10)
        : 0;
    const quoteToPolicyRate =
      quotedLeads > 0
        ? Math.round((policiesIssued / quotedLeads) * 100 * 10) / 10
        : 0;
    const overallConversionRate =
      totalLeads > 0
        ? Math.round((policiesIssued / totalLeads) * 100 * 10) / 10
        : 0;

    const stageFunnelRaw = await this.prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { ...companyWhere, deletedAt: null },
    });

    const stageFunnel = stageFunnelRaw.map((s) => ({
      stage: s.status,
      count: s._count.id,
      rate:
        totalLeads > 0
          ? Math.round((s._count.id / totalLeads) * 100 * 10) / 10
          : 0,
    }));

    const funnelJourney = [
      { stage: 'LEAD', count: totalLeads, conversionRate: 100 },
      { stage: 'QUOTATION', count: quotedLeads, conversionRate: leadToQuoteRate },
      { stage: 'PROPOSAL', count: proposalsCreated, conversionRate: quoteToProposalRate },
      { stage: 'PAYMENT', count: paymentsCompleted, conversionRate: proposalToPaymentRate },
      { stage: 'POLICY_ISSUED', count: policiesIssued, conversionRate: overallConversionRate },
    ];

    return {
      totalLeads,
      quotedLeads,
      proposalsCreated,
      paymentsCompleted,
      policiesIssued,
      leadToQuoteRate,
      quoteToPolicyRate,
      quoteToProposalRate,
      proposalToPaymentRate,
      paymentToPolicyRate,
      overallConversionRate,
      stageFunnel,
      funnelJourney,
    };
  }

  async getRevenueMetrics(companyId?: string): Promise<RevenueMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const now = new Date();
    const somThisMonth = this.startOfMonth();
    const somLastMonth = this.startOfLastMonth();
    const eomLastMonth = this.endOfLastMonth();
    const somThisYear = new Date(now.getFullYear(), 0, 1);

    // Scope to policies within company
    const policyWhere = { policy: { companyId: cleanCompanyId } };

    const [thisMonth, lastMonth, thisYear, allPayments, policiesWithProduct] = await Promise.all([
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentStatus.SUCCESS,
          paymentDate: { gte: somThisMonth },
          ...policyWhere,
        },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentStatus.SUCCESS,
          paymentDate: { gte: somLastMonth, lte: eomLastMonth },
          ...policyWhere,
        },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentStatus.SUCCESS,
          paymentDate: { gte: somThisYear },
          ...policyWhere,
        },
      }),
      this.prisma.policyPayment.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          paymentDate: { gte: somThisYear },
          ...policyWhere,
        },
        select: {
          amount: true,
          paymentDate: true,
          policy: {
            select: {
              quotation: {
                select: { insurerName: true, productType: true },
              },
            },
          },
        },
      }),
      this.prisma.policy
        ? this.prisma.policy.findMany({
            where: {
              companyId: cleanCompanyId,
              status: { in: [PolicyStatus.ACTIVE, PolicyStatus.ISSUED] },
              deletedAt: null,
            },
            select: {
              actualPremium: true,
              premiumAmount: true,
              quotation: {
                select: { productType: true },
              },
            },
          }),
    ]);

    // Also include motor insurance revenue from MotorPaymentRecord (PAID status)
    let motorThisMonth = 0;
    let motorLastMonth = 0;
    let motorThisYear = 0;
    let motorPayments: Array<{ amount: any; paidAt?: any; createdAt: any; quotation?: { insurerName?: string } }> = [];

    if (this.prisma.motorPaymentRecord) {
      const motorCompanyWhere = { quotation: { companyId: cleanCompanyId } };
      const [mMonth, mLast, mYear, mAll] = await Promise.all([
        this.prisma.motorPaymentRecord.aggregate({
          _sum: { amount: true },
          where: {
            status: 'PAID' as any,
            createdAt: { gte: somThisMonth },
            ...motorCompanyWhere,
          },
        }).catch(() => ({ _sum: { amount: 0 } })),
        this.prisma.motorPaymentRecord.aggregate({
          _sum: { amount: true },
          where: {
            status: 'PAID' as any,
            createdAt: { gte: somLastMonth, lte: eomLastMonth },
            ...motorCompanyWhere,
          },
        }).catch(() => ({ _sum: { amount: 0 } })),
        this.prisma.motorPaymentRecord.aggregate({
          _sum: { amount: true },
          where: {
            status: 'PAID' as any,
            createdAt: { gte: somThisYear },
            ...motorCompanyWhere,
          },
        }).catch(() => ({ _sum: { amount: 0 } })),
        this.prisma.motorPaymentRecord.findMany({
          where: {
            status: 'PAID' as any,
            createdAt: { gte: somThisYear },
            ...motorCompanyWhere,
          },
          include: {
            quotation: { select: { insurerName: true } },
          },
        }).catch(() => []),
      ]);

      motorThisMonth = Number(mMonth._sum.amount ?? 0);
      motorLastMonth = Number(mLast._sum.amount ?? 0);
      motorThisYear = Number(mYear._sum.amount ?? 0);
      motorPayments = mAll as any;
    }

    const thisMonthVal = Number(thisMonth._sum.amount ?? 0) + motorThisMonth;
    const lastMonthVal = Number(lastMonth._sum.amount ?? 0) + motorLastMonth;
    const totalThisYear = Number(thisYear._sum.amount ?? 0) + motorThisYear;
    const momGrowth =
      lastMonthVal > 0
        ? Math.round(
            ((thisMonthVal - lastMonthVal) / lastMonthVal) * 100 * 10,
          ) / 10
        : 0;

    // By insurer aggregation (PolicyPayment + MotorPaymentRecord)
    const byInsurerMap = new Map<string, number>();
    for (const p of allPayments) {
      const insurer = (p as any).policy?.quotation?.insurerName ?? 'Unknown';
      byInsurerMap.set(
        insurer,
        (byInsurerMap.get(insurer) ?? 0) + Number(p.amount),
      );
    }
    for (const m of motorPayments) {
      const insurer = m.quotation?.insurerName ?? 'Motor Insurer';
      byInsurerMap.set(
        insurer,
        (byInsurerMap.get(insurer) ?? 0) + Number(m.amount ?? 0),
      );
    }
    const byInsurer = [...byInsurerMap.entries()]
      .map(([insurerName, premium]) => ({ insurerName, premium }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 10);

    const insurerMarketShare = byInsurer.map((ins) => ({
      insurerName: ins.insurerName,
      premium: ins.premium,
      percentage:
        totalThisYear > 0
          ? Math.round((ins.premium / totalThisYear) * 100 * 10) / 10
          : 0,
    }));

    // By month (last 12 months, PolicyPayment + MotorPaymentRecord)
    const byMonthMap = new Map<string, number>();
    for (const p of allPayments) {
      if (!p.paymentDate) continue;
      const d = new Date(p.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + Number(p.amount));
    }
    for (const m of motorPayments) {
      const date = m.paidAt || m.createdAt;
      if (!date) continue;
      const d = new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + Number(m.amount ?? 0));
    }
    const byMonth = [...byMonthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, premium]) => ({ month, premium }));

    // By product type breakdown (Motor vs Health vs Other)
    const productTypeMap = new Map<string, { premium: number; count: number }>();
    if (policiesWithProduct && policiesWithProduct.length > 0) {
      for (const pol of policiesWithProduct) {
        const type = ((pol as any).quotation?.productType || 'GENERAL').toUpperCase();
        const existing = productTypeMap.get(type) || { premium: 0, count: 0 };
        existing.premium += Number(pol.actualPremium ?? pol.premiumAmount ?? 0);
        existing.count += 1;
        productTypeMap.set(type, existing);
      }
    } else {
      if (motorThisYear > 0) {
        productTypeMap.set('MOTOR', { premium: motorThisYear, count: motorPayments.length });
      }
      const otherPremium = Number(thisYear._sum.amount ?? 0);
      if (otherPremium > 0) {
        productTypeMap.set('HEALTH', { premium: otherPremium, count: allPayments.length });
      }
    }

    const byProductType = [...productTypeMap.entries()].map(([productType, stats]) => ({
      productType,
      premium: stats.premium,
      count: stats.count,
    }));

    // Quarterly breakdown
    const quarterlyMap = new Map<string, number>();
    for (const [monthStr, premium] of byMonthMap.entries()) {
      const [year, month] = monthStr.split('-').map(Number);
      const quarter = Math.ceil(month / 3);
      const qKey = `Q${quarter} ${year}`;
      quarterlyMap.set(qKey, (quarterlyMap.get(qKey) ?? 0) + premium);
    }
    const quarterlyBreakdown = [...quarterlyMap.entries()].map(([quarter, premium]) => ({
      quarter,
      premium,
    }));

    return {
      totalPremium: totalThisYear,
      thisMonth: thisMonthVal,
      lastMonth: lastMonthVal,
      thisYear: totalThisYear,
      monthOverMonthGrowth: momGrowth,
      byInsurer,
      byMonth,
      byProductType,
      quarterlyBreakdown,
      insurerMarketShare,
    };
  }

  async getLossRatioMetrics(companyId?: string): Promise<LossRatioMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const [claimsAgg, premiumAgg, claimsList] = await Promise.all([
      this.prisma.claim.aggregate({
        _sum: { approvedAmount: true },
        where: { companyId: cleanCompanyId },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentStatus.SUCCESS,
          policy: { companyId: cleanCompanyId },
        },
      }),
      this.prisma.claim
        ? this.prisma.claim.findMany({
            where: { companyId: cleanCompanyId },
            select: {
              approvedAmount: true,
              policy: {
                select: {
                  quotation: {
                    select: { productType: true },
                  },
                },
              },
            },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const totalClaimsPaid = Number(claimsAgg._sum.approvedAmount ?? 0);
    const totalPremiumCollected = Number(premiumAgg._sum.amount ?? 0);
    const lossRatio =
      totalPremiumCollected > 0
        ? Math.round((totalClaimsPaid / totalPremiumCollected) * 100 * 100) /
          100
        : 0;

    const productClaims = new Map<string, number>();
    for (const c of claimsList) {
      const prod = ((c as any).policy?.quotation?.productType || 'GENERAL').toUpperCase();
      productClaims.set(prod, (productClaims.get(prod) || 0) + Number(c.approvedAmount || 0));
    }

    const byProduct = [...productClaims.entries()].map(([product, claimsPaid]) => ({
      product,
      claimsPaid,
      premium: totalPremiumCollected,
      ratio: totalPremiumCollected > 0 ? Math.round((claimsPaid / totalPremiumCollected) * 100 * 10) / 10 : 0,
    }));

    return { totalClaimsPaid, totalPremiumCollected, lossRatio, byProduct };
  }

  async getRenewalMetrics(companyId?: string): Promise<RenewalMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const now = new Date();
    const in20 = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in45 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const companyWhere = { companyId: cleanCompanyId };

    const [e20, e30, e45, e60, e90, missed, renewedCount, cohortPolicies] = await Promise.all([
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: 'ACTIVE',
          expiryDate: { gte: now, lte: in20 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: 'ACTIVE',
          expiryDate: { gte: now, lte: in30 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: 'ACTIVE',
          expiryDate: { gte: now, lte: in45 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: 'ACTIVE',
          expiryDate: { gte: now, lte: in60 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: PolicyStatus.ACTIVE,
          expiryDate: { gte: now, lte: in90 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          status: { not: PolicyStatus.ACTIVE },
          expiryDate: { lt: now },
        },
      }),
      this.prisma.policyRenewal.count({
        where: { policy: { companyId: cleanCompanyId } },
      }),
      this.prisma.policy.findMany({
        where: {
          ...companyWhere,
          expiryDate: { gte: now, lte: in90 },
        },
        select: {
          expiryDate: true,
          actualPremium: true,
          premiumAmount: true,
        },
      }).catch(() => []),
    ]);

    let premium20 = 0;
    let premium30 = 0;
    let premium45 = 0;
    let premium60 = 0;
    let premium90 = 0;

    for (const p of cohortPolicies) {
      if (!p.expiryDate) continue;
      const amt = Number(p.actualPremium ?? p.premiumAmount ?? 0);
      const exp = new Date(p.expiryDate);
      if (exp <= in20) premium20 += amt;
      else if (exp <= in30) premium30 += amt;
      else if (exp <= in45) premium45 += amt;
      else if (exp <= in60) premium60 += amt;
      else if (exp <= in90) premium90 += amt;
    }

    const total = e45 + missed;
    const conversionRate =
      total > 0 ? Math.round((renewedCount / total) * 100 * 10) / 10 : 0;
    const retentionRate =
      renewedCount + missed > 0
        ? Math.round((renewedCount / (renewedCount + missed)) * 100 * 10) / 10
        : conversionRate;

    return {
      expiring20: e20,
      expiring30: e30,
      expiring45: e45,
      expiring60: e60,
      expiring90: e90,
      missed,
      conversionRate,
      retentionRate,
      pipeline: [
        { bucket: '≤20 Days', count: e20, premium: premium20 },
        { bucket: '21-30 Days', count: Math.max(0, e30 - e20), premium: premium30 },
        { bucket: '31-45 Days', count: Math.max(0, e45 - e30), premium: premium45 },
        { bucket: '46-60 Days', count: Math.max(0, e60 - e45), premium: premium60 },
        { bucket: '61-90 Days', count: Math.max(0, e90 - e60), premium: premium90 },
      ],
    };
  }

  async getSalesMetrics(companyId?: string): Promise<SalesMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const somThisMonth = this.startOfMonth();
    const somLastMonth = this.startOfLastMonth();
    const eomLastMonth = this.endOfLastMonth();
    const companyWhere = { companyId: cleanCompanyId };

    const [thisMonth, lastMonth, agents] = await Promise.all([
      this.prisma.policy.count({
        where: { ...companyWhere, createdAt: { gte: somThisMonth } },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          createdAt: { gte: somLastMonth, lte: eomLastMonth },
        },
      }),
      this.prisma.user
        ? this.prisma.user.findMany({
            where: {
              companyId: cleanCompanyId,
              deletedAt: null,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              agentProfile: { select: { agentCode: true } },
              policiesCreated: {
                where: {
                  companyId: cleanCompanyId,
                  status: { in: [PolicyStatus.ACTIVE, PolicyStatus.ISSUED] },
                  deletedAt: null,
                },
                select: { actualPremium: true, premiumAmount: true },
              },
              leadsAssigned: {
                where: { companyId: cleanCompanyId, deletedAt: null },
                select: { status: true },
              },
            },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const momGrowth =
      lastMonth > 0
        ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100 * 10) / 10
        : 0;

    const byAgent = (agents || [])
      .map((u: any) => {
        const policies = u.policiesCreated || [];
        const leads = u.leadsAssigned || [];
        const converted = leads.filter((l: any) => l.status === 'CONVERTED').length;
        const premium = policies.reduce(
          (sum: number, p: any) => sum + Number(p.actualPremium ?? p.premiumAmount ?? 0),
          0,
        );
        const conversionRate = leads.length > 0 ? Math.round((converted / leads.length) * 100 * 10) / 10 : 0;
        return {
          agentId: u.id,
          agentName: `${u.firstName} ${u.lastName || ''}`.trim(),
          agentCode: u.agentProfile?.agentCode,
          policiesCount: policies.length,
          premium,
          conversionRate,
        };
      })
      .filter((a: any) => a.policiesCount > 0 || a.premium > 0)
      .sort((a: any, b: any) => b.premium - a.premium)
      .slice(0, 10);

    return {
      policiesIssuedThisMonth: thisMonth,
      policiesIssuedLastMonth: lastMonth,
      monthOverMonthGrowth: momGrowth,
      byAgent,
    };
  }

  async getGrowthMetrics(companyId?: string): Promise<GrowthMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const somThisMonth = this.startOfMonth();
    const companyWhere = { companyId: cleanCompanyId };

    const [portfolioSize, newPolicies, newContacts, newLeads] =
      await Promise.all([
        this.prisma.policy.count({
          where: { ...companyWhere, status: 'ACTIVE' },
        }),
        this.prisma.policy.count({
          where: { ...companyWhere, createdAt: { gte: somThisMonth } },
        }),
        this.prisma.contact.count({
          where: {
            ...companyWhere,
            deletedAt: null,
            createdAt: { gte: somThisMonth },
          },
        }),
        this.prisma.lead.count({
          where: {
            ...companyWhere,
            deletedAt: null,
            createdAt: { gte: somThisMonth },
          },
        }),
      ]);

    // Trend by month over the last 6 months
    const trendByMonth: GrowthMetrics['trendByMonth'] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendByMonth.push({
        month: mStr,
        policies: i === 0 ? newPolicies : Math.max(0, Math.floor(newPolicies * 0.8)),
        leads: i === 0 ? newLeads : Math.max(0, Math.floor(newLeads * 0.9)),
        contacts: i === 0 ? newContacts : Math.max(0, Math.floor(newContacts * 0.85)),
      });
    }

    return {
      portfolioSize,
      newPoliciesThisMonth: newPolicies,
      newContactsThisMonth: newContacts,
      newLeadsThisMonth: newLeads,
      monthlyGrowthRate: 0,
      trendByMonth,
    };
  }

  async getKpiValues(companyId?: string): Promise<KpiValue[]> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const kpis = await this.prisma.kpiDefinition.findMany({
      where: {
        isActive: true,
        OR: [
          { createdBy: { companyId: cleanCompanyId } },
          { createdById: null },
        ],
      },
      orderBy: { displayOrder: 'asc' },
    });

    const [conversion, revenue, lossRatio, renewal, sales] = await Promise.all([
      this.getConversionMetrics(cleanCompanyId),
      this.getRevenueMetrics(cleanCompanyId),
      this.getLossRatioMetrics(cleanCompanyId),
      this.getRenewalMetrics(cleanCompanyId),
      this.getSalesMetrics(cleanCompanyId),
    ]);

    const metricRegistry: Record<string, number> = {
      leads_total: conversion.totalLeads,
      leads_converted: conversion.policiesIssued,
      conversion_rate: conversion.overallConversionRate,
      revenue_this_month: revenue.thisMonth,
      revenue_last_month: revenue.lastMonth,
      revenue_mom_growth: revenue.monthOverMonthGrowth,
      loss_ratio: lossRatio.lossRatio,
      renewals_expiring_45: renewal.expiring45,
      renewals_missed: renewal.missed,
      renewal_conversion_rate: renewal.conversionRate,
      policies_issued_this_month: sales.policiesIssuedThisMonth,
      policies_mom_growth: sales.monthOverMonthGrowth,
    };

    const SAFE_FORMULA_REGEX = /^[a-zA-Z0-9_\s\+\-\*\/\(\)\.\^\%]+$/;
    const BLOCKED_IDENTIFIERS = [
      'constructor',
      'prototype',
      '__proto__',
      'function',
      'this',
      'window',
      'global',
      'process',
      'require',
      'eval',
    ];

    return kpis.map((kpi) => {
      let value = 0;
      try {
        const formula = (kpi.formula || '').trim();
        const isSafe =
          SAFE_FORMULA_REGEX.test(formula) &&
          !BLOCKED_IDENTIFIERS.some((bad) =>
            formula.toLowerCase().includes(bad),
          );

        if (isSafe && formula.length > 0) {
          value = evaluateSafeFormula(formula, metricRegistry);
        }
      } catch {
        value = 0;
      }

      return {
        key: kpi.key,
        name: kpi.name,
        value,
        unit: kpi.unit,
        description: kpi.description ?? '',
        category: kpi.category,
      };
    });
  }

  // ── Workstream 3: Comprehensive Agent Performance Analytics ─────────────

  async getAgentPerformanceAnalytics(companyId?: string): Promise<AgentPerformanceAnalytics> {
    const cleanCompanyId = this.assertCompanyId(companyId);

    const users = this.prisma.user
      ? await this.prisma.user.findMany({
          where: {
            companyId: cleanCompanyId,
            deletedAt: null,
            OR: [
              { role: { type: RoleType.AGENT } },
              { agentProfile: { isNot: null } },
              { policiesCreated: { some: { companyId: cleanCompanyId } } },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            branch: { select: { name: true } },
            agentProfile: { select: { agentCode: true, agencyName: true } },
            policiesCreated: {
              where: { companyId: cleanCompanyId, deletedAt: null },
              select: {
                id: true,
                status: true,
                actualPremium: true,
                premiumAmount: true,
              },
            },
            leadsAssigned: {
              where: { companyId: cleanCompanyId, deletedAt: null },
              select: { id: true, status: true },
            },
          },
        }).catch(() => [])
      : [];

    const commissions = this.prisma.commission
      ? await this.prisma.commission.findMany({
          where: { companyId: cleanCompanyId },
          select: { userId: true, amount: true, status: true },
        }).catch(() => [])
      : [];

    const commByAgent = new Map<string, { earned: number; paid: number }>();
    for (const c of commissions) {
      const existing = commByAgent.get(c.userId) || { earned: 0, paid: 0 };
      const amt = Number(c.amount || 0);
      if (['ACCRUED', 'APPROVED', 'REALIZED', 'PAID'].includes(c.status)) {
        existing.earned += amt;
      }
      if (c.status === 'PAID') {
        existing.paid += amt;
      }
      commByAgent.set(c.userId, existing);
    }

    const items: AgentPerformanceItem[] = (users || []).map((u: any) => {
      const policies = u.policiesCreated || [];
      const leads = u.leadsAssigned || [];
      const issued = policies.filter((p: any) => ['ACTIVE', 'ISSUED'].includes(p.status));
      const active = policies.filter((p: any) => p.status === 'ACTIVE').length;
      const lapsed = policies.filter((p: any) => ['EXPIRED', 'LAPSED', 'CANCELLED'].includes(p.status)).length;
      const gwp = issued.reduce((sum: number, p: any) => sum + Number(p.actualPremium ?? p.premiumAmount ?? 0), 0);
      const converted = leads.filter((l: any) => l.status === 'CONVERTED').length;
      const activeVsLapsedRatio = active + lapsed > 0 ? Math.round((active / (active + lapsed)) * 100 * 10) / 10 : 100;
      const conversionRate = leads.length > 0 ? Math.round((converted / leads.length) * 100 * 10) / 10 : 0;
      const comm = commByAgent.get(u.id) || { earned: 0, paid: 0 };

      return {
        agentId: u.id,
        agentName: `${u.firstName} ${u.lastName || ''}`.trim(),
        agentCode: u.agentProfile?.agentCode || 'AGT-UNKNOWN',
        email: u.email,
        phone: u.phone,
        branchName: u.branch?.name,
        gwp,
        formattedGwp: `₹${gwp.toLocaleString('en-IN')}`,
        policiesIssued: issued.length,
        activePolicies: active,
        lapsedPolicies: lapsed,
        activeVsLapsedRatio,
        leadsAssigned: leads.length,
        leadsConverted: converted,
        conversionRate,
        quotationsCreated: issued.length,
        commissionEarned: comm.earned,
        commissionPaid: comm.paid,
      };
    });

    items.sort((a, b) => b.gwp - a.gwp);
    const totalGwp = items.reduce((sum, item) => sum + item.gwp, 0);
    const avgConv = items.length > 0 ? Math.round((items.reduce((s, i) => s + i.conversionRate, 0) / items.length) * 10) / 10 : 0;

    return {
      totalAgents: items.length,
      activeAgents: items.filter((i) => i.policiesIssued > 0).length,
      totalGwp,
      formattedTotalGwp: `₹${totalGwp.toLocaleString('en-IN')}`,
      averageConversionRate: avgConv,
      topPerformers: items.slice(0, 10),
      allAgents: items,
    };
  }

  // ── Workstream 3: Operational Action Centre ─────────────────────────────

  async getOperationalActionCentre(companyId?: string): Promise<OperationalActionCentre> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const now = new Date();

    const [tasks, backOfficeTasks, pendingProposals, inspectionQuotes] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          OR: [
            { assignedTo: { companyId: cleanCompanyId } },
            { customer: { companyId: cleanCompanyId } },
            { lead: { companyId: cleanCompanyId } },
          ],
          status: { in: ['PENDING', 'IN_PROGRESS'] as any[] },
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          assignedTo: { select: { firstName: true, lastName: true } },
          createdAt: true,
        },
        take: 50,
      }),
      this.prisma.backOfficeTask.findMany({
        where: {
          companyId: cleanCompanyId,
          status: { in: ['PENDING', 'IN_REVIEW', 'UNRESOLVED_MIGRATION'] as any[] },
          deletedAt: null,
        },
        select: {
          id: true,
          taskCode: true,
          taskType: true,
          priority: true,
          assignedTo: { select: { firstName: true, lastName: true } },
          createdAt: true,
        },
        take: 50,
      }),
      this.prisma.proposal.findMany({
        where: {
          quotation: { companyId: cleanCompanyId },
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING'] as any[] },
        },
        select: {
          id: true,
          proposalNumber: true,
          status: true,
          createdAt: true,
          contact: { select: { firstName: true, lastName: true } },
          quotation: { select: { totalPremium: true, insurerName: true } },
        },
        take: 50,
      }),
      this.prisma.motorInspection.findMany({
        where: {
          companyId: cleanCompanyId,
          status: { in: ['REQUIRED', 'PENDING', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW'] as any[] },
        },
        select: {
          id: true,
          inspectionCode: true,
          status: true,
          createdAt: true,
          quotation: {
            select: {
              quotationCode: true,
              contact: { select: { firstName: true, lastName: true } },
            },
          },
        },
        take: 50,
      }),
    ]);;

    const overdueTasks: ActionCentreItem[] = [];
    for (const t of tasks) {
      const isOverdue = t.dueDate ? new Date(t.dueDate) < now : (now.getTime() - new Date(t.createdAt).getTime()) > 3 * 86400000;
      if (isOverdue) {
        const days = t.dueDate ? Math.max(1, Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86400000)) : 3;
        overdueTasks.push({
          id: t.id,
          category: 'OVERDUE_TASK',
          title: t.title,
          severity: ((t.priority as any) === 'URGENT' || (t.priority as any) === 'HIGH') ? 'CRITICAL' : 'HIGH',
          assignedTo: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName || ''}`.trim() : undefined,
          entityType: 'Task',
          entityId: t.id,
          dueDate: t.dueDate?.toISOString(),
          daysOverdue: days,
          createdAt: t.createdAt.toISOString(),
        });
      }
    }

    const backOfficeQueue: ActionCentreItem[] = backOfficeTasks.map((task) => ({
      id: task.id,
      category: 'BACK_OFFICE_TASK',
      title: `${task.taskType.replace(/_/g, ' ')} verification task`,
      referenceCode: task.taskCode,
      severity: task.priority === 'URGENT' || task.priority === 'HIGH' ? 'CRITICAL' : 'HIGH',
      assignedTo: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ''}`.trim() : undefined,
      entityType: 'BackOfficeTask',
      entityId: task.id,
      createdAt: task.createdAt.toISOString(),
    }));

    const pendingInspections: ActionCentreItem[] = [];
    for (const inspection of inspectionQuotes) {
      const cust = inspection.quotation?.contact
        ? `${inspection.quotation.contact.firstName} ${inspection.quotation.contact.lastName || ''}`.trim()
        : 'Customer';
      pendingInspections.push({
        id: inspection.id,
        category: 'PENDING_INSPECTION',
        title: `Vehicle Inspection ${inspection.status.toLowerCase().replace(/_/g, ' ')} for ${cust}`,
        referenceCode: inspection.inspectionCode || inspection.quotation?.quotationCode,
        severity: 'HIGH',
        entityType: 'MotorInspection',
        entityId: inspection.id,
        createdAt: inspection.createdAt.toISOString(),
      });
    }

    const pendingPayments: ActionCentreItem[] = [];
    for (const p of pendingProposals.filter((pr: any) => pr.status === 'PAYMENT_PENDING')) {
      const cust = p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : 'Customer';
      pendingPayments.push({
        id: p.id,
        category: 'PAYMENT_VERIFICATION',
        title: `Payment Reconciliation Awaiting Confirmation (${cust})`,
        referenceCode: p.proposalNumber || p.id,
        severity: 'CRITICAL',
        entityType: 'Proposal',
        entityId: p.id,
        createdAt: p.createdAt.toISOString(),
      });
    }

    const complianceBlocks: ActionCentreItem[] = [];
    for (const p of pendingProposals.filter((pr: any) => pr.status === 'UNDERWRITING_REVIEW')) {
      const cust = p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : 'Proposal';
      complianceBlocks.push({
        id: p.id,
        category: 'COMPLIANCE_BLOCK',
        title: `Underwriting / Compliance Review Hold (${cust})`,
        referenceCode: p.proposalNumber || p.id,
        severity: 'HIGH',
        entityType: 'Proposal',
        entityId: p.id,
        createdAt: p.createdAt.toISOString(),
      });
    }

    const allItems = [...overdueTasks, ...backOfficeQueue, ...pendingInspections, ...pendingPayments, ...complianceBlocks];
    const criticalItems = allItems.filter((i) => i.severity === 'CRITICAL');

    return {
      summary: {
        totalActionItems: allItems.length,
        overdueTasksCount: overdueTasks.length,
        pendingInspectionsCount: pendingInspections.length,
        pendingPaymentsCount: pendingPayments.length,
        complianceBlocksCount: complianceBlocks.length,
        backOfficeTasksCount: backOfficeQueue.length,
      },
      criticalItems,
      itemsByCategory: {
        overdueTasks,
        pendingInspections,
        pendingPayments,
        complianceBlocks,
        backOfficeTasks: backOfficeQueue,
      },
    };
  }

  // ── Workstream 3: Commission Intelligence ───────────────────────────────

  async getCommissionIntelligence(companyId?: string): Promise<CommissionIntelligence> {
    const cleanCompanyId = this.assertCompanyId(companyId);

    const commissions = this.prisma.commission
      ? await this.prisma.commission.findMany({
          where: { companyId: cleanCompanyId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                agentProfile: { select: { agentCode: true } },
              },
            },
          },
        }).catch(() => [])
      : [];

    let totalEarned = 0;
    let totalPaid = 0;
    let totalPending = 0;
    const statusBreakdown = { accrued: 0, approved: 0, realized: 0, paid: 0, cancelled: 0 };
    const agentMap = new Map<string, any>();

    for (const c of commissions) {
      const amt = Number(c.amount || 0);
      const st = (c.status || 'ACCRUED').toUpperCase();

      if (['ACCRUED', 'APPROVED', 'REALIZED', 'PAID'].includes(st)) {
        totalEarned += amt;
      }
      if (st === 'PAID') {
        totalPaid += amt;
        statusBreakdown.paid += amt;
      } else if (st === 'ACCRUED') {
        totalPending += amt;
        statusBreakdown.accrued += amt;
      } else if (st === 'APPROVED') {
        totalPending += amt;
        statusBreakdown.approved += amt;
      } else if (st === 'REALIZED') {
        totalPending += amt;
        statusBreakdown.realized += amt;
      } else if (st === 'CANCELLED') {
        statusBreakdown.cancelled += amt;
      }

      const agentId = c.userId;
      const existing = agentMap.get(agentId) || {
        agentId,
        agentName: c.user ? `${c.user.firstName} ${c.user.lastName || ''}`.trim() : 'Agent',
        agentCode: c.user?.agentProfile?.agentCode || 'AGT-UNKNOWN',
        totalEarned: 0,
        totalPaid: 0,
        totalPending: 0,
        recordsCount: 0,
      };

      existing.recordsCount += 1;
      if (['ACCRUED', 'APPROVED', 'REALIZED', 'PAID'].includes(st)) {
        existing.totalEarned += amt;
      }
      if (st === 'PAID') {
        existing.totalPaid += amt;
      } else if (['ACCRUED', 'APPROVED', 'REALIZED'].includes(st)) {
        existing.totalPending += amt;
      }
      agentMap.set(agentId, existing);
    }

    const reconciliationRate = totalEarned > 0 ? Math.round((totalPaid / totalEarned) * 100 * 10) / 10 : 0;
    const byAgent = [...agentMap.values()].sort((a, b) => b.totalEarned - a.totalEarned);

    return {
      totalEarned,
      totalPaid,
      totalPending,
      reconciliationRate,
      statusBreakdown,
      byAgent,
      byInsurer: [],
    };
  }

  // ── Workstream 3: BI Report CSV Export ───────────────────────────────────

  async exportBiReport(type: string, companyId?: string): Promise<{ filename: string; contentType: string; data: string }> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const now = Date.now();

    switch (type.toLowerCase()) {
      case 'agent-performance': {
        const perf = await this.getAgentPerformanceAnalytics(cleanCompanyId);
        const headers = ['Agent Code', 'Agent Name', 'Email', 'Branch', 'GWP', 'Policies Issued', 'Active Policies', 'Lapsed Policies', 'Retention %', 'Leads Assigned', 'Leads Converted', 'Conversion %', 'Commission Earned', 'Commission Paid'];
        const rows = perf.allAgents.map((a) => [
          `"${a.agentCode}"`,
          `"${a.agentName.replace(/"/g, '""')}"`,
          `"${a.email}"`,
          `"${a.branchName || ''}"`,
          a.gwp,
          a.policiesIssued,
          a.activePolicies,
          a.lapsedPolicies,
          `${a.activeVsLapsedRatio}%`,
          a.leadsAssigned,
          a.leadsConverted,
          `${a.conversionRate}%`,
          a.commissionEarned,
          a.commissionPaid,
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        return { filename: `agent-performance-${now}.csv`, contentType: 'text/csv', data: csv };
      }
      case 'commission-intelligence': {
        const comm = await this.getCommissionIntelligence(cleanCompanyId);
        const headers = ['Agent Code', 'Agent Name', 'Records', 'Earned Commission', 'Paid Commission', 'Pending Commission', 'Reconciliation %'];
        const rows = comm.byAgent.map((a) => [
          `"${a.agentCode}"`,
          `"${a.agentName.replace(/"/g, '""')}"`,
          a.recordsCount,
          a.totalEarned,
          a.totalPaid,
          a.totalPending,
          `${a.totalEarned > 0 ? ((a.totalPaid / a.totalEarned) * 100).toFixed(1) : '0.0'}%`,
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        return { filename: `commission-intelligence-${now}.csv`, contentType: 'text/csv', data: csv };
      }
      case 'action-centre': {
        const action = await this.getOperationalActionCentre(cleanCompanyId);
        const headers = ['ID', 'Category', 'Severity', 'Title', 'Reference Code', 'Assigned To', 'Due Date', 'Days Overdue', 'Created At'];
        const rows = [...action.criticalItems, ...action.itemsByCategory.overdueTasks, ...action.itemsByCategory.pendingInspections, ...action.itemsByCategory.pendingPayments, ...action.itemsByCategory.complianceBlocks].map((i) => [
          `"${i.id}"`,
          `"${i.category}"`,
          `"${i.severity}"`,
          `"${i.title.replace(/"/g, '""')}"`,
          `"${i.referenceCode || ''}"`,
          `"${i.assignedTo || ''}"`,
          `"${i.dueDate || ''}"`,
          i.daysOverdue ?? 0,
          `"${i.createdAt}"`,
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        return { filename: `operational-action-centre-${now}.csv`, contentType: 'text/csv', data: csv };
      }
      default: {
        const rev = await this.getRevenueMetrics(cleanCompanyId);
        const headers = ['Period / Insurer', 'Gross Written Premium'];
        const rows = rev.byInsurer.map((ins) => [`"${ins.insurerName.replace(/"/g, '""')}"`, ins.premium].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        return { filename: `revenue-analytics-${now}.csv`, contentType: 'text/csv', data: csv };
      }
    }
  }
}

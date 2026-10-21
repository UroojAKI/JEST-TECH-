import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WarehouseService } from '../../warehouse/services/warehouse.service';
import { evaluateSafeFormula } from '../../../common/utils/formula-evaluator.util';

export interface ConversionMetrics {
  totalLeads: number;
  quotedLeads: number;
  proposalsCreated: number;
  policiesIssued: number;
  leadToQuoteRate: number;
  quoteToPolicyRate: number;
  overallConversionRate: number;
  stageFunnel: { stage: string; count: number; rate: number }[];
}

export interface RevenueMetrics {
  totalPremium: number;
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  monthOverMonthGrowth: number;
  byInsurer: { insurerName: string; premium: number }[];
  byMonth: { month: string; premium: number }[];
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
  missed: number;
  conversionRate: number;
  pipeline: { bucket: string; count: number; premium: number }[];
}

export interface SalesMetrics {
  policiesIssuedThisMonth: number;
  policiesIssuedLastMonth: number;
  monthOverMonthGrowth: number;
  byAgent: { agentName: string; policiesCount: number; premium: number }[];
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
    const [totalLeads, quotedLeads, proposalsCreated, policiesIssued] =
      await Promise.all([
        this.prisma.lead.count({ where: { ...companyWhere, deletedAt: null } }),
        this.prisma.lead.count({
          where: {
            ...companyWhere,
            deletedAt: null,
            status: { in: ['QUOTE', 'POLICY'] as any[] },
          },
        }),
        this.prisma.proposal.count({
          where: { quotation: { companyId: cleanCompanyId } },
        }),
        this.prisma.policy.count({ where: companyWhere }),
      ]);

    const leadToQuoteRate =
      totalLeads > 0
        ? Math.round((quotedLeads / totalLeads) * 100 * 10) / 10
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

    return {
      totalLeads,
      quotedLeads,
      proposalsCreated,
      policiesIssued,
      leadToQuoteRate,
      quoteToPolicyRate,
      overallConversionRate,
      stageFunnel,
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

    const [thisMonth, lastMonth, thisYear, allPayments] = await Promise.all([
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS' as any,
          paymentDate: { gte: somThisMonth },
          ...policyWhere,
        },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS' as any,
          paymentDate: { gte: somLastMonth, lte: eomLastMonth },
          ...policyWhere,
        },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS' as any,
          paymentDate: { gte: somThisYear },
          ...policyWhere,
        },
      }),
      this.prisma.policyPayment.findMany({
        where: {
          status: 'SUCCESS' as any,
          paymentDate: { gte: somThisYear },
          ...policyWhere,
        },
        include: {
          policy: { select: { quotation: { select: { insurerName: true } } } },
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
      const insurer = p.policy?.quotation?.insurerName ?? 'Unknown';
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

    return {
      totalPremium: totalThisYear,
      thisMonth: thisMonthVal,
      lastMonth: lastMonthVal,
      thisYear: totalThisYear,
      monthOverMonthGrowth: momGrowth,
      byInsurer,
      byMonth,
    };
  }

  async getLossRatioMetrics(companyId?: string): Promise<LossRatioMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const [claimsAgg, premiumAgg] = await Promise.all([
      this.prisma.claim.aggregate({
        _sum: { approvedAmount: true },
        where: { companyId: cleanCompanyId },
      }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS' as any,
          policy: { companyId: cleanCompanyId },
        },
      }),
    ]);

    const totalClaimsPaid = Number(claimsAgg._sum.approvedAmount ?? 0);
    const totalPremiumCollected = Number(premiumAgg._sum.amount ?? 0);
    const lossRatio =
      totalPremiumCollected > 0
        ? Math.round((totalClaimsPaid / totalPremiumCollected) * 100 * 100) /
          100
        : 0;

    return { totalClaimsPaid, totalPremiumCollected, lossRatio, byProduct: [] };
  }

  async getRenewalMetrics(companyId?: string): Promise<RenewalMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const now = new Date();
    const in20 = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in45 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const companyWhere = { companyId: cleanCompanyId };

    const [e20, e30, e45, missed, renewedCount] = await Promise.all([
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
          status: { not: 'ACTIVE' as any },
          expiryDate: { lt: now },
        },
      }),
      this.prisma.policyRenewal.count({
        where: { policy: { companyId: cleanCompanyId } },
      }),
    ]);

    const total = e45 + missed;
    const conversionRate =
      total > 0 ? Math.round((renewedCount / total) * 100 * 10) / 10 : 0;

    return {
      expiring20: e20,
      expiring30: e30,
      expiring45: e45,
      missed,
      conversionRate,
      pipeline: [
        { bucket: '≤20 Days', count: e20, premium: 0 },
        { bucket: '21-30 Days', count: e30 - e20, premium: 0 },
        { bucket: '31-45 Days', count: e45 - e30, premium: 0 },
      ],
    };
  }

  async getSalesMetrics(companyId?: string): Promise<SalesMetrics> {
    const cleanCompanyId = this.assertCompanyId(companyId);
    const somThisMonth = this.startOfMonth();
    const somLastMonth = this.startOfLastMonth();
    const eomLastMonth = this.endOfLastMonth();
    const companyWhere = { companyId: cleanCompanyId };

    const [thisMonth, lastMonth] = await Promise.all([
      this.prisma.policy.count({
        where: { ...companyWhere, createdAt: { gte: somThisMonth } },
      }),
      this.prisma.policy.count({
        where: {
          ...companyWhere,
          createdAt: { gte: somLastMonth, lte: eomLastMonth },
        },
      }),
    ]);

    const momGrowth =
      lastMonth > 0
        ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100 * 10) / 10
        : 0;

    return {
      policiesIssuedThisMonth: thisMonth,
      policiesIssuedLastMonth: lastMonth,
      monthOverMonthGrowth: momGrowth,
      byAgent: [],
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

    return {
      portfolioSize,
      newPoliciesThisMonth: newPolicies,
      newContactsThisMonth: newContacts,
      newLeadsThisMonth: newLeads,
      monthlyGrowthRate: 0,
      trendByMonth: [],
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
}

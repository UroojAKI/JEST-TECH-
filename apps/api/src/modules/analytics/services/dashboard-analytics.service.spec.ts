import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { PrismaService } from '../../../database/prisma.service';
import { ContactAnalyticsService } from './contact-analytics.service';
import { LeadAnalyticsService } from './lead-analytics.service';
import { QuotationAnalyticsService } from './quotation-analytics.service';
import { PolicyAnalyticsService } from './policy-analytics.service';
import { ClaimAnalyticsService } from './claim-analytics.service';
import { RenewalAnalyticsService } from './renewal-analytics.service';
import { RevenueAnalyticsService } from './revenue-analytics.service';
import { CACHE_PROVIDER_TOKEN } from '../../platform/cache/cache.provider';
import { PolicyStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('DashboardAnalyticsService (Iteration 13)', () => {
  let service: DashboardAnalyticsService;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      renewalTask: {
        count: jest.fn().mockResolvedValue(0),
      },
      claim: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { claimAmount: null } }),
      },
      policyPayment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      activity: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      refreshToken: {
        count: jest.fn().mockResolvedValue(5),
      },
      auditLog: {
        count: jest.fn().mockResolvedValue(120),
      },
      user: {
        count: jest.fn().mockResolvedValue(15),
        findMany: jest.fn(),
      },
      branch: {
        findMany: jest.fn(),
      },
      policy: {
        findMany: jest.fn(),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      ping: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAnalyticsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ContactAnalyticsService,
          useValue: { getOverview: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: LeadAnalyticsService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({
              funnel: [],
              conversionRate: 15,
              todayLeads: 2,
              open: 10,
            }),
          },
        },
        {
          provide: QuotationAnalyticsService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({ pendingApproval: 3 }),
          },
        },
        {
          provide: PolicyAnalyticsService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({
              total: 25,
              active: 20,
              topInsurers: [],
            }),
          },
        },
        {
          provide: ClaimAnalyticsService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({
              total: 2,
              lossRatio: 12,
              byStatus: { underAssessment: 1, approved: 1 },
            }),
          },
        },
        {
          provide: RenewalAnalyticsService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({ expiring30: 4 }),
          },
        },
        {
          provide: RevenueAnalyticsService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({
              thisMonth: 150000,
              today: 10000,
            }),
          },
        },
        { provide: CACHE_PROVIDER_TOKEN, useValue: cache },
      ],
    }).compile();

    service = module.get<DashboardAnalyticsService>(DashboardAnalyticsService);
  });

  describe('Zero-Mock Telemetry Verification in computeDashboardData', () => {
    it('should compute live renewal conversion rate dynamically from database counts', async () => {
      // 10 total renewal tasks, 8 completed -> 80.0%
      prisma.renewalTask.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // completed

      // 200,000 paid claims, 1,000,000 gross GWP -> 20.0% loss ratio
      prisma.claim.aggregate.mockResolvedValue({
        _sum: { claimAmount: 200000 },
      });
      prisma.policyPayment.aggregate.mockResolvedValue({
        _sum: { amount: 1000000 },
      });

      const data: any = await service.getDashboardData('ADMIN', 'admin-1', 'tenant-123');

      expect(data.kpis.renewalRate).toBe('80.0%');
      expect(data.kpis.lossRatio).toBe('20.0%');
    });

    it('should handle zero denominator gracefully without throwing NaN', async () => {
      prisma.renewalTask.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      prisma.claim.aggregate.mockResolvedValue({ _sum: { claimAmount: null } });
      prisma.policyPayment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const data: any = await service.getDashboardData('ADMIN', 'admin-1', 'tenant-123');

      expect(data.kpis.renewalRate).toBe('0.0%');
      expect(data.kpis.lossRatio).toBe('0.0%');
    });
  });

  describe('getBranchGwpBreakdown', () => {
    it('should correctly sum active policy premiums per branch', async () => {
      const mockBranches = [
        {
          id: 'b1',
          name: 'Mumbai Central',
          code: 'B-MUM',
          users: [
            {
              policiesCreated: [
                { premiumAmount: 25000 },
                { premiumAmount: 35000 },
              ],
            },
          ],
        },
        {
          id: 'b2',
          name: 'Delhi South',
          code: 'B-DEL',
          users: [
            {
              policiesCreated: [{ premiumAmount: 40000 }],
            },
          ],
        },
      ];
      prisma.branch.findMany.mockResolvedValue(mockBranches);

      const result = await service.getBranchGwpBreakdown('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].gwp).toBe(60000);
      expect(result[0].formattedGwp).toBe('₹60,000');
      expect(result[1].gwp).toBe(40000);
      expect(result[1].formattedGwp).toBe('₹40,000');
    });
  });

  describe('getInsurerMarketShare', () => {
    it('should group active policies by insurer and sort descending by premium volume', async () => {
      const mockPolicies = [
        { premiumAmount: 50000, quotation: { insurerName: 'HDFC ERGO' } },
        { premiumAmount: 30000, quotation: { insurerName: 'ICICI Lombard' } },
        { premiumAmount: 25000, quotation: { insurerName: 'HDFC ERGO' } },
      ];
      prisma.policy.findMany.mockResolvedValue(mockPolicies);

      const result = await service.getInsurerMarketShare('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].insurer).toBe('HDFC ERGO');
      expect(result[0].gwp).toBe(75000);
      expect(result[0].policiesCount).toBe(2);
      expect(result[1].insurer).toBe('ICICI Lombard');
      expect(result[1].gwp).toBe(30000);
      expect(result[1].policiesCount).toBe(1);
    });
  });

  describe('getSalesLeaderboard', () => {
    it('should rank sales agents by Gross Written Premium volume', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          firstName: 'Aman',
          lastName: 'Verma',
          email: 'aman@jest.com',
          policiesCreated: [{ premiumAmount: 30000 }],
          leadsAssigned: [{ id: 'l1' }],
        },
        {
          id: 'agent-2',
          firstName: 'Kavita',
          lastName: 'Sharma',
          email: 'kavita@jest.com',
          policiesCreated: [{ premiumAmount: 80000 }, { premiumAmount: 20000 }],
          leadsAssigned: [{ id: 'l2' }, { id: 'l3' }],
        },
      ];
      prisma.user.findMany.mockResolvedValue(mockAgents);

      const result = await service.getSalesLeaderboard(5, 'tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].agentName).toBe('Kavita Sharma');
      expect(result[0].gwp).toBe(100000);
      expect(result[0].policiesIssued).toBe(2);
      expect(result[1].agentName).toBe('Aman Verma');
      expect(result[1].gwp).toBe(30000);
    });
  });

  describe('Phase 21: Strict Multi-Tenant Scoping & Cache Namespacing', () => {
    it('should namespace Redis cache key with tenant:companyId', async () => {
      prisma.renewalTask.count.mockResolvedValue(0);
      prisma.claim.aggregate.mockResolvedValue({ _sum: { claimAmount: null } });
      prisma.policyPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.getDashboardData('ADMIN', 'user-abc', 'tenant-123');

      expect(cache.set).toHaveBeenCalledWith(
        'tenant:tenant-123:dashboard:analytics:user-abc:ADMIN',
        expect.any(Object),
        300,
      );
    });

    it('should enforce companyId filter in aggregations and counts', async () => {
      prisma.renewalTask.count.mockResolvedValue(0);
      prisma.claim.aggregate.mockResolvedValue({ _sum: { claimAmount: null } });
      prisma.policyPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.getDashboardData('ADMIN', 'user-abc', 'tenant-123');

      expect(prisma.renewalTask.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'tenant-123' },
          }),
        }),
      );

      expect(prisma.claim.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'tenant-123',
          }),
        }),
      );

      expect(prisma.policyPayment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'tenant-123' },
          }),
        }),
      );
    });

    it('should scope getBranchGwpBreakdown, getInsurerMarketShare, and getSalesLeaderboard by companyId', async () => {
      prisma.branch.findMany.mockResolvedValue([]);
      prisma.policy.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getBranchGwpBreakdown('tenant-123');
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { zone: { region: { companyId: 'tenant-123' } } },
        }),
      );

      await service.getInsurerMarketShare('tenant-123');
      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'tenant-123' }),
        }),
      );

      await service.getSalesLeaderboard(10, 'tenant-123');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'tenant-123' }),
        }),
      );
    });
  });

  describe('Phase 9: Fail-closed tenant context & telemetry integrity', () => {
    it('fails closed when company context is missing on analytics helpers', async () => {
      await expect(service.getBranchGwpBreakdown()).rejects.toThrow(ForbiddenException);
      await expect(service.getInsurerMarketShare()).rejects.toThrow(ForbiddenException);
      await expect(service.getSalesLeaderboard(10)).rejects.toThrow(ForbiddenException);
      await expect(service.getDashboardData('ADMIN', 'user-no-tenant')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('SUPER_ADMIN: returns measured latency and null uptimePercentage without synthetic 99.9%', async () => {
      prisma.refreshToken.count.mockResolvedValue(10);
      prisma.auditLog.count.mockResolvedValue(250);
      prisma.user.count.mockResolvedValue(30);

      const data: any = await service.getDashboardData('SUPER_ADMIN', 'super-1');

      expect(data.kpis.serviceHealth).toBe('HEALTHY');
      expect(data.kpis.uptimePercentage).toBeNull();
      expect(data.kpis.apiHealth).toBeUndefined(); // Synthetic percentage removed
      expect(data.kpis.activeSessions).toBe(10);
      expect(data.kpis.auditEvents).toBe(250);
      expect(data.kpis.systemUsers).toBe(30);
    });

    it('Agent: returns null target and achievement when no salesTarget configured without ₹500,000 fallback', async () => {
      // Mock salesTarget to return null
      prisma.salesTarget = { findFirst: jest.fn().mockResolvedValue(null) };

      const data: any = await service.getDashboardData('SALES_AGENT', 'agent-1', 'tenant-123');

      expect(data.kpis.myTarget).toBeNull();
      expect(data.kpis.targetConfigured).toBe(false);
      expect(data.kpis.achievement).toBeNull();
    });
  });

});
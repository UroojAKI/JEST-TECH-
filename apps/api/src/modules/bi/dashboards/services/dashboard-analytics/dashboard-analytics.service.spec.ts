import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('DashboardAnalyticsService', () => {
  let service: DashboardAnalyticsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lead: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      policy: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            policyNumber: 'POL-001',
            premiumAmount: 25000,
            contact: { firstName: 'Rahul', lastName: 'Sharma' },
          },
        ]),
      },
      factRevenue: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50000 } }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardAnalyticsService>(DashboardAnalyticsService);
  });

  describe('getSalesMetrics', () => {
    it('should aggregate sales metrics, policies, and leads correctly', async () => {
      const result = await service.getSalesMetrics('user-1');

      expect(result.kpi.myLeads).toBe(5);
      expect(result.kpi.myPremium).toBe(50000);
      expect(result.kpi.policiesIssued).toBe(3);
      expect(result.table).toHaveLength(1);
      expect(result.table[0].reference).toBe('POL-001');
      expect(result.table[0].entity).toBe('Rahul Sharma');
    });
  });

  describe('getSalesManagerMetrics', () => {
    it('should aggregate team metrics across branch', async () => {
      const result = await service.getSalesManagerMetrics('user-1', 'branch-1');

      expect(result.kpi.teamLeads).toBe(5);
      expect(result.kpi.teamPremium).toBe(50000);
      expect(result.kpi.policiesIssued).toBe(3);
    });
  });

  describe('getRenewalMetrics', () => {
    it('should count policies expiring within 30 days', async () => {
      prisma.policy.count.mockResolvedValue(7);
      const result = await service.getRenewalMetrics('user-1');

      expect(result.kpi.expiring30d).toBe(7);
    });
  });
});

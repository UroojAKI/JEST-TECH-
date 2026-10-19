import { Test, TestingModule } from '@nestjs/testing';
import { BiService } from '../services/bi.service';
import { KpiService } from '../services/kpi.service';
import { PrismaService } from '../../../database/prisma.service';
import { WarehouseService } from '../../warehouse/services/warehouse.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BiService & KpiService (Wave 7 Tenancy Isolation)', () => {
  let service: BiService;
  let kpiService: KpiService;

  const mockPrisma = {
    lead: {
      count: jest.fn().mockResolvedValue(100),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'NEW', _count: { id: 30 } },
        { status: 'CONVERTED', _count: { id: 20 } },
      ]),
    },
    contact: {
      count: jest.fn().mockResolvedValue(40),
    },
    proposal: { count: jest.fn().mockResolvedValue(15) },
    policy: {
      count: jest.fn().mockResolvedValue(20),
    },
    policyPayment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500000 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    claim: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { approvedAmount: 50000 } }),
    },
    policyRenewal: { count: jest.fn().mockResolvedValue(10) },
    kpiDefinition: {
      findMany: jest.fn().mockResolvedValue([
        {
          key: 'conversion_rate',
          name: 'Conversion Rate',
          formula: 'leads_converted / leads_total * 100',
          unit: 'PERCENTAGE',
          description: 'Overall conversion',
          category: 'sales',
        },
      ]),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    },
  };

  const mockWarehouse = {
    getReportingRenewals: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiService,
        KpiService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WarehouseService, useValue: mockWarehouse },
      ],
    }).compile();

    service = module.get<BiService>(BiService);
    kpiService = module.get<KpiService>(KpiService);
  });

  describe('getConversionMetrics', () => {
    it('should calculate conversion rates correctly with companyId', async () => {
      const result = await service.getConversionMetrics('org-a');
      expect(result.totalLeads).toBe(100);
      expect(result.policiesIssued).toBe(20);
      expect(result.overallConversionRate).toBe(20);
      expect(result.stageFunnel).toHaveLength(2);
      expect(mockPrisma.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getConversionMetrics()).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getConversionMetrics('')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getRevenueMetrics', () => {
    it('should aggregate revenue for the specified tenant', async () => {
      const result = await service.getRevenueMetrics('org-a');
      expect(result).toHaveProperty('totalPremium');
      expect(mockPrisma.policyPayment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'org-a' },
          }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getRevenueMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getLossRatioMetrics', () => {
    it('should calculate loss ratio scoped to tenant', async () => {
      const result = await service.getLossRatioMetrics('org-a');
      expect(result).toHaveProperty('lossRatio');
      expect(mockPrisma.claim.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'org-a' },
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getLossRatioMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getRenewalMetrics', () => {
    it('should return renewal pipeline scoped to tenant', async () => {
      const result = await service.getRenewalMetrics('org-a');
      expect(result).toHaveProperty('conversionRate');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getRenewalMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getSalesMetrics', () => {
    it('should return policies issued this month for tenant', async () => {
      const result = await service.getSalesMetrics('org-a');
      expect(result).toHaveProperty('policiesIssuedThisMonth');
      expect(result).toHaveProperty('monthOverMonthGrowth');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getSalesMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getGrowthMetrics', () => {
    it('should return growth metrics for tenant', async () => {
      const result = await service.getGrowthMetrics('org-a');
      expect(result).toHaveProperty('portfolioSize');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getGrowthMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getKpiValues', () => {
    it('should evaluate KPI formulas and return values scoped to tenant', async () => {
      const result = await service.getKpiValues('org-a');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('conversion_rate');
      expect(typeof result[0].value).toBe('number');
      expect(mockPrisma.kpiDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { createdBy: { companyId: 'org-a' } },
              { createdById: null },
            ]),
          }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getKpiValues()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('KpiService (Wave 7 Tenancy Isolation)', () => {
    it('throws NotFoundException if KPI definition does not exist', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue(null);

      await expect(
        kpiService.updateKpi('missing-kpi', { name: 'Updated' }, 'org-a'),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks cross-tenant KPI update with HTTP 403 Forbidden', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-b',
        createdBy: { companyId: 'org-b' },
      });

      await expect(
        kpiService.updateKpi('kpi-tenant-b', { name: 'Tampered' }, 'org-a'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.kpiDefinition.update).not.toHaveBeenCalled();
    });

    it('allows updating KPI when tenant matches', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-a',
        createdBy: { companyId: 'org-a' },
      });
      mockPrisma.kpiDefinition.update.mockResolvedValue({
        id: 'kpi-tenant-a',
        name: 'Updated Name',
      });

      const result = await kpiService.updateKpi(
        'kpi-tenant-a',
        { name: 'Updated Name' },
        'org-a',
      );

      expect(result.name).toBe('Updated Name');
    });

    it('blocks cross-tenant KPI deletion with HTTP 403 Forbidden', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-b',
        createdBy: { companyId: 'org-b' },
      });

      await expect(
        kpiService.deleteKpi('kpi-tenant-b', 'org-a'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.kpiDefinition.update).not.toHaveBeenCalled();
    });

    it('allows soft-deleting KPI when tenant matches', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-a',
        createdBy: { companyId: 'org-a' },
      });
      mockPrisma.kpiDefinition.update.mockResolvedValue({
        id: 'kpi-tenant-a',
        isActive: false,
      });

      const result = await kpiService.deleteKpi('kpi-tenant-a', 'org-a');

      expect(result.isActive).toBe(false);
    });
  });
});

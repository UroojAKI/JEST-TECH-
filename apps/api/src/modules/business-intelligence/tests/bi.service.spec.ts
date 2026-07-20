import { Test, TestingModule } from '@nestjs/testing';
import { BiService } from '../services/bi.service';
import { PrismaService } from '../../../database/prisma.service';
import { WarehouseService } from '../../warehouse/services/warehouse.service';

describe('BiService', () => {
  let service: BiService;

  const mockPrisma = {
    lead: {
      count: jest.fn().mockResolvedValue(100),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'NEW', _count: { id: 30 } },
        { status: 'CONVERTED', _count: { id: 20 } },
      ]),
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
    },
  };

  const mockWarehouse = {
    getReportingRenewals: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WarehouseService, useValue: mockWarehouse },
      ],
    }).compile();

    service = module.get<BiService>(BiService);
  });

  describe('getConversionMetrics', () => {
    it('should calculate conversion rates correctly', async () => {
      const result = await service.getConversionMetrics();
      expect(result.totalLeads).toBe(100);
      expect(result.policiesIssued).toBe(20);
      expect(result.overallConversionRate).toBe(20);
      expect(result.stageFunnel).toHaveLength(2);
    });
  });

  describe('getSalesMetrics', () => {
    it('should return policies issued this month', async () => {
      const result = await service.getSalesMetrics();
      expect(result).toHaveProperty('policiesIssuedThisMonth');
      expect(result).toHaveProperty('monthOverMonthGrowth');
    });
  });

  describe('getKpiValues', () => {
    it('should evaluate KPI formulas and return values', async () => {
      const result = await service.getKpiValues();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('conversion_rate');
      expect(typeof result[0].value).toBe('number');
    });
  });
});

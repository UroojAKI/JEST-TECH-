import { Test, TestingModule } from '@nestjs/testing';
import { StatisticalPredictionService } from './statistical-prediction.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('StatisticalPredictionService', () => {
  let service: StatisticalPredictionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticalPredictionService,
        {
          provide: PrismaService,
          useValue: {
            factRevenue: {
              aggregate: jest.fn(),
            },
            customerAnalytics: {
              findUnique: jest.fn(),
            },
            policy: {
              count: jest.fn(),
              aggregate: jest.fn(),
            },
            policyRenewal: {
              count: jest.fn(),
            },
            claim: {
              aggregate: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StatisticalPredictionService>(
      StatisticalPredictionService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('forecastRevenue', () => {
    it('should calculate revenue forecast based on 6-month average plus growth', async () => {
      // 6 months total = 60000 => average 10000/month
      jest.spyOn(prisma.factRevenue, 'aggregate').mockResolvedValue({
        _sum: { amount: new Decimal(60000) },
      } as any);

      // 1 month ahead => 1% growth
      const forecast = await service.forecastRevenue(1);

      expect(forecast.toNumber()).toBe(10100); // 10000 * 1.01
      expect(prisma.factRevenue.aggregate).toHaveBeenCalled();
    });
  });

  describe('forecastRenewals', () => {
    it('should calculate renewal forecast from authoritative database counts', async () => {
      // Mock 100 policies expiring, 80 renewed previously out of 100
      jest
        .spyOn(prisma.policy, 'count')
        .mockResolvedValueOnce(100) // totalExpiring
        .mockResolvedValueOnce(100); // pastExpiringCount
      jest.spyOn(prisma.policyRenewal, 'count').mockResolvedValue(80);

      const renewals = await service.forecastRenewals(1);
      expect(renewals).toBe(80); // 100 * 0.8
      expect(prisma.policy.count).toHaveBeenCalled();
    });

    it('should return 0 when no policies are expiring', async () => {
      jest.spyOn(prisma.policy, 'count').mockResolvedValueOnce(0);

      const renewals = await service.forecastRenewals(2);
      expect(renewals).toBe(0);
    });
  });

  describe('forecastClaims', () => {
    it('should calculate claims forecast based on 6-month average and inflation', async () => {
      jest.spyOn(prisma.claim, 'aggregate').mockResolvedValue({
        _sum: { claimAmount: new Decimal(120000) },
      } as any);

      // 120000 / 6 = 20000. For 2 months ahead: 20000 * (1 + 0.005 * 2) = 20000 * 1.01 = 20200
      const claims = await service.forecastClaims(2);
      expect(claims.toNumber()).toBe(20200);
      expect(prisma.claim.aggregate).toHaveBeenCalled();
    });
  });

  describe('predictCustomerRisk', () => {
    it('should return churn probability from analytics', async () => {
      jest.spyOn(prisma.customerAnalytics, 'findUnique').mockResolvedValue({
        churnProbability: 75,
      } as any);

      const risk = await service.predictCustomerRisk('cust-1');
      expect(risk).toBe(75);
    });

    it('should default to 50 if no analytics found', async () => {
      jest
        .spyOn(prisma.customerAnalytics, 'findUnique')
        .mockResolvedValue(null);

      const risk = await service.predictCustomerRisk('cust-2');
      expect(risk).toBe(50);
    });
  });
});

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
          },
        },
      ],
    }).compile();

    service = module.get<StatisticalPredictionService>(StatisticalPredictionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('forecastRevenue', () => {
    it('should calculate revenue forecast based on 6-month average plus growth', async () => {
      // 6 months total = 60000 => average 10000/month
      jest.spyOn(prisma.factRevenue, 'aggregate').mockResolvedValue({
        _sum: { amount: new Decimal(60000) }
      } as any);

      // 1 month ahead => 1% growth
      const forecast = await service.forecastRevenue(1);
      
      expect(forecast.toNumber()).toBe(10100); // 10000 * 1.01
      expect(prisma.factRevenue.aggregate).toHaveBeenCalled();
    });
  });

  describe('predictCustomerRisk', () => {
    it('should return churn probability from analytics', async () => {
      jest.spyOn(prisma.customerAnalytics, 'findUnique').mockResolvedValue({
        churnProbability: 75
      } as any);

      const risk = await service.predictCustomerRisk('cust-1');
      expect(risk).toBe(75);
    });

    it('should default to 50 if no analytics found', async () => {
      jest.spyOn(prisma.customerAnalytics, 'findUnique').mockResolvedValue(null);

      const risk = await service.predictCustomerRisk('cust-2');
      expect(risk).toBe(50);
    });
  });
});

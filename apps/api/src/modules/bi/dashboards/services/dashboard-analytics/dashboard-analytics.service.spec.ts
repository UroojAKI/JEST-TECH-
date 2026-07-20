import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('DashboardAnalyticsService', () => {
  let service: DashboardAnalyticsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            dashboard: {
              findUnique: jest.fn(),
            },
            factRevenue: {
              aggregate: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DashboardAnalyticsService>(DashboardAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getDashboardData', () => {
    it('should throw if dashboard not found', async () => {
      jest.spyOn(prisma.dashboard, 'findUnique').mockResolvedValue(null);

      await expect(service.getDashboardData('dash-1')).rejects.toThrow(NotFoundException);
    });

    it('should process widget configs and query facts', async () => {
      jest.spyOn(prisma.dashboard, 'findUnique').mockResolvedValue({
        id: 'dash-1',
        name: 'CEO Dashboard',
        widgets: [
          {
            x: 0, y: 0, w: 2, h: 2,
            widget: {
              id: 'widget-1',
              name: 'Total Revenue',
              type: 'METRIC',
              config: JSON.stringify({ metric: 'TOTAL_REVENUE' })
            }
          }
        ]
      } as any);

      jest.spyOn(prisma.factRevenue, 'aggregate').mockResolvedValue({
        _sum: { amount: new Decimal(5000000) }
      } as any);

      const result = await service.getDashboardData('dash-1');

      expect(result.name).toBe('CEO Dashboard');
      expect(result.widgets.length).toBe(1);
      expect(result.widgets[0].data.toNumber()).toBe(5000000);
      
      expect(prisma.factRevenue.aggregate).toHaveBeenCalled();
    });
  });
});

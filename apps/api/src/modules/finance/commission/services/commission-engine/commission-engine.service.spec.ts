import { Test, TestingModule } from '@nestjs/testing';
import { CommissionEngineService } from './commission-engine.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('CommissionEngineService', () => {
  let service: CommissionEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionEngineService,
        {
          provide: PrismaService,
          useValue: {
            commissionPlan: {
              findUnique: jest.fn(),
            },
            commission: {
              createMany: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CommissionEngineService>(CommissionEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('accrueCommissions', () => {
    it('should calculate agent commission and manager overrides correctly', async () => {
      jest.spyOn(prisma.commissionPlan, 'findUnique').mockResolvedValue({
        id: 'plan-1',
        isActive: true,
        rules: JSON.stringify({
          agentPercent: 10,
          overrides: [
            { roleTier: 'BRANCH_MANAGER', percent: 2, userId: 'bm-1' },
            { roleTier: 'ZONAL_MANAGER', percent: 0.5, userId: 'zm-1' },
          ]
        })
      } as any);

      jest.spyOn(prisma.commission, 'createMany').mockResolvedValue({ count: 3 } as any);

      const result = await service.accrueCommissions('pol-1', 'agent-1', '50000', 'plan-1');

      expect(prisma.commission.createMany).toHaveBeenCalled();
      
      // We know there are 3 items: agent (10%), bm (2%), zm (0.5%) of 50,000
      // Agent = 5000, BM = 1000, ZM = 250
      expect(result.length).toBe(3);
      
      expect(result[0].roleTier).toBe('AGENT');
      expect(result[0].amount.toNumber()).toBe(5000);

      expect(result[1].roleTier).toBe('BRANCH_MANAGER');
      expect(result[1].amount.toNumber()).toBe(1000);

      expect(result[2].roleTier).toBe('ZONAL_MANAGER');
      expect(result[2].amount.toNumber()).toBe(250);
    });
  });

  describe('realizeCommissions', () => {
    it('should update status from ACCRUED to REALIZED', async () => {
      jest.spyOn(prisma.commission, 'updateMany').mockResolvedValue({ count: 2 } as any);

      const count = await service.realizeCommissions('pol-1');

      expect(count).toBe(2);
      expect(prisma.commission.updateMany).toHaveBeenCalledWith({
        where: { policyId: 'pol-1', status: 'ACCRUED' },
        data: { status: 'REALIZED' }
      });
    });
  });
});

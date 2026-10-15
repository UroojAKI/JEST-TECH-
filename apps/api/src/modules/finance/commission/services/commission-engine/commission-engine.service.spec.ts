import { Test, TestingModule } from '@nestjs/testing';
import { CommissionEngineService } from './commission-engine.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('CommissionEngineService', () => {
  let service: CommissionEngineService;
  let prisma: PrismaService;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      commission: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { roleTier: 'AGENT', amount: '5000' },
            { roleTier: 'BRANCH_MANAGER', amount: '1000' },
            { roleTier: 'ZONAL_MANAGER', amount: '250' },
          ]),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionEngineService,
        {
          provide: PrismaService,
          useValue: {
            commissionPlan: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'u-1', status: 'ACTIVE', companyId: 'company-1' }),
            },
            policy: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'pol-1',
                companyId: 'company-1',
                premiumAmount: '59000',
                paymentStatus: 'SUCCESS',
                deletedAt: null,
                quotation: { totalPremium: '59000', gstAmount: '9000' },
              }),
            },
            commission: {
              createMany: jest.fn(),
              updateMany: jest.fn(),
            },
            $transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(mockTx)),
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
          maxAgentPercent: 15,
          maxTotalPercent: 20,
          overrides: [
            { roleTier: 'BRANCH_MANAGER', percent: 2, userId: 'bm-1' },
            { roleTier: 'ZONAL_MANAGER', percent: 0.5, userId: 'zm-1' },
          ],
        }),
      } as any);

      const result = await service.accrueCommissions(
        'pol-1',
        'agent-1',
        '50000',
        'plan-1',
      );

      // The policy-linked quotation has ₹59,000 total premium less ₹9,000 tax.
      // The configured plan calculates all recipients from the ₹50,000 commissionable base.
      expect(result.length).toBe(3);
      expect((prisma as any).policy.findUnique).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        include: { quotation: true },
      });
      expect(mockTx.commission.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ policyId: 'pol-1', companyId: 'company-1', roleTier: 'AGENT' }),
        ]),
      });

      expect(result[0].roleTier).toBe('AGENT');
      expect(Number(result[0].amount)).toBe(5000);

      expect(result[1].roleTier).toBe('BRANCH_MANAGER');
      expect(Number(result[1].amount)).toBe(1000);

      expect(result[2].roleTier).toBe('ZONAL_MANAGER');
      expect(Number(result[2].amount)).toBe(250);


    });

    it('rejects a caller-supplied premium base that differs from the policy quotation excluding GST', async () => {
      jest.spyOn(prisma.commissionPlan, 'findUnique').mockResolvedValue({
        id: 'plan-1',
        isActive: true,
        rules: JSON.stringify({
          agentPercent: 10,
          maxAgentPercent: 15,
          maxTotalPercent: 20,
          overrides: [],
        }),
      } as any);

      await expect(
        service.accrueCommissions('pol-1', 'agent-1', '59000', 'plan-1'),
      ).rejects.toThrow(/does not match the policy-linked quotation/);
    });

    it('T-05: throws structured COMMISSION_CONFIG_PENDING when no active commission plan matches', async () => {
      jest.spyOn(prisma.commissionPlan, 'findUnique').mockResolvedValue(null);

      let thrown: any = null;
      try {
        await service.accrueCommissions('pol-1', 'agent-1', '50000', 'missing-plan-id');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeDefined();
      expect(thrown.getResponse()).toMatchObject({
        errorCode: 'COMMISSION_CONFIG_PENDING',
        missingEntity: 'COMMISSION_CONFIG',
        planId: 'missing-plan-id',
      });
    });
  });

  describe('realizeCommissions', () => {
    it('should update status from APPROVED to REALIZED', async () => {
      jest
        .spyOn(prisma.commission, 'updateMany')
        .mockResolvedValue({ count: 2 });

      const count = await service.realizeCommissions('pol-1');

      expect(count).toBe(2);
      expect(prisma.commission.updateMany).toHaveBeenCalledWith({
        where: { policyId: 'pol-1', companyId: 'company-1', status: 'APPROVED' },
        data: { status: 'REALIZED' },
      });
    });
  });
});

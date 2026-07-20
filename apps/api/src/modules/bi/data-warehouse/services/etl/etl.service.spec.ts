import { Test, TestingModule } from '@nestjs/testing';
import { EtlService } from './etl.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('EtlService', () => {
  let service: EtlService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlService,
        {
          provide: PrismaService,
          useValue: {
            policy: {
              findUnique: jest.fn(),
            },
            dimDate: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            dimBranch: {
              upsert: jest.fn(),
            },
            dimAgent: {
              upsert: jest.fn(),
            },
            dimCustomer: {
              upsert: jest.fn(),
            },
            dimProduct: {
              upsert: jest.fn(),
            },
            factPolicy: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EtlService>(EtlService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('extractAndLoadPolicy', () => {
    it('should transform a Policy into Star Schema', async () => {
      const mockDate = new Date('2026-07-20T00:00:00.000Z');

      jest.spyOn(prisma.policy, 'findUnique').mockResolvedValue({
        id: 'pol-1',
        createdAt: mockDate,
        userId: 'agent-1',
        contactId: 'cust-1',
        productId: 'prod-1',
        premiumAmount: 10000,
        status: 'ACTIVE',
        user: {
          firstName: 'Agent',
          lastName: 'One',
          branchId: 'branch-1',
          branch: { name: 'HQ', regionId: 'REG-1' },
        },
        contact: {
          firstName: 'John',
          lastName: 'Doe',
          type: 'INDIVIDUAL',
        },
        product: {
          name: 'Health Plan',
          category: 'HEALTH',
          insurer: { name: 'XYZ Insurance' },
        },
      } as any);

      jest.spyOn(prisma.dimDate, 'findUnique').mockResolvedValue(null);

      await service.extractAndLoadPolicy('pol-1');

      // Verify Dimensions
      expect(prisma.dimDate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dateId: '2026-07-20' }),
        }),
      );

      expect(prisma.dimBranch.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'branch-1' } }),
      );

      expect(prisma.dimCustomer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cust-1' } }),
      );

      // Verify Fact
      expect(prisma.factPolicy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            id: 'pol-1',
            dateId: '2026-07-20',
            branchId: 'branch-1',
            agentId: 'agent-1',
            customerId: 'cust-1',
            productId: 'prod-1',
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });
});

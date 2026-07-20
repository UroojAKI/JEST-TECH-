import { Test, TestingModule } from '@nestjs/testing';
import { CustomerAnalyticsCronService } from './customer-analytics-cron.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('CustomerAnalyticsCronService', () => {
  let service: CustomerAnalyticsCronService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAnalyticsCronService,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              findMany: jest.fn(),
            },
            policy: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
            claim: {
              findMany: jest.fn(),
            },
            customerAnalytics: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CustomerAnalyticsCronService>(
      CustomerAnalyticsCronService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('calculateMetricsForCustomer', () => {
    it('should correctly aggregate premiums and calculate LTV', async () => {
      jest
        .spyOn(prisma.policy, 'count')
        .mockImplementation(async ({ where }: any) => {
          if (where.status === 'ACTIVE') return 2;
          if (where.status === 'EXPIRED') return 1;
          return 0;
        });

      jest
        .spyOn(prisma.policy, 'findMany')
        .mockResolvedValue([
          { premiumAmount: new Decimal(10000) },
          { premiumAmount: new Decimal(20000) },
        ] as any);

      jest
        .spyOn(prisma.claim, 'findMany')
        .mockResolvedValue([{ amount: new Decimal(5000) }] as any);

      jest
        .spyOn(prisma.customerAnalytics, 'upsert')
        .mockResolvedValue({} as any);

      await service.calculateMetricsForCustomer('contact-1');

      expect(prisma.customerAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            contactId: 'contact-1',
            activePolicies: 2,
            expiredPolicies: 1,
            lifetimePremium: new Decimal(30000),
            lifetimeClaims: new Decimal(5000),
            lifetimeValue: new Decimal(4500), // 15% of 30,000
          }),
        }),
      );
    });

    it('should lower renewal probability for high claims ratio', async () => {
      jest.spyOn(prisma.policy, 'count').mockResolvedValue(1);
      jest
        .spyOn(prisma.policy, 'findMany')
        .mockResolvedValue([{ premiumAmount: new Decimal(10000) }] as any);
      jest
        .spyOn(prisma.claim, 'findMany')
        .mockResolvedValue([{ amount: new Decimal(15000) }] as any); // 150% ratio

      await service.calculateMetricsForCustomer('contact-1');

      expect(prisma.customerAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            claimRatio: new Decimal(150),
            renewalProbability: 60, // 80 - 20
            churnProbability: 40, // 20 + 20
          }),
        }),
      );
    });
  });
});

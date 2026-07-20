import { Test, TestingModule } from '@nestjs/testing';
import { Customer360Service } from './customer-360.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('Customer360Service', () => {
  let service: Customer360Service;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Customer360Service,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              findUnique: jest.fn(),
            },
            policy: {
              findMany: jest.fn(),
            },
            claim: {
              findMany: jest.fn(),
            },
            communicationLog: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<Customer360Service>(Customer360Service);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getCustomer360', () => {
    it('should throw if customer not found', async () => {
      jest.spyOn(prisma.contact, 'findUnique').mockResolvedValue(null);

      await expect(service.getCustomer360('contact-1')).rejects.toThrow(NotFoundException);
    });

    it('should aggregate profile, analytics, assets, operational data, and timeline', async () => {
      const mockContact = {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        analytics: { lifetimeValue: 5000 },
        familyMembers: [{ id: 'fam-1', firstName: 'Jane' }],
        vehicles: [{ id: 'veh-1', make: 'Honda' }]
      };

      jest.spyOn(prisma.contact, 'findUnique').mockResolvedValue(mockContact as any);
      jest.spyOn(prisma.policy, 'findMany').mockResolvedValue([{ id: 'pol-1' }] as any);
      jest.spyOn(prisma.claim, 'findMany').mockResolvedValue([{ id: 'claim-1' }] as any);
      jest.spyOn(prisma.communicationLog, 'findMany').mockResolvedValue([{ id: 'log-1' }] as any);

      const result = await service.getCustomer360('contact-1');

      expect(result.profile.name).toBe('John Doe');
      expect(result.analytics.lifetimeValue).toBe(5000);
      expect(result.assets.family.length).toBe(1);
      expect(result.operational.activePolicies.length).toBe(1);
      expect(result.timeline.recentCommunications.length).toBe(1);

      // Verify concurrent fetches
      expect(prisma.policy.findMany).toHaveBeenCalled();
      expect(prisma.claim.findMany).toHaveBeenCalled();
      expect(prisma.communicationLog.findMany).toHaveBeenCalled();
    });
  });
});

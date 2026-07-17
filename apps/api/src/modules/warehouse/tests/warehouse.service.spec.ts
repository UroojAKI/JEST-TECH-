import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from '../services/warehouse.service';
import { PrismaService } from '../../../database/prisma.service';

describe('WarehouseService', () => {
  let service: WarehouseService;

  const mockContacts = [
    { id: '1', firstName: 'Rahul', lastName: 'Sharma', email: 'rahul@jest.com', phone: '9876543210', type: 'INDIVIDUAL', status: 'ACTIVE', city: 'Mumbai', state: 'Maharashtra', createdAt: new Date() },
  ];

  const mockPrisma = {
    contact: { findMany: jest.fn().mockResolvedValue(mockContacts) },
    lead: { findMany: jest.fn().mockResolvedValue([]) },
    policy: { findMany: jest.fn().mockResolvedValue([]) },
    claim: { findMany: jest.fn().mockResolvedValue([]) },
    policyPayment: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
  });

  describe('getReportingContacts', () => {
    it('should return flat denormalized contact rows', async () => {
      const result = await service.getReportingContacts();
      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe('Rahul Sharma');
      expect(result[0].id).toBe('1');
    });

    it('should include all required fields', async () => {
      const result = await service.getReportingContacts();
      const row = result[0];
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('fullName');
      expect(row).toHaveProperty('email');
      expect(row).toHaveProperty('type');
      expect(row).toHaveProperty('status');
      expect(row).toHaveProperty('createdAt');
    });
  });

  describe('getReportingLeads', () => {
    it('should return empty array when no leads', async () => {
      const result = await service.getReportingLeads();
      expect(result).toHaveLength(0);
    });
  });

  describe('getReportingPolicies', () => {
    it('should return empty array when no policies', async () => {
      const result = await service.getReportingPolicies();
      expect(result).toHaveLength(0);
    });
  });
});

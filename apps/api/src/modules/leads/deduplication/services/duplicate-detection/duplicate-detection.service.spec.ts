import { Test, TestingModule } from '@nestjs/testing';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;
  let prisma: PrismaService;

  const mockPrisma = {
    contact: {
      findFirst: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    vehicle: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicateDetectionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DuplicateDetectionService>(DuplicateDetectionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('checkDuplicates', () => {
    it('returns hasDuplicate: false when no criteria match', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.lead.findFirst.mockResolvedValue(null);
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.vehicle.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicates({
        phone: '9876543210',
        email: 'new@example.com',
      });

      expect(result.hasDuplicate).toBe(false);
      expect(result.matches).toHaveLength(0);
      expect(result.suggestedAction).toBe('PROCEED');
    });

    it('detects existing contact by phone', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue({
        id: 'con-123',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '9876543210',
        contactCode: 'CON-001',
      });
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicates({ phone: '9876543210' });

      expect(result.hasDuplicate).toBe(true);
      expect(result.existingContactId).toBe('con-123');
      expect(result.matches[0].entityType).toBe('CONTACT');
      expect(result.matches[0].field).toBe('phone');
      expect(result.suggestedAction).toBe('MERGE_OR_REUSE');
    });

    it('detects existing lead by email', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'lead-456',
        leadCode: 'LD-00456',
        title: 'Toyota Fortuner Comprehensive',
        status: 'NEW',
      });

      const result = await service.checkDuplicates({
        email: 'rahul@example.com',
      });

      expect(result.hasDuplicate).toBe(true);
      expect(result.existingLeadId).toBe('lead-456');
      expect(result.matches[0].entityType).toBe('LEAD');
      expect(result.matches[0].field).toBe('email');
    });

    it('detects existing vehicle by registration number', async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        id: 'veh-789',
        registrationNumber: 'MH02CB1234',
        makeModel: 'Honda City',
        contactId: 'con-123',
      });

      const result = await service.checkDuplicates({
        registrationNumber: 'MH 02 CB 1234',
      });

      expect(result.hasDuplicate).toBe(true);
      expect(result.matches[0].entityType).toBe('VEHICLE');
      expect(result.matches[0].field).toBe('registrationNumber');
      expect(result.matches[0].name).toBe('Honda City');
    });

    it('detects existing account by PAN', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-999',
        name: 'Sharma Enterprises',
        accountCode: 'ACC-001',
      });

      const result = await service.checkDuplicates({ panNumber: 'ABCDE1234F' });

      expect(result.hasDuplicate).toBe(true);
      expect(result.matches[0].entityType).toBe('ACCOUNT');
      expect(result.matches[0].field).toBe('panNumber');
    });
  });

  describe('detectDuplicates (backward compatible)', () => {
    it('returns existingLeadId or null', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'lead-123',
        leadCode: 'LD-001',
        title: 'Car Insurance',
        status: 'NEW',
      });

      const id = await service.detectDuplicates({ phone: '9876543210' });
      expect(id).toBe('lead-123');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CrmIdentityService } from './crm-identity.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('CrmIdentityService', () => {
  let service: CrmIdentityService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      contact: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmIdentityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CrmIdentityService>(CrmIdentityService);
  });

  describe('Normalizations', () => {
    it('normalizes various Indian phone formats to standard 10 digits', () => {
      expect(service.normalizePhone('+919876543210')).toBe('9876543210');
      expect(service.normalizePhone('09876543210')).toBe('9876543210');
      expect(service.normalizePhone('98765 43210')).toBe('9876543210');
      expect(service.normalizePhone('98765-43210')).toBe('9876543210');
      expect(service.normalizePhone('')).toBeNull();
      expect(service.normalizePhone(null)).toBeNull();
    });

    it('normalizes email addresses by trimming and lowercasing', () => {
      expect(service.normalizeEmail(' Rahul.Sharma@JEST.com ')).toBe('rahul.sharma@jest.com');
      expect(service.normalizeEmail('')).toBeNull();
      expect(service.normalizeEmail(null)).toBeNull();
    });
  });

  describe('Identity Resolution', () => {
    it('returns MATCH when contact exists with linked customer', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        {
          id: 'con-1',
          companyId: 'org-1',
          phone: '9876543210',
          email: 'rahul@jest.com',
          customer: { id: 'cust-1', contactId: 'con-1' },
        },
      ]);

      const result = await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9876543210',
      });

      expect(result.status).toBe('MATCH');
      expect(result.contact?.id).toBe('con-1');
      expect(result.customer?.id).toBe('cust-1');
    });

    it('returns AMBIGUOUS when phone belongs to Contact A and email belongs to Contact B', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'con-A', phone: '9876543210', email: 'other@jest.com' },
        { id: 'con-B', phone: '9123456789', email: 'target@jest.com' },
      ]);

      const result = await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9876543210',
        email: 'target@jest.com',
      });

      expect(result.status).toBe('AMBIGUOUS');
      expect(result.conflictReason).toContain('different existing contacts');
    });

    it('returns NEW when no matching contact or customer exists', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      const result = await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9999999999',
        email: 'fresh@jest.com',
      });

      expect(result.status).toBe('NEW');
    });
  });

  describe('Transactional Link Guarantee', () => {
    it('throws ConflictException on ambiguous identity during ensureLinkedContactAndCustomer', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'con-A', phone: '9876543210', email: 'a@jest.com' },
        { id: 'con-B', phone: '9123456789', email: 'b@jest.com' },
      ]);

      await expect(
        service.ensureLinkedContactAndCustomer(mockPrisma as any, {
          companyId: 'org-1',
          firstName: 'Test',
          phone: '9876543210',
          email: 'b@jest.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates contact and customer atomically when NEW and createCustomerIfMissing is true', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      mockPrisma.contact.create.mockResolvedValue({
        id: 'con-new',
        contactCode: 'CONT-000001',
        firstName: 'Amit',
      });
      mockPrisma.customer.create.mockResolvedValue({
        id: 'cust-new',
        customerCode: 'CUST-000001',
        contactId: 'con-new',
        firstName: 'Amit',
      });

      const res = await service.ensureLinkedContactAndCustomer(mockPrisma as any, {
        companyId: 'org-1',
        firstName: 'Amit',
        phone: '9876543210',
        createCustomerIfMissing: true,
      });

      expect(res.contact.id).toBe('con-new');
      expect(res.customer.id).toBe('cust-new');
      expect(mockPrisma.contact.create).toHaveBeenCalled();
      expect(mockPrisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'con-new',
          }),
        }),
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CrmIdentityService } from './crm-identity.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('CrmIdentityService', () => {
  let service: CrmIdentityService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      contact: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
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

    it('handles E.164 international formats and rejects invalid formats without substring slicing', () => {
      expect(service.normalizePhone('+14155552671')).toBe('+14155552671');
      expect(service.normalizePhone('+447911123456')).toBe('+447911123456');
      // Indian mobile must start with 6-9
      expect(service.normalizePhone('1234567890')).toBeNull();
      expect(service.normalizePhone('5234567890')).toBeNull();
      // Too short
      expect(service.normalizePhone('98765')).toBeNull();
      // Arbitrary long sequence without country code must be rejected, not sliced
      expect(service.normalizePhone('987654321099999')).toBeNull();
    });

    it('normalizes email addresses by trimming and lowercasing', () => {
      expect(service.normalizeEmail(' Rahul.Sharma@JEST.com ')).toBe('rahul.sharma@jest.com');
      expect(service.normalizeEmail('')).toBeNull();
      expect(service.normalizeEmail(null)).toBeNull();
    });

    it('generates exact query variants for phone numbers', () => {
      const variants = service.getPhoneVariants('9876543210');
      expect(variants).toContain('9876543210');
      expect(variants).toContain('+919876543210');
      expect(variants).toContain('09876543210');
    });
  });

  describe('Cross-Tenant ID Verification', () => {
    it('throws ForbiddenException when contactId belongs to another tenant', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'con-alien',
        companyId: 'org-OTHER',
        deletedAt: null,
      });

      await expect(
        service.resolveIdentity({
          companyId: 'org-MY-COMPANY',
          contactId: 'con-alien',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when customerId belongs to another tenant', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-alien',
        companyId: 'org-OTHER',
        deletedAt: null,
      });

      await expect(
        service.resolveIdentity({
          companyId: 'org-MY-COMPANY',
          customerId: 'cust-alien',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns MATCH when contactId belongs to the caller tenant', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'con-1',
        companyId: 'org-1',
        deletedAt: null,
        customer: { id: 'cust-1' },
      });

      const res = await service.resolveIdentity({
        companyId: 'org-1',
        contactId: 'con-1',
      });

      expect(res.status).toBe('MATCH');
      expect(res.matchedBy).toBe('CONTACT_ID');
      expect(res.contact.id).toBe('con-1');
    });
  });

  describe('Identity Resolution & Ambiguity Prevention', () => {
    it('returns MATCH with BOTH when both phone and email match the same contact', async () => {
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
        email: 'rahul@jest.com',
      });

      expect(result.status).toBe('MATCH');
      expect(result.matchedBy).toBe('BOTH');
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

    it('returns AMBIGUOUS when phone matches Contact A but incoming email diverges from Contact A existing email', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'con-A', phone: '9876543210', email: 'registered@jest.com' },
      ]);

      const result = await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9876543210',
        email: 'divergent@jest.com',
      });

      expect(result.status).toBe('AMBIGUOUS');
      expect(result.conflictReason).toContain('different email');
    });

    it('returns AMBIGUOUS when email matches Contact A but incoming phone diverges from Contact A existing phone', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'con-A', phone: '9876543210', email: 'registered@jest.com' },
      ]);

      const result = await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9111111111',
        email: 'registered@jest.com',
      });

      expect(result.status).toBe('AMBIGUOUS');
      expect(result.conflictReason).toContain('different phone');
    });

    it('returns AMBIGUOUS when multiple distinct contacts match', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'con-1', phone: '9876543210', email: null },
        { id: 'con-2', phone: '9876543210', email: null },
      ]);

      const result = await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9876543210',
      });

      expect(result.status).toBe('AMBIGUOUS');
      expect(result.conflictReason).toContain('Multiple distinct contacts');
    });

    it('uses exact in-query matching instead of contains', async () => {
      await service.resolveIdentity({
        companyId: 'org-1',
        phone: '9876543210',
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                phone: { in: expect.arrayContaining(['9876543210', '+919876543210']) },
              }),
            ]),
          }),
        }),
      );
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

  describe('Transactional Link Guarantee & Unique Code Generation', () => {
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

    it('retries on P2002 collision during contact code generation', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      const p2002Error: any = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';

      mockPrisma.contact.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({
          id: 'con-retry',
          contactCode: 'CONT-000002',
          firstName: 'Amit',
        });

      const res = await service.ensureLinkedContactAndCustomer(mockPrisma as any, {
        companyId: 'org-1',
        firstName: 'Amit',
        phone: '9876543210',
      });

      expect(res.contact.id).toBe('con-retry');
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(2);
    });
  });
});

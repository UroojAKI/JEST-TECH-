import { Test, TestingModule } from '@nestjs/testing';
import { ConvertQuotationService } from './convert-quotation.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { PrismaService } from '../../../../database/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QuotationStatus, PolicyStatus, Prisma } from '@prisma/client';

describe('ConvertQuotationService (Phase 11 Motor Generic Conversion Gate)', () => {
  let service: ConvertQuotationService;
  let mockPrisma: any;
  let mockRepo: any;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      quotation: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      policy: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(10),
      },
      quotationHistory: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1005) }]),
    };

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    mockRepo = {
      findDetail: jest.fn().mockResolvedValue({
        id: 'q-health-1',
        quotationCode: 'QTN-HEALTH-001',
        status: QuotationStatus.CONVERTED_TO_POLICY,
        sumInsured: new Prisma.Decimal(500000),
        basePremium: new Prisma.Decimal(10000),
        gstAmount: new Prisma.Decimal(1800),
        totalPremium: new Prisma.Decimal(11800),
        contact: { id: 'c-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        account: null,
        lead: null,
        versions: [],
        addons: [],
        discounts: [],
        histories: [],
        documents: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConvertQuotationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QuotationRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ConvertQuotationService>(ConvertQuotationService);
  });

  it('PHASE 11: should reject conversion of MOTOR quotation with HTTP 409 ConflictException', async () => {
    mockTx.quotation.findFirst.mockResolvedValue({
      id: 'q-motor-1',
      quotationCode: 'QTN-MOTOR-001',
      productType: 'MOTOR',
      status: QuotationStatus.APPROVED,
    });

    await expect(service.execute('q-motor-1', 'user-1')).rejects.toThrow(ConflictException);
    await expect(service.execute('q-motor-1', 'user-1')).rejects.toThrow(
      'MOTOR_WORKFLOW_REQUIRES_MOTOR_ISSUANCE',
    );
  });

  it('should throw NotFoundException if quotation does not exist', async () => {
    mockTx.quotation.findFirst.mockResolvedValueOnce(null);

    await expect(service.execute('non-existent', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if non-motor quotation is not APPROVED', async () => {
    mockTx.quotation.findFirst.mockResolvedValueOnce({
      id: 'q-health-draft',
      quotationCode: 'QTN-HLT-001',
      productType: 'HEALTH',
      status: QuotationStatus.DRAFT,
    });

    await expect(service.execute('q-health-draft', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('should convert an APPROVED non-motor quotation to policy successfully', async () => {
    mockTx.quotation.findFirst.mockResolvedValueOnce({
      id: 'q-health-1',
      quotationCode: 'QTN-HEALTH-001',
      productType: 'HEALTH',
      status: QuotationStatus.APPROVED,
      companyId: 'comp-1',
      contactId: 'c-1',
      accountId: null,
      totalPremium: new Prisma.Decimal(11800),
      expiryDate: new Date('2027-09-26'),
    });

    mockTx.policy.findFirst.mockResolvedValueOnce(null);
    mockTx.policy.create.mockResolvedValueOnce({
      id: 'pol-1',
      policyNumber: 'POL-001005',
    });

    const result = await service.execute('q-health-1', 'user-1');

    expect(result.policy.policyNumber).toBe('POL-001005');
    expect(mockTx.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q-health-1' },
        data: expect.objectContaining({
          status: QuotationStatus.CONVERTED_TO_POLICY,
        }),
      }),
    );
  });
});

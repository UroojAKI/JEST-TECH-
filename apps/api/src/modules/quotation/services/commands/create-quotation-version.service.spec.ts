import { Test, TestingModule } from '@nestjs/testing';
import { CreateQuotationVersionService } from './create-quotation-version.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationStatus, Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CreateQuotationVersionService (R5 Versioning Engine)', () => {
  let service: CreateQuotationVersionService;
  let prisma: PrismaService;
  let repo: QuotationRepository;

  const mockTx = {
    quotation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    quotationVersion: {
      create: jest.fn(),
    },
    quotationHistory: {
      create: jest.fn(),
    },
  };

  const mockPrisma = {
    $transaction: jest.fn().mockImplementation(async (callback) => callback(mockTx)),
  };

  const mockRepo = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuotationVersionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QuotationRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CreateQuotationVersionService>(CreateQuotationVersionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('creates V2 revision under draft quotation with financial precision', async () => {
    const existingQuote = {
      id: 'q-100',
      quotationCode: 'QTN-000100',
      status: QuotationStatus.DRAFT,
      version: 1,
      versions: [{ versionNumber: 1 }],
    };

    mockTx.quotation.findFirst
      .mockResolvedValueOnce(existingQuote)
      .mockResolvedValueOnce({
        ...existingQuote,
        sumInsured: new Prisma.Decimal(900000),
        basePremium: new Prisma.Decimal(28000),
        gstAmount: new Prisma.Decimal(5040),
        totalPremium: new Prisma.Decimal(33040),
        version: 2,
        versions: [{ versionNumber: 2 }, { versionNumber: 1 }],
        addons: [],
        discounts: [],
        histories: [],
        documents: [],
      });

    mockTx.quotationVersion.create.mockResolvedValue({ id: 'ver-2', versionNumber: 2 });
    mockTx.quotation.update.mockResolvedValue({ id: 'q-100', version: 2 });

    const result = await service.execute(
      'q-100',
      {
        sumInsured: 900000,
        basePremium: 28000,
        gstAmount: 5040,
        totalPremium: 33040,
      },
      'user-1',
    );

    expect(result.id).toBe('q-100');
    expect(mockTx.quotationVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quotationId: 'q-100',
        versionNumber: 2,
      }),
    });
  });

  it('rejects creating revisions if quotation is already accepted (APPROVED)', async () => {
    mockTx.quotation.findFirst.mockResolvedValueOnce({
      id: 'q-approved',
      status: QuotationStatus.APPROVED,
      versions: [{ versionNumber: 1 }],
    });

    await expect(
      service.execute('q-approved', { sumInsured: 900000, basePremium: 28000 }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CreateQuotationVersionService } from './create-quotation-version.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationStatus, Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MotorCalculationService } from '../../../motor/services/motor-calculation.service';

describe('CreateQuotationVersionService (R5 Versioning Engine)', () => {
  let service: CreateQuotationVersionService;
  let prisma: PrismaService;
  let repo: QuotationRepository;
  let mockMotorCalcService: Partial<MotorCalculationService>;

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
    $transaction: jest
      .fn()
      .mockImplementation(async (callback) => callback(mockTx)),
  };

  const mockRepo = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    mockMotorCalcService = {
      calculate: jest.fn().mockResolvedValue({
        calculationVersion: 'motor-v3-epic16',
        outputs: {
          basePremium: 14948.2,
          totalDiscount: 4377.8,
          totalGst: 2690.68,
          totalPremium: 17638.88,
          itemizedAddons: [],
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuotationVersionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QuotationRepository, useValue: mockRepo },
        { provide: MotorCalculationService, useValue: mockMotorCalcService },
      ],
    }).compile();

    service = module.get<CreateQuotationVersionService>(
      CreateQuotationVersionService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('creates V2 revision under draft quotation with financial precision (non-motor)', async () => {
    const existingQuote = {
      id: 'q-100',
      quotationCode: 'QTN-000100',
      productType: 'HEALTH',
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

    mockTx.quotationVersion.create.mockResolvedValue({
      id: 'ver-2',
      versionNumber: 2,
    });
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

  it('delegates recalculation to MotorCalculationService when productType is MOTOR', async () => {
    const existingQuote = {
      id: 'q-motor-1',
      quotationCode: 'QTN-MOTOR-001',
      productType: 'MOTOR',
      vehicleCategory: 'PRIVATE_CAR',
      policyType: 'PACKAGE_COMPREHENSIVE',
      status: QuotationStatus.DRAFT,
      version: 1,
      versions: [{ versionNumber: 1 }],
      vehicle: {
        registrationNumber: 'MH02CB1234',
        vehicleCategory: 'PRIVATE_CAR',
        engineCc: 1197,
      },
    };

    mockTx.quotation.findFirst
      .mockResolvedValueOnce(existingQuote)
      .mockResolvedValueOnce({
        ...existingQuote,
        sumInsured: new Prisma.Decimal(500000),
        basePremium: new Prisma.Decimal(14948.2),
        gstAmount: new Prisma.Decimal(2690.68),
        totalPremium: new Prisma.Decimal(17638.88),
        version: 2,
        versions: [{ versionNumber: 2 }, { versionNumber: 1 }],
        addons: [],
        discounts: [],
        histories: [],
        documents: [],
      });

    mockTx.quotationVersion.create.mockResolvedValue({
      id: 'ver-motor-2',
      versionNumber: 2,
    });
    mockTx.quotation.update.mockResolvedValue({ id: 'q-motor-1', version: 2 });

    const result = await service.execute(
      'q-motor-1',
      {
        sumInsured: 500000,
        basePremium: 99999, // client-supplied unverified values must be ignored
        gstAmount: 111,
        totalPremium: 222,
      },
      'user-motor',
    );

    expect(mockMotorCalcService.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleCategory: 'PRIVATE_CAR',
        idv: 500000,
      }),
    );
    expect(mockTx.quotationVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quotationId: 'q-motor-1',
        versionNumber: 2,
        basePremium: new Prisma.Decimal(14948.2),
        totalPremium: new Prisma.Decimal(17638.88),
        gstAmount: new Prisma.Decimal(2690.68),
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
      service.execute(
        'q-approved',
        { sumInsured: 900000, basePremium: 28000 },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

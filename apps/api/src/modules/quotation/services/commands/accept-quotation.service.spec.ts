import { Test, TestingModule } from '@nestjs/testing';
import { AcceptQuotationService } from './accept-quotation.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationStatus, MotorWorkflowState } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AcceptQuotationService (R5 Multi-Version & Single Accepted Rule)', () => {
  let service: AcceptQuotationService;
  let prisma: PrismaService;
  let repo: QuotationRepository;

  const mockTx = {
    quotation: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    lead: {
      update: jest.fn(),
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

  const mockRepo = {
    findDetail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptQuotationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QuotationRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AcceptQuotationService>(AcceptQuotationService);
    prisma = module.get<PrismaService>(PrismaService);
    repo = module.get<QuotationRepository>(QuotationRepository);
  });

  it('accepts quotation, qualifies lead, and supersedes competing quotes under lead', async () => {
    const targetQuote = {
      id: 'q-v1',
      quotationCode: 'QTN-0001-V1',
      status: QuotationStatus.DRAFT,
      leadId: 'lead-123',
    };

    // 1st findFirst: finds target quote
    // 2nd findFirst: checks if any OTHER quote for lead-123 is accepted -> returns null
    // 3rd findFirst: final detail fetch
    mockTx.quotation.findFirst
      .mockResolvedValueOnce(targetQuote)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...targetQuote,
        status: QuotationStatus.APPROVED,
        workflowState: MotorWorkflowState.QUOTE_FINALIZED,
        versions: [{ versionNumber: 1 }],
        addons: [],
        discounts: [],
        histories: [],
        documents: [],
      });

    mockTx.quotation.update.mockResolvedValue({
      ...targetQuote,
      status: QuotationStatus.APPROVED,
    });

    const result = await service.execute(
      'q-v1',
      'user-1',
      'Customer accepted quote V1',
    );

    expect(result.status).toBe(QuotationStatus.APPROVED);
    // Competing open quotes under the lead are superseded/rejected
    expect(mockTx.quotation.updateMany).toHaveBeenCalledWith({
      where: {
        leadId: 'lead-123',
        id: { not: 'q-v1' },
        status: {
          in: [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
        },
        deletedAt: null,
      },
      data: {
        status: QuotationStatus.REJECTED,
        updatedById: 'user-1',
      },
    });
    // Lead advanced to QUALIFIED
    expect(mockTx.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-123' },
      data: {
        status: 'QUALIFIED',
        updatedById: 'user-1',
      },
    });
  });

  it('rejects acceptance if another quote under the same lead is ALREADY accepted', async () => {
    const targetQuote = {
      id: 'q-v2',
      quotationCode: 'QTN-0001-V2',
      status: QuotationStatus.DRAFT,
      leadId: 'lead-123',
    };

    const competingAccepted = {
      id: 'q-v1',
      quotationCode: 'QTN-0001-V1',
      status: QuotationStatus.APPROVED,
      leadId: 'lead-123',
    };

    mockTx.quotation.findFirst
      .mockResolvedValueOnce(targetQuote)
      .mockResolvedValueOnce(competingAccepted); // Already accepted quote exists!

    await expect(service.execute('q-v2', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects acceptance if quotation is already expired or rejected', async () => {
    mockTx.quotation.findFirst.mockResolvedValueOnce({
      id: 'q-expired',
      status: QuotationStatus.EXPIRED,
    });

    await expect(service.execute('q-expired', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});

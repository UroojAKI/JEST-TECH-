import { Test, TestingModule } from '@nestjs/testing';
import { BackOfficeQueueService } from './back-office-queue.service';
import { PrismaService } from '../../../../database/prisma.service';
import {
  QuotationStatus,
  InspectionStatus,
  DocumentVerificationStatus,
  Prisma,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('BackOfficeQueueService (G021 Multi-Gate Policy Issuance Queue)', () => {
  let service: BackOfficeQueueService;
  let prisma: PrismaService;

  const mockPrisma = {
    quotation: {
      findMany: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackOfficeQueueService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BackOfficeQueueService>(BackOfficeQueueService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const baseQuote = {
    id: 'quote-100',
    quotationCode: 'QT-2026-001',
    status: QuotationStatus.APPROVED,
    workflowState: 'PAYMENT_DONE',
    totalPremium: new Prisma.Decimal(25000),
    productType: 'MOTOR',
    insurerName: 'ICICI Lombard',
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: {
      firstName: 'Vikram',
      lastName: 'Malhotra',
      phone: '9812345678',
      email: 'vikram@example.com',
    },
    createdBy: {
      id: 'agent-1',
      firstName: 'Sunil',
      lastName: 'Kumar',
    },
    policy: null,
    motorMetadata: {
      registrationNumber: 'MH02CB1234',
    },
    motorInspection: null,
    motorPaymentRecord: {
      status: 'PAID',
      amount: new Prisma.Decimal(25000),
      referenceNumber: 'UPI-123456',
    },
    motorPreviousPolicy: null,
  };

  it('evaluates all gates as PASSED when quote is complete with verified payment and waived inspection', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        verificationStatus: DocumentVerificationStatus.VERIFIED,
      },
    ]);

    const result = await service.getBackOfficeQueue();

    expect(result.data).toHaveLength(1);
    const item = result.data[0];
    expect(item.allGatesPassed).toBe(true);
    expect(item.gates.customer.passed).toBe(true);
    expect(item.gates.vehicle.passed).toBe(true);
    expect(item.gates.inspection.passed).toBe(true);
    expect(item.gates.payment.passed).toBe(true);
    expect(item.gates.documents.passed).toBe(true);
    expect(item.nextAction).toBe('Ready to Issue Policy');
    expect(result.summary.readyCount).toBe(1);
  });

  it('blocks issuance when vehicle inspection is required but not completed', async () => {
    const quoteWithBreakIn = {
      ...baseQuote,
      workflowState: 'INSPECTION_REQUIRED',
      motorInspection: {
        status: InspectionStatus.IN_PROGRESS,
      },
      motorPreviousPolicy: {
        ruleEvaluation: {
          inspectionRequired: true,
        },
      },
    };

    mockPrisma.quotation.findMany.mockResolvedValue([quoteWithBreakIn]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const result = await service.getBackOfficeQueue();

    const item = result.data[0];
    expect(item.allGatesPassed).toBe(false);
    expect(item.gates.inspection.passed).toBe(false);
    expect(item.nextAction).toContain('Inspection');
    expect(result.summary.blockedCount).toBe(1);
  });

  it('blocks issuance when payment is underpaid or missing', async () => {
    const unpaidQuote = {
      ...baseQuote,
      motorPaymentRecord: {
        status: 'UNDER_PROCESS',
        amount: new Prisma.Decimal(10000), // Required: 25000
      },
    };

    mockPrisma.quotation.findMany.mockResolvedValue([unpaidQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const result = await service.getBackOfficeQueue();

    const item = result.data[0];
    expect(item.allGatesPassed).toBe(false);
    expect(item.gates.payment.passed).toBe(false);
    expect(item.nextAction).toContain('Payment');
  });

  it('validateIssuanceGates throws BadRequestException when gates fail', async () => {
    const unpaidQuote = {
      ...baseQuote,
      motorPaymentRecord: null,
    };

    mockPrisma.quotation.findMany.mockResolvedValue([unpaidQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    await expect(service.validateIssuanceGates('quote-100')).rejects.toThrow(
      BadRequestException,
    );
  });
});

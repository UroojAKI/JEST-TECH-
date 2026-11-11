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
import { HealthDocumentRuleService } from '../../../health-insurance/services/health-document-rule.service';

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
        { provide: HealthDocumentRuleService, useValue: new HealthDocumentRuleService() },
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
      panNumber: 'ABCDE1234F',
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

  it('blocks approved health quotations while any linked health document is unverified', async () => {
    const healthQuote = {
      ...baseQuote,
      productType: 'HEALTH',
      healthCaseId: 'health-case-1',
      healthCase: {
        planCategory: 'INDIVIDUAL',
        policyForm: 'NEW_POLICY',
        documents: [
          {
            id: 'health-doc-pending',
            documentType: 'PROPOSAL_FORM',
            verificationStatus: DocumentVerificationStatus.PENDING,
          },
          {
            id: 'health-kyc-verified',
            documentType: 'KYC_DOCUMENTS',
            verificationStatus: DocumentVerificationStatus.VERIFIED,
          },
          {
            id: 'health-age-verified',
            documentType: 'AGE_PROOF',
            verificationStatus: DocumentVerificationStatus.VERIFIED,
          },
          {
            id: 'health-declaration-verified',
            documentType: 'GOOD_HEALTH_DECLARATION',
            verificationStatus: DocumentVerificationStatus.VERIFIED,
          },
        ],
      },
      healthDocuments: [],
    };

    mockPrisma.quotation.findMany.mockResolvedValue([healthQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const result = await service.getBackOfficeQueue();
    const item = result.data[0];

    expect(item.gates.documents.passed).toBe(false);
    expect(item.gates.documents.detail).toContain('Required health documents not verified');
    expect(item.allGatesPassed).toBe(false);
    expect(item.nextAction).not.toBe('Ready to Issue Policy');
  });

  it('blocks approved health quotations when a mandatory case document is missing or pending', async () => {
    const healthQuote = {
      ...baseQuote,
      productType: 'HEALTH',
      healthCaseId: 'health-case-1',
      healthCase: {
        planCategory: 'INDIVIDUAL',
        policyForm: 'NEW_POLICY',
        documents: [
          {
            id: 'proposal-pending',
            documentType: 'PROPOSAL_FORM',
            verificationStatus: DocumentVerificationStatus.PENDING,
          },
        ],
      },
      healthDocuments: [],
    };

    mockPrisma.quotation.findMany.mockResolvedValue([healthQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const result = await service.getBackOfficeQueue();
    const item = result.data[0];

    expect(item.gates.documents.passed).toBe(false);
    expect(item.gates.documents.detail).toContain('Required health documents not verified');
    expect(item.allGatesPassed).toBe(false);
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

  it('searches insurer and vehicle/customer fields before computing queue totals', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const matched = await service.getBackOfficeQueue({ search: 'icici' });
    expect(matched.data).toHaveLength(1);
    expect(matched.summary.totalPending).toBe(1);

    const unmatched = await service.getBackOfficeQueue({ search: 'no-such-insurer' });
    expect(unmatched.data).toHaveLength(0);
    expect(unmatched.summary.totalPending).toBe(0);
    expect(unmatched.summary.readyCount).toBe(0);
    expect(unmatched.summary.blockedCount).toBe(0);
  });

  it('passes the selected product type into the tenant-scoped quotation query', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    await service.getBackOfficeQueue({ productType: 'MOTOR', page: 1, limit: 10 });

    expect(mockPrisma.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productType: 'MOTOR' }),
      }),
    );
  });

  it('returns newest-first server-side pages and counts from the filtered population', async () => {
    const older = { ...baseQuote, id: 'quote-older', quotationCode: 'QT-2026-000' , createdAt: new Date('2026-01-01') };
    const newer = { ...baseQuote, id: 'quote-newer', quotationCode: 'QT-2026-002', createdAt: new Date('2026-02-01') };
    mockPrisma.quotation.findMany.mockResolvedValue([newer, older]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const result = await service.getBackOfficeQueue({ page: 2, limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('quote-older');
    expect(result.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(result.summary.totalPending).toBe(2);
    expect(result.summary.readyCount + result.summary.blockedCount).toBe(2);
  });

  it('validateIssuanceGates throws BadRequestException when payment gate fails', async () => {
    const unpaidQuote = {
      ...baseQuote,
      motorPaymentRecord: null,
    };

    mockPrisma.quotation.findMany.mockResolvedValue([unpaidQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    await expect(service.validateIssuanceGates('quote-100')).rejects.toThrow(
      /Payment Gate/,
    );
  });

  it('validateIssuanceGates throws BadRequestException when customer KYC gate fails', async () => {
    const missingKycQuote = {
      ...baseQuote,
      contact: { ...baseQuote.contact, phone: null, email: null },
    };

    mockPrisma.quotation.findMany.mockResolvedValue([missingKycQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    await expect(service.validateIssuanceGates('quote-100')).rejects.toThrow(
      /Customer Gate/,
    );
  });

  it('validateIssuanceGates throws BadRequestException when vehicle plate gate fails', async () => {
    const missingVehicleQuote = {
      ...baseQuote,
      motorMetadata: {},
    };

    mockPrisma.quotation.findMany.mockResolvedValue([missingVehicleQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    await expect(service.validateIssuanceGates('quote-100')).rejects.toThrow(
      /Vehicle Gate/,
    );
  });

  it('validateIssuanceGates throws BadRequestException when inspection gate fails', async () => {
    const inspectionQuote = {
      ...baseQuote,
      workflowState: 'INSPECTION_REQUIRED',
      motorInspection: { status: InspectionStatus.PENDING },
    };

    mockPrisma.quotation.findMany.mockResolvedValue([inspectionQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    await expect(service.validateIssuanceGates('quote-100')).rejects.toThrow(
      /Inspection Gate/,
    );
  });

  it('validateIssuanceGates throws BadRequestException when document gate fails', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockResolvedValue([
      { id: 'doc-1', verificationStatus: DocumentVerificationStatus.PENDING },
    ]);

    await expect(service.validateIssuanceGates('quote-100')).rejects.toThrow(
      /Documents Gate/,
    );
  });

  it('validateIssuanceGates succeeds when all 5 gates pass', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockResolvedValue([
      { id: 'doc-1', verificationStatus: DocumentVerificationStatus.VERIFIED },
    ]);

    const result = await service.validateIssuanceGates('quote-100');
    expect(result.allowed).toBe(true);
    expect(result.quotationCode).toBe(baseQuote.quotationCode);
  });
});

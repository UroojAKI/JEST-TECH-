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

  it('includes issued policies in the issued metric without returning them as pending', async () => {
    const issuedQuote = {
      ...baseQuote,
      id: 'quote-issued',
      quotationCode: 'QT-ISSUED-001',
      status: QuotationStatus.CONVERTED_TO_POLICY,
      policy: { id: 'policy-issued', policyNumber: 'POL-001' },
    };
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote, issuedQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);
    const result = await service.getBackOfficeQueue();
    expect(result.data).toHaveLength(1);
    expect(result.summary.totalPending).toBe(1);
    expect(result.summary.issuedCount).toBe(1);
  });

  it('preserves branch isolation alongside status OR filters', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);
    await service.getBackOfficeQueue({
      companyId: 'company-1',
      branchId: 'branch-1',
      role: RoleType.AGENT,
      userId: 'agent-1',
    } as any);
    const query = mockPrisma.quotation.findMany.mock.calls[0][0];
    expect(query.where.companyId).toBe('company-1');
    expect(query.where.AND).toEqual([{
      OR: [
        { createdBy: { branchId: 'branch-1' } },
        { contact: { branchId: 'branch-1' } },
      ],
    }]);
    expect(query.where.OR).toEqual(expect.arrayContaining([
      { status: { in: expect.any(Array) } },
      { issuanceStatus: 'ISSUANCE_PENDING' },
    ]));
  });

  it('fails closed when an authenticated actor has no company context', async () => {
    await expect(service.getBackOfficeQueue({
      branchId: 'branch-1',
      role: RoleType.AGENT,
      userId: 'agent-1',
    } as any)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.quotation.findMany).not.toHaveBeenCalled();
  });

  it('applies product filtering and server-side pagination before returning queue rows', async () => {
    const older = { ...baseQuote, id: 'quote-older', quotationCode: 'QT-2026-000', createdAt: new Date('2026-01-01') };
    const newer = { ...baseQuote, id: 'quote-newer', quotationCode: 'QT-2026-002', createdAt: new Date('2026-02-01') };
    mockPrisma.quotation.findMany.mockResolvedValue([newer, older]);
    mockPrisma.document.findMany.mockResolvedValue([]);
    const result = await service.getBackOfficeQueue({ productType: 'MOTOR', page: 2, limit: 1 });
    expect(mockPrisma.quotation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ productType: 'MOTOR' }),
      orderBy: { createdAt: 'desc' },
    }));
    expect(result.data.map((item) => item.id)).toEqual(['quote-older']);
    expect(result.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(result.summary.totalPending).toBe(2);
  });

  it('surfaces document query failures instead of silently passing the document gate', async () => {
    mockPrisma.quotation.findMany.mockResolvedValue([baseQuote]);
    mockPrisma.document.findMany.mockRejectedValue(new Error('document store unavailable'));
    await expect(service.getBackOfficeQueue()).rejects.toThrow(InternalServerErrorException);
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

  it('enriches queue items with complete motor policy, pricing, vehicle, KYC-masked customer and address details', async () => {
    const richMotorQuote = {
      ...baseQuote,
      policyType: 'PACKAGE',
      vehicleCategory: 'PRIVATE_CAR',
      policyTenure: 1,
      sumInsured: new Prisma.Decimal(625000),
      basePremium: new Prisma.Decimal(21186),
      gstAmount: new Prisma.Decimal(3814),
      totalPremium: new Prisma.Decimal(25000),
      discountAmount: new Prisma.Decimal(1500),
      ncbPercentage: 25,
      calculationSnapshot: {
        outputs: {
          od: { net: 15000, addons: 2186 },
          tp: { net: 4000 },
        },
      },
      case: { id: 'case-1', caseCode: 'MC-2026-001', status: 'QUOTED' },
      contact: {
        ...baseQuote.contact,
        panNumber: 'ABCDE1234F',
        customer: {
          addressLine1: '12 MG Road',
          city: 'Belagavi',
          state: 'Karnataka',
          pincode: '590001',
        },
      },
      vehicle: {
        registrationNumber: 'KA22AB1234',
        makeModel: 'Hyundai Creta SX',
        fuelType: 'Petrol',
        engineNumber: 'ENG9988',
        chassisNumber: 'CHS776655',
      },
      motorPreviousPolicy: {
        previousPolicyType: 'COMPREHENSIVE',
        previousInsurerName: 'ICICI Lombard',
        previousPolicyNumber: 'PREV-001',
        ruleEvaluation: { inspectionRequired: false },
      },
    };

    mockPrisma.quotation.findMany.mockResolvedValue([richMotorQuote]);
    mockPrisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        documentType: 'RC_COPY',
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        fileName: 'rc.pdf',
      },
    ]);

    const result = await service.getBackOfficeQueue();
    const item = result.data[0];

    expect(item.policyType).toBe('PACKAGE');
    expect(item.sumInsured).toBe(625000);
    expect(item.basePremium).toBe(21186);
    expect(item.gstAmount).toBe(3814);
    expect(item.odPremium).toBe(15000);
    expect(item.tpPremium).toBe(4000);
    expect(item.ncbPercentage).toBe(25);
    expect(item.calculationValid).toBe(true);
    expect(item.caseId).toBe('case-1');
    expect(item.caseCode).toBe('MC-2026-001');
    expect(item.panMasked).toBe('XXXXX1234F');
    expect(item.panMasked).not.toBe('ABCDE1234F');
    expect(item.customerAddress).toContain('Belagavi');
    expect(item.customerPincode).toBe('590001');
    expect(item.vehicleDetails?.makeModel).toBe('Hyundai Creta SX');
    expect(item.vehicleDetails?.engineNumber).toBe('ENG9988');
    expect(item.previousPolicy?.previousInsurerName).toBe('ICICI Lombard');
    expect(item.documents).toHaveLength(1);
  });

  it('extracts dynamic health plan and member details and supports status=ISSUED without changing default queue counts', async () => {
    const issuedHealthQuote = {
      ...baseQuote,
      id: 'quote-issued-1',
      quotationCode: 'QT-HLT-001',
      productType: 'HEALTH',
      healthCaseId: 'hcase-1',
      title: 'Optima Secure Plan',
      sumInsured: new Prisma.Decimal(1000000),
      healthCase: {
        caseCode: 'HC-2026-001',
        planCategory: 'FAMILY_FLOATER',
        policyForm: 'NEW_POLICY',
        nomineeName: 'Anita Sharma',
        nomineeRelation: 'SPOUSE',
        members: [
          { firstName: 'Ramesh', relation: 'SELF', gender: 'MALE' },
          { firstName: 'Anita', relation: 'SPOUSE', gender: 'FEMALE' },
        ],
        documents: [],
      },
      policy: {
        id: 'pol-1',
        policyNumber: 'POL-INT-1',
        actualPolicyNumber: 'HDFC-HLT-999',
        status: 'ACTIVE',
        premiumAmount: new Prisma.Decimal(25000),
        effectiveDate: new Date('2026-11-01'),
        expiryDate: new Date('2027-10-31'),
        policyTenure: 1,
      },
    };

    mockPrisma.quotation.findMany.mockResolvedValue([issuedHealthQuote]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const defaultRes = await service.getBackOfficeQueue();
    expect(defaultRes.data).toHaveLength(0);
    expect(defaultRes.summary.issuedCount).toBe(1);

    const issuedRes = await service.getBackOfficeQueue({ status: 'ISSUED' });
    expect(issuedRes.data).toHaveLength(1);
    expect(issuedRes.data[0].healthDetails?.planCategory).toBe('FAMILY_FLOATER');
    expect(issuedRes.data[0].healthDetails?.memberCount).toBe(2);
    expect(issuedRes.data[0].healthDetails?.nomineeName).toBe('Anita Sharma');
    expect(issuedRes.data[0].issuedPolicy?.policyNumber).toBe('HDFC-HLT-999');
  });
});

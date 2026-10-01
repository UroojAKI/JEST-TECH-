import { Test, TestingModule } from '@nestjs/testing';
import { MotorWorkflowGatesService } from './motor-workflow-gates.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoleType, InspectionStatus, Prisma } from '@prisma/client';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

describe('MotorWorkflowGatesService', () => {
  let service: MotorWorkflowGatesService;
  let prisma: any;

  const mockActorBO: ActorContext = {
    userId: 'user-bo-1',
    email: 'bo@jest.test',
    firstName: 'Back',
    lastName: 'Office',
    organizationId: 'comp-1',
    companyId: 'comp-1',
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    permissions: [],
    workspaces: [],
    status: 'ACTIVE' as any,
  };

  const mockActorAgent: ActorContext = {
    userId: 'user-agent-1',
    email: 'agent@jest.test',
    firstName: 'Sales',
    lastName: 'Agent',
    organizationId: 'comp-1',
    companyId: 'comp-1',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: [],
    workspaces: [],
    status: 'ACTIVE' as any,
  };

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
      },
      motorRuleEvaluation: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorWorkflowGatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MotorWorkflowGatesService>(MotorWorkflowGatesService);
  });

  it('should throw NotFoundException if quotation does not exist', async () => {
    prisma.quotation.findUnique.mockResolvedValue(null);

    await expect(
      service.getWorkflowProjection('non-existent', 'comp-1', mockActorBO),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if companyId does not match', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'quote-1',
      companyId: 'comp-2',
    });

    await expect(
      service.getWorkflowProjection('quote-1', 'comp-1', mockActorBO),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should block issuance when calculation or KYC is not complete', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'quote-1',
      quotationCode: 'QT-1001',
      companyId: 'comp-1',
      sumInsured: new Prisma.Decimal(500000),
      totalPremium: new Prisma.Decimal(15000),
      calculationSnapshot: null, // Invalid calculation
      contact: {
        panNumber: null, // No KYC
      },
      account: null,
      vehicle: { status: 'OLD' },
      motorInspection: null,
      motorPaymentRecord: null,
      proposal: null,
      motorDocuments: [],
      policy: null,
      workflowState: 'DRAFT',
      issuanceStatus: 'DRAFT',
    });
    prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: false });

    const projection = await service.getWorkflowProjection(
      'quote-1',
      'comp-1',
      mockActorBO,
    );

    expect(projection.canIssue).toBe(false);
    expect(projection.blockingGates.calculationValid).toBe(false);
    expect(projection.blockingGates.kycVerified).toBe(false);
    expect(projection.blockingReasons).toContain(
      'Quotation premium calculation has not been finalized',
    );
    expect(projection.blockingReasons).toContain(
      'Customer KYC status is pending or unverified',
    );
  });

  it('should block issuance when inspection is required but not completed', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'quote-2',
      quotationCode: 'QT-1002',
      companyId: 'comp-1',
      sumInsured: new Prisma.Decimal(500000),
      totalPremium: new Prisma.Decimal(15000),
      calculationSnapshot: { base: 12000 },
      contact: { panNumber: 'ABCDE1234F' },
      account: { kycStatus: 'VERIFIED' },
      vehicle: { status: 'OLD' },
      motorInspection: {
        status: InspectionStatus.REQUIRED,
      },
      motorPaymentRecord: null,
      proposal: { status: 'APPROVED' },
      motorDocuments: [{ verificationStatus: 'VERIFIED' }],
      policy: null,
      workflowState: 'INSPECTION_REQUIRED',
      issuanceStatus: 'DRAFT',
    });
    prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: true });

    const projection = await service.getWorkflowProjection(
      'quote-2',
      'comp-1',
      mockActorBO,
    );

    expect(projection.canIssue).toBe(false);
    expect(projection.blockingGates.inspectionCleared).toBe(false);
    expect(projection.canonicalState).toBe('PENDING_INSPECTION');
    expect(projection.allowedActions).toContain('PERFORM_INSPECTION');
  });

  it('should block issuance when payment amount does not match authoritative premium', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'quote-3',
      quotationCode: 'QT-1003',
      companyId: 'comp-1',
      sumInsured: new Prisma.Decimal(500000),
      totalPremium: new Prisma.Decimal(15000.5),
      calculationSnapshot: { base: 12000 },
      contact: { panNumber: 'ABCDE1234F' },
      account: { kycStatus: 'VERIFIED' },
      vehicle: { status: 'NEW' },
      motorInspection: null,
      motorPaymentRecord: {
        status: 'PAID',
        amount: new Prisma.Decimal(15000.0), // 50 paise mismatch!
      },
      proposal: { status: 'APPROVED' },
      motorDocuments: [],
      policy: null,
      workflowState: 'PAYMENT_PENDING',
      issuanceStatus: 'DRAFT',
    });
    prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: false });

    const projection = await service.getWorkflowProjection(
      'quote-3',
      'comp-1',
      mockActorBO,
    );

    expect(projection.canIssue).toBe(false);
    expect(projection.blockingGates.paymentVerified).toBe(false);
    expect(projection.blockingReasons).toContain(
      'Paid amount does not match authoritative quotation premium',
    );
  });

  it('should allow Back Office to issue policy when all gates are satisfied', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'quote-4',
      quotationCode: 'QT-1004',
      companyId: 'comp-1',
      sumInsured: new Prisma.Decimal(500000),
      totalPremium: new Prisma.Decimal(15000),
      calculationSnapshot: { base: 12000 },
      contact: { panNumber: 'ABCDE1234F' },
      account: { kycStatus: 'VERIFIED' },
      vehicle: { status: 'OLD' },
      motorInspection: {
        status: InspectionStatus.COMPLETED,
      },
      motorPaymentRecord: {
        status: 'PAID',
        amount: new Prisma.Decimal(15000),
      },
      proposal: { status: 'APPROVED' },
      motorDocuments: [{ verificationStatus: 'VERIFIED' }],
      policy: null,
      workflowState: 'PAYMENT_DONE',
      issuanceStatus: 'ISSUANCE_PENDING',
    });
    prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: true });

    const projection = await service.getWorkflowProjection(
      'quote-4',
      'comp-1',
      mockActorBO,
    );

    expect(projection.canIssue).toBe(true);
    expect(projection.canonicalState).toBe('PENDING_ISSUANCE');
    expect(projection.blockingReasons).toHaveLength(0);
    expect(projection.allowedActions).toContain('ISSUE_POLICY');
  });

  it('should NEVER allow Agent role to issue policy even if all gates are satisfied', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      id: 'quote-5',
      quotationCode: 'QT-1005',
      companyId: 'comp-1',
      sumInsured: new Prisma.Decimal(500000),
      totalPremium: new Prisma.Decimal(15000),
      calculationSnapshot: { base: 12000 },
      contact: { panNumber: 'ABCDE1234F' },
      account: { kycStatus: 'VERIFIED' },
      vehicle: { status: 'OLD' },
      motorInspection: {
        status: InspectionStatus.COMPLETED,
      },
      motorPaymentRecord: {
        status: 'PAID',
        amount: new Prisma.Decimal(15000),
      },
      proposal: { status: 'APPROVED' },
      motorDocuments: [{ verificationStatus: 'VERIFIED' }],
      policy: null,
      workflowState: 'PAYMENT_DONE',
      issuanceStatus: 'ISSUANCE_PENDING',
    });
    prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: true });

    const projection = await service.getWorkflowProjection(
      'quote-5',
      'comp-1',
      mockActorAgent,
    );

    expect(projection.canIssue).toBe(false);
    expect(projection.allowedActions).not.toContain('ISSUE_POLICY');
  });
});

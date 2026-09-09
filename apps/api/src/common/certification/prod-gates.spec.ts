import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PolicyStatus, QuotationStatus, RoleType, NotificationPriority, RenewalTaskStatus } from '@prisma/client';
import { IssuePolicyService } from '../../modules/policies/services/commands/issue-policy.service';
import { PolicyRepository } from '../../modules/policies/repositories/policy.repository';
import { QuotationRepository } from '../../modules/quotation/repositories/quotation.repository';
import { PdfService } from '../../modules/quotation/engine/pdf.service';
import { PolicyDomainService } from '../../modules/policies/domain/policy.domain-service';
import { PrismaService } from '../../database/prisma.service';
import { OutboxService } from '../../modules/platform/outbox/outbox.service';
import { BackOfficeQueueService } from '../../modules/policies/services/queries/back-office-queue.service';
import { CACHE_PROVIDER_TOKEN } from '../../modules/platform/cache/cache.provider';
import { MotorCalculationService } from '../../modules/motor/services/motor-calculation.service';
import { MotorTariffService } from '../../modules/motor/services/motor-tariff.service';
import { QuotationCompletionService } from '../../modules/quotation/services/queries/quotation-completion.service';
import { RenewalScheduler } from '../../modules/platform/notifications/services/renewal-scheduler.service';
import { NotificationDispatcher } from '../../modules/platform/notifications/services/notification-dispatcher.service';

/**
 * PRODUCTION RELEASE GATES & NEGATIVE SAFETY INVARIANT TEST SUITE (§55, §57, §58)
 *
 * Purged of all synthetic local helper closures. Tests execute directly against
 * authoritative domain services: IssuePolicyService, MotorCalculationService,
 * QuotationCompletionService, BackOfficeQueueService, and RenewalScheduler.
 */
describe('Authoritative Production Gates & Negative Safety Invariants (INV-01 to INV-18)', () => {
  let issuePolicyService: IssuePolicyService;
  let motorCalculationService: MotorCalculationService;
  let quotationCompletionService: QuotationCompletionService;
  let renewalScheduler: RenewalScheduler;

  // Mock dependencies
  let mockPrisma: any;
  let mockQuotationRepo: any;
  let mockPolicyRepo: any;
  let mockBackOfficeQueue: any;
  let mockPdfService: any;
  let mockOutboxService: any;
  let mockTariffService: any;
  let mockDispatcher: any;

  beforeEach(async () => {
    mockPrisma = {
      policy: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({
          id: 'pol-uuid-1',
          policyNumber: args.data.policyNumber || 'POL-2026-000001',
          ...args.data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      motorPaymentRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-uuid-1',
          quotationId: 'quote-valid-1',
          amount: 17638.88,
          referenceNumber: 'TXN-RAZORPAY-998811',
          paymentMethod: 'ONLINE_UPI',
          status: 'PAID',
        }),
      },
      quotation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      renewalConfiguration: {
        findFirst: jest.fn().mockResolvedValue({
          isActive: true,
          lookAheadDays: 60,
          reminderOffsets: [45, 30, 15, 7, 0, -1],
        }),
      },
      renewalTask: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => ({ id: 'rt-1', ...args.data })),
      },
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      lead: {
        update: jest.fn().mockResolvedValue({}),
      },
      leadStageHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      insurerPolicyDetail: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb) => {
        const tx = {
          policy: mockPrisma.policy,
          quotation: mockPrisma.quotation,
          lead: mockPrisma.lead,
          leadStageHistory: mockPrisma.leadStageHistory,
          renewalTask: mockPrisma.renewalTask,
          insurerPolicyDetail: mockPrisma.insurerPolicyDetail,
        };
        return cb(tx);
      }),
    };

    mockQuotationRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'quote-valid-1',
        quotationCode: 'QTN-2026-001234',
        status: QuotationStatus.APPROVED,
        policyStartDate: new Date('2026-10-01T00:00:00.000Z'),
        policyEndDate: new Date('2027-09-30T23:59:59.999Z'),
        expiryDate: new Date('2026-12-31T23:59:59.999Z'),
        totalPremium: 17638.88,
        basePremium: 14948.20,
        gstAmount: 2690.68,
        sumInsured: 500000,
        insurerName: 'HDFC ERGO General Insurance Co.',
        registrationNumber: 'MH02CB1234',
        chassisNumber: 'MA3EWKD1S00123456',
        engineNumber: 'K12MN1234567',
        contactId: 'cnt-uuid-1',
        leadId: 'lead-uuid-1',
        contact: {
          id: 'cnt-uuid-1',
          firstName: 'Aarav',
          lastName: 'Patel',
          phone: '+919876543210',
        },
        lead: {
          id: 'lead-uuid-1',
          assignedToId: 'usr-agent-1',
          currentWorkflowStep: 'PAYMENT',
        },
      }),
      update: jest.fn().mockResolvedValue({}),
    };

    mockPolicyRepo = {
      generatePolicyNumber: jest.fn().mockResolvedValue('POL-2026-000001'),
      create: jest.fn().mockResolvedValue({
        id: 'pol-uuid-1',
        policyNumber: 'POL-2026-000001',
        status: PolicyStatus.ACTIVE,
        quotationId: 'quote-valid-1',
        contactId: 'cnt-uuid-1',
        premiumAmount: 17638.88,
        effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
        expiryDate: new Date('2027-09-30T23:59:59.999Z'),
      }),
      addDocument: jest.fn().mockResolvedValue({}),
      addHistoryEntry: jest.fn().mockResolvedValue({}),
      findDetail: jest.fn().mockResolvedValue({
        id: 'pol-uuid-1',
        policyNumber: 'POL-2026-000001',
        status: PolicyStatus.ACTIVE,
        quotationId: 'quote-valid-1',
        contactId: 'cnt-uuid-1',
        premiumAmount: 17638.88,
        effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
        expiryDate: new Date('2027-09-30T23:59:59.999Z'),
      }),
    };

    mockBackOfficeQueue = {
      validateIssuanceGates: jest.fn().mockResolvedValue(true),
    };

    mockPdfService = {
      generateDocumentPdf: jest.fn().mockResolvedValue({
        fileKey: 'docs/policies/POL-2026-000001.pdf',
        fileName: 'POL-2026-000001.pdf',
        fileSize: 1048576,
      }),
    };

    mockOutboxService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    mockTariffService = {
      lookupTpTariff: jest.fn().mockResolvedValue({
        found: true,
        annualPremium: 3416,
        tariffId: 'tariff-pc-2026',
        isVerified: true,
      }),
    };

    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuePolicyService,
        QuotationCompletionService,
        RenewalScheduler,
        MotorCalculationService,
        PolicyDomainService,
        { provide: PolicyRepository, useValue: mockPolicyRepo },
        { provide: QuotationRepository, useValue: mockQuotationRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BackOfficeQueueService, useValue: mockBackOfficeQueue },
        { provide: PdfService, useValue: mockPdfService },
        { provide: OutboxService, useValue: mockOutboxService },
        { provide: MotorTariffService, useValue: mockTariffService },
        { provide: NotificationDispatcher, useValue: mockDispatcher },
        {
          provide: CACHE_PROVIDER_TOKEN,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    issuePolicyService = module.get<IssuePolicyService>(IssuePolicyService);
    quotationCompletionService = module.get<QuotationCompletionService>(QuotationCompletionService);
    renewalScheduler = module.get<RenewalScheduler>(RenewalScheduler);
    motorCalculationService = module.get<MotorCalculationService>(MotorCalculationService);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 1: POLICY ISSUANCE AUTHORITY & NEGATIVE SAFETY INVARIANTS (INV-01 to INV-10)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Group 1: Authoritative Policy Issuance Gates (IssuePolicyService)', () => {
    const validDto = {
      quotationId: 'quote-valid-1',
      effectiveDate: '2026-10-01T00:00:00.000Z',
      expiryDate: '2027-09-30T23:59:59.999Z',
      nominees: [
        { firstName: 'Sunita', lastName: 'Patel', relation: 'SPOUSE', percentage: 100 },
      ],
    };

    it('INV-01: rejects policy issuance when quotationId is omitted', async () => {
      await expect(
        issuePolicyService.execute({} as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-02: rejects policy issuance when quotation is in DRAFT status', async () => {
      mockQuotationRepo.findById.mockResolvedValueOnce({
        id: 'quote-valid-1',
        status: QuotationStatus.DRAFT,
      });

      await expect(
        issuePolicyService.execute(validDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-03: rejects policy issuance when quotation has expired', async () => {
      mockQuotationRepo.findById.mockResolvedValueOnce({
        id: 'quote-valid-1',
        status: QuotationStatus.APPROVED,
        expiryDate: new Date('2025-01-01T00:00:00.000Z'),
      });

      await expect(
        issuePolicyService.execute(validDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-04: rejects policy issuance when motor payment record is missing or not PAID', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValueOnce(null);

      await expect(
        issuePolicyService.execute(validDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-05: rejects policy issuance when payment amount mismatches quotation total', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValueOnce({
        id: 'pay-uuid-1',
        quotationId: 'quote-valid-1',
        amount: 5000, // Partial / tampered payment
        referenceNumber: 'TXN-TAMPERED',
        status: 'PAID',
      });

      await expect(
        issuePolicyService.execute(validDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-06: rejects policy issuance when nominees are missing or total percentage != 100', async () => {
      const invalidNomineesDto = {
        ...validDto,
        nominees: [
          { firstName: 'Sunita', lastName: 'Patel', relation: 'SPOUSE', percentage: 70 },
        ],
      };

      await expect(
        issuePolicyService.execute(invalidNomineesDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-07: rejects policy issuance with backdated effective date earlier than today', async () => {
      mockQuotationRepo.findById.mockResolvedValueOnce({
        id: 'quote-valid-1',
        status: QuotationStatus.APPROVED,
        policyStartDate: new Date('2020-01-01T00:00:00.000Z'),
        policyEndDate: new Date('2021-01-01T00:00:00.000Z'),
        expiryDate: new Date('2026-12-31T00:00:00.000Z'),
        totalPremium: 17638.88,
        contact: { firstName: 'Test' },
      });

      const backdatedDto = {
        ...validDto,
        effectiveDate: '2020-01-01T00:00:00.000Z',
        expiryDate: '2021-01-01T00:00:00.000Z',
      };

      await expect(
        issuePolicyService.execute(backdatedDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-08: rejects policy issuance when expiryDate is <= effectiveDate', async () => {
      mockQuotationRepo.findById.mockResolvedValueOnce({
        id: 'quote-valid-1',
        status: QuotationStatus.APPROVED,
        policyStartDate: new Date('2026-10-01T00:00:00.000Z'),
        policyEndDate: new Date('2026-09-01T00:00:00.000Z'),
        expiryDate: new Date('2026-12-31T00:00:00.000Z'),
        totalPremium: 17638.88,
        contact: { firstName: 'Test' },
      });

      const invertedDto = {
        ...validDto,
        effectiveDate: '2026-10-01T00:00:00.000Z',
        expiryDate: '2026-09-01T00:00:00.000Z',
      };

      await expect(
        issuePolicyService.execute(invertedDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-09: rejects policy issuance when chassis, engine, or registration number is missing', async () => {
      mockQuotationRepo.findById.mockResolvedValueOnce({
        id: 'quote-valid-1',
        status: QuotationStatus.APPROVED,
        policyStartDate: new Date('2026-10-01T00:00:00.000Z'),
        policyEndDate: new Date('2027-09-30T23:59:59.999Z'),
        expiryDate: new Date('2026-12-31T00:00:00.000Z'),
        totalPremium: 17638.88,
        registrationNumber: null, // Missing!
        chassisNumber: null,
        engineNumber: null,
        contact: { firstName: 'Test' },
      });

      await expect(
        issuePolicyService.execute(validDto as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-10: blocks duplicate policy issuance on the same quotationId with ConflictException', async () => {
      mockPrisma.policy.findUnique.mockResolvedValueOnce({
        id: 'existing-pol',
        policyNumber: 'POL-2026-000001',
      });

      await expect(
        issuePolicyService.execute(validDto as any, 'usr-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 2: FINANCIAL & CALCULATION ENGINE INVARIANTS (INV-11 to INV-14)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Group 2: Motor Calculation Server Authority (MotorCalculationService)', () => {
    it('INV-11: ignores client-provided totalPremium and recalculates server-authoritatively', async () => {
      const clientTamperedPayload: any = {
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 20,
        discountPercent: 10,
        paCover: true,
        totalPremium: 99.99, // Malicious client attempt to forge premium
      };

      const result = await motorCalculationService.calculate(clientTamperedPayload);
      expect(result.outputs.totalPremium).toBe(17638.88);
      expect(result.outputs.totalPremium).not.toBe(clientTamperedPayload.totalPremium);
    });

    it('INV-12: rejects Standalone OD (SAOD) calculation when active TP details are absent', async () => {
      await expect(
        motorCalculationService.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'STANDALONE_OD',
          idv: 400000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-13: rejects excessive commercial discount (> 20%) without approvalReference', async () => {
      await expect(
        motorCalculationService.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          discountPercent: 35,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('INV-14: resets NCB discount to 0 if a claim occurred in expiring policy', async () => {
      const result = await motorCalculationService.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 300000,
        ncbPercent: 50,
        claimInExpiringPolicy: true,
      });

      expect(result.inputs.effectiveNcb).toBe(0);
      expect(result.outputs.ncbDiscount).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 3: PROGRESSIVE QUOTATION COMPLETION ENGINE (INV-15 to INV-17)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Group 3: Progressive Quotation Completion Engine (QuotationCompletionService)', () => {
    it('INV-15: accurately calculates dynamic checklist and marks incomplete when fields are missing', async () => {
      mockPrisma.quotation.findFirst.mockResolvedValueOnce({
        id: 'q-incomplete-1',
        quotationCode: 'QTN-INC-001',
        status: QuotationStatus.DRAFT,
        contact: { firstName: 'John', lastName: null, phone: null }, // Missing KYC
        vehicle: null, // Missing Vehicle
        motorPreviousPolicy: null,
        motorInspection: null,
        motorPaymentRecord: null,
        documents: [],
        saodVerification: null,
        sumInsured: 300000,
        totalPremium: 10000,
      });

      const completion = await quotationCompletionService.getCompletion('q-incomplete-1');
      expect(completion.status).toBe('INCOMPLETE');
      expect(completion.completionPercentage).toBeLessThan(100);
      expect(completion.canIssuePolicy).toBe(false);

      const customerSection = completion.sections.find((s) => s.section === 'customer');
      expect(customerSection?.complete).toBe(false);
      expect(customerSection?.missing.length).toBeGreaterThan(0);
    });

    it('INV-16: enforces canIssuePolicy === false until all criteria reach 100%', async () => {
      mockPrisma.quotation.findFirst.mockResolvedValueOnce({
        id: 'q-99pct-1',
        quotationCode: 'QTN-99-001',
        status: QuotationStatus.APPROVED,
        contact: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+919876543210',
          email: 'john@example.com',
          panNumber: 'ABCDE1234F',
          address: 'Mumbai',
        },
        vehicle: {
          registrationNumber: 'MH01AB1234',
          chassisNumber: 'CHAS123',
          engineNumber: 'ENG123',
          make: 'Maruti',
          model: 'Swift',
          manufactureYear: 2024,
        },
        sumInsured: 500000,
        totalPremium: 15000,
        motorPaymentRecord: null, // Unpaid!
        documents: [],
        saodVerification: null,
      });

      const completion = await quotationCompletionService.getCompletion('q-99pct-1');
      expect(completion.canIssuePolicy).toBe(false);
      const paymentSection = completion.sections.find((s) => s.section === 'payment');
      expect(paymentSection?.complete).toBe(false);
    });

    it('INV-17: blocks policy issuance when back-office inspection gate fails', async () => {
      mockBackOfficeQueue.validateIssuanceGates.mockRejectedValueOnce(
        new BadRequestException('Vehicle inspection is required and must be APPROVED prior to policy issuance.'),
      );

      await expect(
        issuePolicyService.execute({ quotationId: 'quote-insp-fail' } as any, 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUP 4: DURABLE RENEWAL ENGINE (INV-18)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Group 4: Renewal Scheduler & Offset Invariants (RenewalScheduler)', () => {
    it('INV-18: creates renewal tasks with authoritative offsets [45, 30, 15, 7, 0, -1] and escalates priority', async () => {
      const expiringPolicy = {
        id: 'pol-exp-1',
        status: PolicyStatus.ACTIVE,
        createdById: 'usr-agent-1',
        expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Expiring in 10 days
        deletedAt: null,
        contact: { firstName: 'Renewal', lastName: 'Customer' },
      };

      mockPrisma.policy.findMany.mockResolvedValueOnce([expiringPolicy]);

      await renewalScheduler.runRenewalScheduler();

      // Verify that renewalTask.create was called with offsetDays and priority
      expect(mockPrisma.renewalTask.create).toHaveBeenCalled();
      const calls = mockPrisma.renewalTask.create.mock.calls;
      expect(calls.length).toBe(6); // 6 configured offsets: 45, 30, 15, 7, 0, -1

      const offset0Call = calls.find((c: any) => c[0].data.offsetDays === 0);
      expect(offset0Call).toBeDefined();
      expect(offset0Call[0].data.priority).toBe(NotificationPriority.CRITICAL);

      const offset7Call = calls.find((c: any) => c[0].data.offsetDays === 7);
      expect(offset7Call).toBeDefined();
      expect(offset7Call[0].data.priority).toBe(NotificationPriority.HIGH);

      const offset30Call = calls.find((c: any) => c[0].data.offsetDays === 30);
      expect(offset30Call).toBeDefined();
      expect(offset30Call[0].data.priority).toBe(NotificationPriority.MEDIUM);
    });
  });
});

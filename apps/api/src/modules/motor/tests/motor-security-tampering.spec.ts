import { Test, TestingModule } from '@nestjs/testing';
import { MotorQuotationCaseService } from '../services/motor-quotation-case.service';
import { MotorQuotationDocumentService } from '../services/motor-quotation-document.service';
import { MotorQuoteWorkflowService } from '../services/motor-quote-workflow.service';
import { CreateMotorQuotationCommand } from '../../quotation/services/commands/create-motor-quotation.command';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorRuleEngineService } from '../services/motor-rule-engine.service';
import { ContactsService } from '../../contacts/services/contacts.service';
import { VehicleDataService } from '../services/vehicle-data.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { MotorPolicyDateService } from '../services/motor-policy-date.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  MotorWorkflowState,
  MotorDocumentType,
  RoleType,
} from '@prisma/client';

describe('Phase 8: Motor Security & Financial Tampering Gates', () => {
  let caseService: MotorQuotationCaseService;
  let docService: MotorQuotationDocumentService;
  let workflowService: MotorQuoteWorkflowService;
  let createQuoteCommand: CreateMotorQuotationCommand;
  let calcService: any;
  let prisma: any;
  let tenantAuthService: any;

  const tenantA: any = {
    id: 'user-tenant-a',
    companyId: 'company-a',
    role: RoleType.AGENT,
  };

  const tenantB: any = {
    id: 'user-tenant-b',
    companyId: 'company-b',
    role: RoleType.AGENT,
  };

  beforeEach(async () => {
    prisma = {
      motorQuotationCase: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      quotation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      document: {
        findFirst: jest.fn(),
      },
      motorQuotationDocument: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      quotationHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      motorJourney: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      lead: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
      },
      agent: {
        findFirst: jest.fn(),
      },
      motorPreviousPolicy: {
        create: jest.fn(),
        upsert: jest.fn(),
      },
      motorRuleEvaluation: {
        upsert: jest.fn(),
      },
      motorInspection: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      backOfficeTask: {
        upsert: jest.fn(),
      },
      outboxEvent: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    calcService = {
      calculate: jest.fn().mockResolvedValue({
        inputs: {
          effectiveNcb: 20,
        },
        outputs: {
          basePremium: 10000,
          totalGst: 1800,
          totalPremium: 11800,
          grossBasePremium: 10000,
          totalDiscount: 0,
          netCustomerPremium: 10000,
          baseOdPremium: 8000,
          baseTpPremium: 2000,
          od: { gross: 8000, ncbDiscount: 0, specialDiscount: 0, addons: 0, net: 8000, gst: 1440 },
          tp: { base: 2000, discount: 0, net: 2000, gst: 360 },
          pa: { premium: 0, gst: 0 },
          summary: { grossPremium: 10000, totalDiscount: 0, netPremium: 10000, totalGst: 1800, finalPayable: 11800 },
        },
      }),
    };

    tenantAuthService = {
      assertTenantResource: jest.fn().mockResolvedValue(true),
      assertMotorJourneyAccess: jest.fn().mockResolvedValue({
        id: 'j-1',
        companyId: 'company-a',
        actorId: 'user-tenant-a',
        status: 'IN_PROGRESS',
        expiresAt: new Date(Date.now() + 3600000),
        quotationId: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorQuotationCaseService,
        MotorQuotationDocumentService,
        MotorQuoteWorkflowService,
        CreateMotorQuotationCommand,
        { provide: PrismaService, useValue: prisma },
        { provide: MotorCalculationService, useValue: calcService },
        {
          provide: MotorRuleEngineService,
          useValue: {
            evaluateQuotation: jest.fn().mockReturnValue({
              ncb: 20,
              inspectionRequired: false,
              inspectionReasons: [],
              nextStep: 'QUOTATION',
            }),
          },
        },
        {
          provide: ContactsService,
          useValue: { create: jest.fn().mockResolvedValue({ id: 'c-new' }) },
        },
        {
          provide: VehicleDataService,
          useValue: { upsertVehicle: jest.fn().mockResolvedValue({ id: 'v-1' }) },
        },
        {
          provide: NumberingEngineService,
          useValue: {
            generateNext: jest.fn().mockResolvedValue('MQT-000001'),
          },
        },
        {
          provide: MotorPolicyDateService,
          useValue: {
            getBusinessToday: jest.fn().mockReturnValue(new Date()),
            daysBetween: jest.fn().mockReturnValue(0),
          },
        },
        {
          provide: TenantResourceAuthorizationService,
          useValue: tenantAuthService,
        },
      ],
    }).compile();

    caseService = module.get<MotorQuotationCaseService>(MotorQuotationCaseService);
    docService = module.get<MotorQuotationDocumentService>(MotorQuotationDocumentService);
    workflowService = module.get<MotorQuoteWorkflowService>(MotorQuoteWorkflowService);
    createQuoteCommand = module.get<CreateMotorQuotationCommand>(CreateMotorQuotationCommand);
  });

  describe('BOLA / IDOR Cross-Tenant Isolation', () => {
    it('Tenant B cannot read Tenant A motor quotation case (404/403 fail-closed)', async () => {
      prisma.motorQuotationCase.findFirst.mockResolvedValue(null);

      await expect(caseService.getCase('case-tenant-a', tenantB)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.motorQuotationCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-tenant-a', companyId: tenantB.companyId },
        }),
      );
    });

    it('Tenant B cannot select winning quotation for Tenant A case', async () => {
      prisma.motorQuotationCase.findFirst.mockResolvedValue(null);

      await expect(
        caseService.selectQuotation('case-tenant-a', 'quote-1', tenantB),
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot compare quotes of Tenant A case', async () => {
      prisma.motorQuotationCase.findFirst.mockResolvedValue(null);

      await expect(
        caseService.compareCaseQuotations('case-tenant-a', tenantB),
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot attach documents to Tenant A quotation', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null);

      await expect(
        docService.attachDocument(
          'quote-tenant-a',
          { documentId: 'doc-1', documentType: MotorDocumentType.INSURER_QUOTE },
          tenantB,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant A cannot attach Tenant B document to its quotation (IDOR on documentId)', async () => {
      prisma.quotation.findFirst.mockResolvedValue({ id: 'quote-a', companyId: tenantA.companyId });
      // Document belongs to Tenant B
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        docService.attachDocument(
          'quote-a',
          { documentId: 'doc-tenant-b', documentType: MotorDocumentType.INSURER_QUOTE },
          tenantA,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot transition Tenant A quotation workflow state', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null);

      await expect(
        workflowService.transitionWorkflowState(
          'quote-tenant-a',
          MotorWorkflowState.PAYMENT_PENDING,
          { userId: tenantB.id, companyId: tenantB.companyId, role: tenantB.role },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Financial Tampering Prevention & Server Authority', () => {
    it('Client manipulated totalPremium is strictly ignored in favor of server calculation', async () => {
      prisma.quotation.create.mockImplementation((args: any) => ({
        id: 'q-tamper-total',
        quotationCode: 'QTN-TAMPER-1',
        totalPremium: args.data.totalPremium,
        gstAmount: args.data.gstAmount,
        basePremium: args.data.basePremium,
      }));

      const res = await createQuoteCommand.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          contactId: 'c-1',
          ncbPercentage: 20,
          totalPremium: 10, // Client tries to pay ₹10 instead of calculated ₹11,800!
          gstAmount: 0,     // Client tries to bypass statutory GST
          basePremium: 10,  // Client tries to bypass base premium
          vehicleDetails: { vehicleStatus: 'EXISTING' },
        },
        tenantA,
      );

      // Verify that server calculation was persisted, NOT the client tampered numbers
      expect(prisma.quotation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalPremium: 11800, // Authoritative from calcService
            gstAmount: 1800,     // Authoritative from calcService
            basePremium: 10000,  // Authoritative from calcService
          }),
        }),
      );
      expect(res.totalPremium).toBe(11800);
    });

    it('Client non-standard NCB percentage is rejected with 400 Bad Request', async () => {
      await expect(
        createQuoteCommand.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'c-1',
            ncbPercentage: 42, // Tampered non-standard slab
            vehicleDetails: { vehicleStatus: 'EXISTING' },
          },
          tenantA,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

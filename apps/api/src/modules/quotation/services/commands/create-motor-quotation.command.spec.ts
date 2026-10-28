import { Test, TestingModule } from '@nestjs/testing';
import { CreateMotorQuotationCommand } from './create-motor-quotation.command';
import { PrismaService } from '../../../../database/prisma.service';
import { MotorCalculationService } from '../../../motor/services/motor-calculation.service';
import { MotorRuleEngineService } from '../../../motor/services/motor-rule-engine.service';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { VehicleDataService } from '../../../motor/services/vehicle-data.service';
import { NumberingEngineService } from '../../../administration/services/numbering-engine/numbering-engine.service';
import { TenantResourceAuthorizationService } from '../../../auth/services/tenant-resource-authorization.service';
import { RoleType } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('CreateMotorQuotationCommand (Authoritative Command)', () => {
  let command: CreateMotorQuotationCommand;
  let prisma: any;
  let calcService: any;
  let ruleEngine: any;
  let contactsService: any;
  let vehicleService: any;
  let numberingEngine: any;
  let tenantAuthService: any;

  const mockUser: any = {
    id: 'user-agent-1',
    companyId: 'company-1',
    role: RoleType.AGENT,
  };

  beforeEach(async () => {
    prisma = {
      motorJourney: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      lead: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      contact: {
        findFirst: jest.fn(),
      },
      agent: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ collectContacts: false }),
        findUnique: jest.fn().mockResolvedValue({ collectContacts: false }),
      },
      quotation: {
        create: jest.fn(),
      },
      saodTpVerification: {
        create: jest.fn().mockResolvedValue({ id: 'saod-verification-1' }),
      },
      motorPreviousPolicy: {
        create: jest.fn(),
      },
      motorQuotationCase: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'case-auto-1', status: 'QUOTED' }),
        update: jest.fn().mockResolvedValue({ id: 'case-1', status: 'QUOTED' }),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    calcService = {
      calculate: jest.fn().mockResolvedValue({
        inputs: { effectiveNcb: 0, tpTenure: 1 },
        outputs: {
          basePremium: 10000,
          totalGst: 1800,
          totalPremium: 11800,
        },
        calculationVersion: 'motor-v5',
        authoritativeDates: {
          odStartDate: '2026-09-26',
          odEndDate: '2027-09-25',
          tpStartDate: '2026-09-26',
          tpEndDate: '2027-09-25',
          effectiveStartDate: '2026-09-26',
          effectiveEndDate: '2027-09-25',
        },
      }),
    };

    ruleEngine = {
      evaluateQuotation: jest.fn().mockReturnValue({
        inspectionRequired: false,
        ncb: 0,
      }),
      validateSaodEligibility: jest.fn().mockImplementation((params) => {
        if (params.vehicleStatus === 'NEW') {
          throw new BadRequestException('Standalone OD is not applicable for new vehicles. New vehicles must purchase bundled or package coverage.');
        }
        return { valid: true };
      }),
    };

    contactsService = {
      create: jest.fn().mockResolvedValue({ id: 'contact-new-1' }),
    };

    vehicleService = {
      upsertVehicle: jest.fn().mockResolvedValue({ id: 'veh-upserted-1' }),
      checkVehicleRunningPolicy: jest.fn().mockResolvedValue({ hasExisting: false }),
    };

    numberingEngine = {
      generateNext: jest.fn().mockResolvedValue('QTN-2026-000001'),
    };

    tenantAuthService = {
      assertTenantResource: jest.fn().mockImplementation((type, id, actor) => {
        if (id.includes('other-tenant')) {
          throw new ForbiddenException(`Cross-tenant access forbidden for ${type}`);
        }
        return Promise.resolve({ id, companyId: actor.companyId });
      }),
      assertAssignableAgent: jest.fn().mockImplementation((agentId, actor) => {
        if (agentId.includes('other-tenant')) {
          throw new ForbiddenException('Cross-tenant agent assignment forbidden');
        }
        return Promise.resolve({ id: agentId, companyId: actor.companyId, isActive: true });
      }),
      assertMotorJourneyAccess: jest.fn().mockImplementation((journeyId, actor) => {
        if (journeyId.includes('other-tenant') || journeyId.includes('other-user')) {
          throw new ForbiddenException('Cross-tenant or unauthorized motor journey access is forbidden');
        }
        return Promise.resolve({
          id: journeyId,
          companyId: actor.companyId,
          actorId: actor.id,
          status: 'IN_PROGRESS',
          expiresAt: new Date(Date.now() + 3600000),
          quotationId: null,
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateMotorQuotationCommand,
        { provide: PrismaService, useValue: prisma },
        { provide: MotorCalculationService, useValue: calcService },
        { provide: MotorRuleEngineService, useValue: ruleEngine },
        { provide: ContactsService, useValue: contactsService },
        { provide: VehicleDataService, useValue: vehicleService },
        { provide: NumberingEngineService, useValue: numberingEngine },
        { provide: TenantResourceAuthorizationService, useValue: tenantAuthService },
      ],
    }).compile();

    command = module.get<CreateMotorQuotationCommand>(
      CreateMotorQuotationCommand,
    );
  });

  it('MOTOR-REG-19: should execute single transactional quotation creation and bind journey 1:1', async () => {
    prisma.quotation.create.mockResolvedValue({
      id: 'q-created-1',
      quotationCode: 'QTN-2026-000001',
      totalPremium: 11800,
      workflowState: 'READY_FOR_PROPOSAL',
      status: 'DRAFT',
      createdAt: new Date(),
    });

    const result = await command.execute(
      {
        journeyId: 'j-1',
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        insurerName: 'HDFC ERGO',
        registrationNumber: 'MH02CB1234',
        contactId: 'c-1',
      },
      mockUser,
    );

    expect(result.id).toBe('q-created-1');
    expect(prisma.motorJourney.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: { quotationId: 'q-created-1', status: 'QUOTED' },
    });
  });

  it('A1: Journey Hijacking Prevention — should reject when journey belongs to another user/tenant', async () => {
    await expect(
      command.execute(
        {
          journeyId: 'j-other-user',
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
        },
        mockUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('A2: Journey Reuse Prevention — should reject when journey already captured a quotation (1:1 constraint)', async () => {
    tenantAuthService.assertMotorJourneyAccess.mockResolvedValueOnce({
      id: 'j-already-quoted',
      companyId: 'company-1',
      actorId: 'user-agent-1',
      status: 'IN_PROGRESS',
      expiresAt: new Date(Date.now() + 3600000),
      quotationId: 'existing-quote-id',
    });

    await expect(
      command.execute(
        {
          journeyId: 'j-already-quoted',
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
        },
        mockUser,
      ),
    ).rejects.toThrow(ConflictException);
  });

  describe('Phase 1.2: Cross-Tenant Resource Rejection Tests', () => {
    it('Tenant A -> Tenant A lead PASS', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-same-tenant', contactId: 'contact-1' });
      prisma.quotation.create.mockResolvedValue({
        id: 'q-lead-ok',
        quotationCode: 'QTN-2026-000002',
        totalPremium: 11800,
      });

      const res = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          leadId: 'lead-same-tenant',
        },
        mockUser,
      );

      expect(res.id).toBe('q-lead-ok');
      expect(tenantAuthService.assertTenantResource).toHaveBeenCalledWith('Lead', 'lead-same-tenant', mockUser);
    });

    it('Tenant A -> Tenant B lead 403', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            leadId: 'lead-other-tenant',
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tenant A -> Tenant B contact 403', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'contact-other-tenant',
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tenant A -> Tenant B agent 403', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'c-1',
            agentId: 'agent-other-tenant',
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tenant A -> Tenant B vehicle 403', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'c-1',
            vehicleId: 'vehicle-other-tenant',
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tenant A -> Tenant B customer 403', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'c-1',
            customerId: 'customer-other-tenant',
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('MOTOR-REG-02: Manual agent mode should set agentId to null and persist validated manualAgent snapshot', async () => {
    prisma.quotation.create.mockImplementation((args: any) =>
      Promise.resolve({
        id: 'q-manual-agent',
        quotationCode: 'QTN-2026-000003',
        ...args.data,
      }),
    );

    const result = await command.execute(
      {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        insurerName: 'HDFC ERGO',
        contactId: 'c-1',
        manualAgent: {
          isManual: true,
          name: 'Direct Walk-in Broker',
          code: 'BRK-999',
          contact: '+919876543210',
        },
      },
      mockUser,
    );

    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: null,
          motorMetadata: expect.objectContaining({
            manualAgent: expect.objectContaining({
              name: 'Direct Walk-in Broker',
              code: 'BRK-999',
            }),
          }),
        }),
      }),
    );
  });

  it('persists confirmed SAOD TP verification against the quotation and records the authenticated verifier', async () => {
    prisma.quotation.create.mockResolvedValue({
      id: 'q-saod-1',
      quotationCode: 'QTN-2026-SAOD-1',
      totalPremium: 11800,
      workflowState: 'READY_FOR_PROPOSAL',
      status: 'DRAFT',
      createdAt: new Date(),
    });

    calcService.calculate.mockResolvedValueOnce({
      inputs: { effectiveNcb: 0, tpTenure: 1 },
      outputs: {
        basePremium: 8002,
        totalGst: 1200,
        totalPremium: 8500,
        finalPayableAmount: 8500,
      },
      calculationVersion: 'motor-v5',
      authoritativeDates: {
        odStartDate: '2026-10-19',
        odEndDate: '2027-10-18',
        effectiveStartDate: '2026-10-19',
        effectiveEndDate: '2027-10-18',
      },
    });

    const saodVerification = {
      tpInsurer: 'TATA AIG',
      tpPolicyNumber: 'TP-123456',
      tpStartDate: '2026-01-01',
      tpExpiryDate: '2027-12-31',
      verificationMethod: 'POLICY_DOCUMENT',
      verificationStatus: 'VERIFIED',
      verifiedByUserConfirmed: true,
      evidenceDocumentUrl: 'https://evidence.example.test/tp-policy.pdf',
      verifierNotes: 'Checked against submitted TP document',
    };

    await command.execute(
      {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'SAOD',
        insurerName: 'HDFC ERGO',
        contactId: 'c-1',
        vehicleDetails: {
          vehicleStatus: 'EXISTING',
          registrationNumber: 'KA22AB1234',
        },
        saodVerification,
        policyDetails: {
          policyTenure: 1,
          insuredDeclaredValue: '500000',
          odPremiumAmount: '8002',
          ncbDiscountAmount: '200',
          addOnsPremium: '300',
          odPremiumNet: '7500',
          odGstAmount: '1440.36',
          totalPremiumInclGST: '9442.36',
          totalPremiumOverride: '8500',
        },
      },
      mockUser,
    );

    expect(calcService.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        policyType: 'STANDALONE_OD',
        activeTpInsurer: 'TATA AIG',
        activeTpPolicyNumber: 'TP-123456',
        activeTpStartDate: '2026-01-01',
        activeTpExpiryDate: '2027-12-31',
        activeTpVerificationMethod: 'POLICY_DOCUMENT',
        activeTpVerificationStatus: 'VERIFIED',
        activeTpVerifiedByUserConfirmed: true,
        odPremiumAmount: 8002,
        ncbDiscount: undefined,
        addonPremium: undefined,
        netOdPremium: undefined,
        gstAmount: undefined,
        totalPremiumOverride: 8500,
      }),
    );

    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalPremium: 8500 }),
      }),
    );

    expect(prisma.saodTpVerification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quotationId: 'q-saod-1',
        tpInsurer: 'TATA AIG',
        tpPolicyNumber: 'TP-123456',
        verificationStatus: 'VERIFIED',
        verificationMethod: 'POLICY_DOCUMENT',
        evidenceDocumentUrl: 'https://evidence.example.test/tp-policy.pdf',
        verifierNotes: 'Checked against submitted TP document',
        verifiedById: mockUser.id,
        verifiedAt: expect.any(Date),
      }),
    });
  });

  it('MOTOR-REG-03: should reject NEW vehicle with SAOD policy type', async () => {
    await expect(
      command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'SAOD',
          insurerName: 'HDFC ERGO',
          contactId: 'c-1',
          vehicleDetails: {
            vehicleStatus: 'NEW',
          },
        },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('MOTOR-V2-NCB: should reject invalid non-slab NCB percentage with 400 Bad Request', async () => {
    await expect(
      command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          contactId: 'c-1',
          ncbPercentage: 33, // Non-standard NCB slab
          vehicleDetails: {
            vehicleStatus: 'EXISTING',
          },
        },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('MOTOR-V2-CASE: should link quotation to MotorQuotationCase when caseId is provided', async () => {
    prisma.motorQuotationCase.findFirst.mockResolvedValue({ id: 'case-1', companyId: 'comp-test' });
    prisma.quotation.create.mockResolvedValue({
      id: 'q-with-case',
      quotationCode: 'QTN-2026-CASE-1',
      totalPremium: 11800,
      caseId: 'case-1',
    });

    const res = await command.execute(
      {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        insurerName: 'HDFC ERGO',
        contactId: 'c-1',
        caseId: 'case-1',
        ncbPercentage: 20,
        vehicleDetails: {
          vehicleStatus: 'EXISTING',
        },
      },
      mockUser,
    );

    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseId: 'case-1',
        }),
      }),
    );
    expect(res.caseId).toBe('case-1');
  });

  it('MOTOR-V2-CASE-STATUS: should reject quotation creation if case is CANCELLED or COMPLETED', async () => {
    prisma.motorQuotationCase.findFirst.mockResolvedValue({
      id: 'case-cancelled',
      companyId: 'comp-test',
      status: 'CANCELLED',
    });

    await expect(
      command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          contactId: 'c-1',
          caseId: 'case-cancelled',
          ncbPercentage: 20,
          vehicleDetails: { vehicleStatus: 'EXISTING' },
        },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('MOTOR-V2-CASE-ORPHAN: should auto-provision a parent MotorQuotationCase when caseId is omitted', async () => {
    prisma.quotation.create.mockResolvedValue({
      id: 'q-auto-case',
      quotationCode: 'QTN-2026-AUTOCASE-1',
      totalPremium: 11800,
      caseId: 'case-auto-1',
    });

    const res = await command.execute(
      {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        insurerName: 'HDFC ERGO',
        contactId: 'c-1',
        ncbPercentage: 20,
        vehicleDetails: { vehicleStatus: 'EXISTING' },
      },
      mockUser,
    );

    expect(prisma.motorQuotationCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'QUOTED',
          category: 'PRIVATE_CAR',
        }),
      }),
    );
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseId: 'case-auto-1',
        }),
      }),
    );
    expect(res.caseId).toBe('case-auto-1');
  });

  it('MOTOR-V2-COMMISSION: strictly separates commission from discount in calculation inputs', async () => {
    prisma.quotation.create.mockResolvedValue({
      id: 'q-comm-ok',
      quotationCode: 'QTN-2026-COMM-1',
      totalPremium: 11800,
    });

    await command.execute(
      {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        insurerName: 'HDFC ERGO',
        contactId: 'c-1',
        ncbPercentage: 20,
        policyDetails: {
          odDiscountPercent: 5,
          odCommissionPercent: 15,
          tpCommissionPercent: 2.5,
        },
        vehicleDetails: {
          vehicleStatus: 'EXISTING',
        },
      },
      mockUser,
    );

    expect(calcService.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        discountPercent: 5,
        tpDiscountPercent: 0,
      }),
    );
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motorMetadata: expect.objectContaining({
            commissions: {
              odCommissionPercent: 15,
              tpCommissionPercent: 2.5,
            },
          }),
        }),
      }),
    );
  });

  describe('MOTOR-0042: Proposer details validation', () => {
    it('rejects invalid PAN format with 400 Bad Request', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'c-1',
            proposerDetails: {
              panNumber: 'INVALID_PAN_123',
            },
            vehicleDetails: { vehicleStatus: 'EXISTING' },
          },
          mockUser,
        ),
      ).rejects.toThrow('Invalid PAN format');
    });

    it('rejects invalid mobile number format with 400 Bad Request', async () => {
      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            contactId: 'c-1',
            proposerDetails: {
              mobileNumber: '12345',
            },
            vehicleDetails: { vehicleStatus: 'EXISTING' },
          },
          mockUser,
        ),
      ).rejects.toThrow('Invalid mobile number format');
    });
  });
  describe('Quotation Persistence & Reopen Rate/Total Fidelity', () => {
    it('persists multi-rate GST, add-ons with independent discounts, and signed commercial adjustment into quotation record', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', companyId: 'company-1', contactId: 'c-1' });
      prisma.quotation.create.mockImplementation(({ data }) => Promise.resolve({ id: 'q-persist-1', ...data }));

      const calcMockOutput = {
        inputs: { effectiveNcb: 0, tpTenure: 1 },
        outputs: {
          basePremium: 4525,
          totalGst: 814.5,
          totalPremium: 4864.5,
          odDiscountAmount: 300,
          tpDiscountAmount: 100,
          commercialDiscountAmount: 50,
          totalDiscountAmount: 475,
          payableSummary: {
            grossPremium: 4525,
            addonGrossPremium: 250,
            addonDiscountAmount: 25,
            commercialAdjustmentAmount: 50,
            commercialAdjustmentDirection: 'SUBTRACT',
            componentGstTotal: 814.5,
            finalPayableAmount: 4864.5,
          },
          gstBreakdown: {
            base: 'GROSS',
            od: { base: 3250, rate: 0.18, amount: 585 },
            tp: { base: 1000, rate: 0.18, amount: 180 },
            pa: { base: 275, rate: 0.18, amount: 49.5 },
            addons: { base: 250, taxableBase: 250, discount: 25, amount: 45 },
          },
        },
        rateConfig: {
          gstRatePercent: 18,
          odGstRatePercent: 18,
          tpGstRatePercent: 18,
          paGstRatePercent: 18,
        },
        calculationVersion: 'motor-v5',
        authoritativeDates: {
          effectiveStartDate: '2026-10-23',
          effectiveEndDate: '2027-10-22',
        },
      };

      calcService.calculate.mockResolvedValue(calcMockOutput);

      const quoteDto = {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        insurerName: 'TATA AIG',
        leadId: 'lead-1',
        contactId: 'c-1',
        vehicleDetails: { vehicleStatus: 'EXISTING', makeModel: 'Honda City' },
        policyDetails: {
          policyTenure: '1',
          gstRate: '18',
          odGstRate: '18',
          tpGstRate: '18',
          paCoverOwner: true,
          odDiscountPercent: '10',
          tpDiscountPercent: '10',
          commercialAdjustmentAmount: '50',
          commercialAdjustmentDirection: 'SUBTRACT',
          addonsSelected: ['PA_UNNAMED_PASSENGER'],
          addonPrices: { PA_UNNAMED_PASSENGER: '250' },
          addonDiscounts: { PA_UNNAMED_PASSENGER: '10' },
          addonGstRates: { PA_UNNAMED_PASSENGER: '18' },
        },
      };

      const result = await command.execute(quoteDto as any, mockUser);

      // Verify that calculation was called with properly formatted add-ons, discounts, and direction
      expect(calcService.calculate).toHaveBeenCalledWith(
        expect.objectContaining({
          policyType: 'PACKAGE_COMPREHENSIVE',
          policyTenure: 1,
          odDiscountPercent: 10,
          tpDiscountPercent: 10,
          commercialAdjustmentAmount: 50,
          commercialAdjustmentDirection: 'SUBTRACT',
          odGstRate: 18,
          tpGstRate: 18,
          addons: [
            expect.objectContaining({
              addonCode: 'PA_UNNAMED_PASSENGER',
              amount: 250,
              discountPercent: 10,
              gstRate: 18,
            }),
          ],
        }),
      );

      // Verify that prisma.quotation.create stored the exact calculationSnapshot and motorMetadata
      expect(prisma.quotation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          basePremium: 4525,
          gstAmount: 814.5,
          totalPremium: 4864.5,
          calculationSnapshot: calcMockOutput,
          motorMetadata: expect.objectContaining({
            discounts: expect.objectContaining({
              odDiscountAmount: 300,
              tpDiscountAmount: 100,
              addonDiscountAmount: 25,
              commercialAdjustmentAmount: 50,
              commercialAdjustmentDirection: 'SUBTRACT',
              totalDiscountAmount: 475,
            }),
            policyDetails: expect.objectContaining({
              addonPrices: { PA_UNNAMED_PASSENGER: '250' },
              addonDiscounts: { PA_UNNAMED_PASSENGER: '10' },
              addonGstRates: { PA_UNNAMED_PASSENGER: '18' },
            }),
          }),
        }),
      });

      expect(result.id).toBe('q-persist-1');
      expect(result.totalPremium).toBe(4864.5);
    });

    it('rejects creation with ConflictException when vehicle already has a policy running', async () => {
      vehicleService.checkVehicleRunningPolicy.mockResolvedValue({
        hasExisting: true,
        type: 'POLICY',
        policyNumber: '1206003126P111405370',
        renewalDate: new Date('2027-10-22'),
        formattedRenewalDate: '22/10/2027',
        message: 'Vehicle KA23TD0529 already has a policy running (1206003126P111405370). Renewal date is 22/10/2027.',
      });

      const quoteDto = {
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE',
        registrationNumber: 'KA23TD0529',
        leadId: 'lead-1',
        contactId: 'c-1',
      };

      await expect(command.execute(quoteDto as any, mockUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('Contact Collection Enforcement (CONTACT-COLLECTION)', () => {
    beforeEach(() => {
      prisma.quotation.create.mockResolvedValue({
        id: 'q-cc-test-1',
        quotationCode: 'QTN-CC-000001',
        totalPremium: 11800,
        workflowState: 'READY_FOR_PROPOSAL',
        status: 'DRAFT',
        createdAt: new Date(),
      });
    });

    it('CC-01: rejects quotation when assigned agent has collectContacts=true and customerName is missing', async () => {
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            agentId: 'agent-cc-1',
            proposerDetails: {
              customerName: '',
              mobileNumber: '9876543210',
            },
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CC-02: rejects when mobile number is missing and collectContacts=true', async () => {
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            agentId: 'agent-cc-1',
            proposerDetails: {
              customerName: 'John Doe',
              mobileNumber: '',
            },
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CC-03: allows quotation when collectContacts=true and all required details are present', async () => {
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      prisma.contact.findFirst.mockResolvedValue(null);

      const result = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          agentId: 'agent-cc-1',
          proposerDetails: {
            customerName: 'John Doe',
            mobileNumber: '9876543210',
          },
        },
        mockUser,
      );

      expect(result.id).toBe('q-cc-test-1');
      expect(contactsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'John' }),
        mockUser.id,
      );
    });

    it('CC-04: allows quotation when collectContacts=false and no customer details supplied', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ collectContacts: false });
      prisma.contact.findFirst.mockResolvedValue(null);

      const result = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          proposerDetails: {},
        },
        mockUser,
      );

      expect(result.id).toBe('q-cc-test-1');
      // Should have created a placeholder contact
      expect(contactsService.create).toHaveBeenCalled();
    });

    it('CC-05: client cannot bypass enforcement by sending collectContacts=false in payload', async () => {
      // The server reads from DB — client-supplied collectContacts field is ignored.
      // The DTO does not even have a collectContacts field; the server reads from DB.
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      // Server reads collectContacts=true from DB for agent
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      prisma.contact.findFirst.mockResolvedValue(null);

      // Even if client sends no name/mobile, the server must reject
      const err: any = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          agentId: 'agent-cc-1',
          proposerDetails: {
            customerName: '',
            mobileNumber: '',
          },
        },
        mockUser,
      ).catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.errorCode).toBe('CONTACT_COLLECTION_REQUIRED');
    });

    it('CC-06: manual agent uses OFF fallback regardless of payload', async () => {
      // Manual agents have no DB user record; enforcement must stay OFF
      prisma.contact.findFirst.mockResolvedValue(null);

      const result = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          manualAgent: {
            isManual: true,
            name: 'Walk-in Agent',
            code: 'WLK-001',
            contact: '+919876543210',
            source: 'DIRECT',
          },
          proposerDetails: {},
        },
        mockUser,
      );

      expect(result.id).toBe('q-cc-test-1');
      // No enforcement check ran for manual agent — contact creation proceeds normally
      expect(prisma.user.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { agentProfile: expect.anything() } }),
      );
    });

    it('CC-07: rejects quotation when mobile number is invalid (fewer than 10 digits)', async () => {
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        command.execute(
          {
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            insurerName: 'HDFC ERGO',
            agentId: 'agent-cc-1',
            proposerDetails: {
              customerName: 'John Doe',
              mobileNumber: '12345',
            },
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CC-08: allows quotation when collectContacts=true and existing linked contact provides valid details', async () => {
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      // Existing contact is linked
      prisma.contact.findFirst.mockResolvedValueOnce({
        id: 'c-valid-1',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '9876543210',
      });

      const result = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          agentId: 'agent-cc-1',
          contactId: 'c-valid-1',
          proposerDetails: {},
        },
        mockUser,
      );

      expect(result.id).toBe('q-cc-test-1');
    });

    it('CC-09: rejects quotation when collectContacts=true and existing linked contact is missing phone', async () => {
      tenantAuthService.assertAssignableAgent.mockResolvedValueOnce({
        id: 'agent-cc-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.user.findFirst.mockResolvedValueOnce({ collectContacts: true });
      // Existing contact is linked but has no phone
      prisma.contact.findFirst.mockResolvedValueOnce({
        id: 'c-invalid-1',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: null,
      });

      const err: any = await command.execute(
        {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
          agentId: 'agent-cc-1',
          contactId: 'c-invalid-1',
          proposerDetails: {},
        },
        mockUser,
      ).catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.errorCode).toBe('CONTACT_COLLECTION_REQUIRED');
    });
  });
});


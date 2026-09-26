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
      quotation: {
        create: jest.fn(),
      },
      motorPreviousPolicy: {
        create: jest.fn(),
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
    };

    contactsService = {
      create: jest.fn().mockResolvedValue({ id: 'contact-new-1' }),
    };

    vehicleService = {
      upsertVehicle: jest.fn().mockResolvedValue({ id: 'veh-upserted-1' }),
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
});

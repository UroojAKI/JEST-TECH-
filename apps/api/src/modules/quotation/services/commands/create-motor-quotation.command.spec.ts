import { Test, TestingModule } from '@nestjs/testing';
import { CreateMotorQuotationCommand } from './create-motor-quotation.command';
import { PrismaService } from '../../../../database/prisma.service';
import { MotorCalculationService } from '../../../motor/services/motor-calculation.service';
import { MotorRuleEngineService } from '../../../motor/services/motor-rule-engine.service';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { VehicleDataService } from '../../../motor/services/vehicle-data.service';
import { NumberingEngineService } from '../../../administration/services/numbering-engine/numbering-engine.service';
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
        update: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateMotorQuotationCommand,
        { provide: PrismaService, useValue: prisma },
        { provide: MotorCalculationService, useValue: calcService },
        { provide: MotorRuleEngineService, useValue: ruleEngine },
        { provide: ContactsService, useValue: contactsService },
        { provide: VehicleDataService, useValue: vehicleService },
        { provide: NumberingEngineService, useValue: numberingEngine },
      ],
    }).compile();

    command = module.get<CreateMotorQuotationCommand>(
      CreateMotorQuotationCommand,
    );
  });

  it('MOTOR-REG-19: should execute single transactional quotation creation and bind journey 1:1', async () => {
    prisma.motorJourney.findUnique.mockResolvedValue({
      id: 'j-1',
      companyId: 'company-1',
      actorId: 'user-agent-1',
      status: 'IN_PROGRESS',
      expiresAt: new Date(Date.now() + 3600000),
      quotationId: null,
    });

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
    prisma.motorJourney.findUnique.mockResolvedValue({
      id: 'j-1',
      companyId: 'other-company',
      actorId: 'other-user',
      status: 'IN_PROGRESS',
      expiresAt: new Date(Date.now() + 3600000),
      quotationId: null,
    });

    await expect(
      command.execute(
        {
          journeyId: 'j-1',
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
        },
        mockUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('A2: Journey Reuse Prevention — should reject when journey already captured a quotation (1:1 constraint)', async () => {
    prisma.motorJourney.findUnique.mockResolvedValue({
      id: 'j-1',
      companyId: 'company-1',
      actorId: 'user-agent-1',
      status: 'IN_PROGRESS',
      expiresAt: new Date(Date.now() + 3600000),
      quotationId: 'existing-quote-id', // Already captured!
    });

    await expect(
      command.execute(
        {
          journeyId: 'j-1',
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE',
          insurerName: 'HDFC ERGO',
        },
        mockUser,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('MOTOR-REG-02: Manual agent mode should set agentId to null and persist manualAgent snapshot in metadata', async () => {
    prisma.quotation.create.mockImplementation((args: any) =>
      Promise.resolve({
        id: 'q-manual-agent',
        quotationCode: 'QTN-2026-000002',
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

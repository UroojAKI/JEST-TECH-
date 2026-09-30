import { Test, TestingModule } from '@nestjs/testing';
import { MotorQuoteWorkflowService } from './motor-quote-workflow.service';
import { PrismaService } from '../../../database/prisma.service';
import { MotorRuleEngineService } from './motor-rule-engine.service';
import { MotorPolicyDateService } from './motor-policy-date.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import {
  MotorWorkflowState,
  InspectionStatus,
  VehicleStatus,
} from '@prisma/client';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('MotorQuoteWorkflowService (Authoritative State Machine)', () => {
  let service: MotorQuoteWorkflowService;
  let prisma: any;

  const mockActor = {
    userId: 'user-op-1',
    companyId: 'company-test-1',
    role: 'OPERATIONS',
  };

  beforeEach(async () => {
    prisma = {
      quotation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      quotationHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      motorInspection: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      motorInspectionHistory: {
        create: jest.fn(),
      },
      motorPreviousPolicy: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      motorRuleEvaluation: {
        upsert: jest.fn(),
      },
      backOfficeTask: {
        upsert: jest.fn(),
      },
      outboxEvent: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorQuoteWorkflowService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: MotorRuleEngineService,
          useValue: {
            evaluateQuotation: jest.fn(),
          },
        },
        {
          provide: MotorPolicyDateService,
          useValue: {
            getBusinessToday: jest.fn().mockReturnValue(new Date()),
            daysBetween: jest.fn().mockReturnValue(10),
          },
        },
        {
          provide: NumberingEngineService,
          useValue: {
            generateNext: jest.fn().mockResolvedValue('INSP-001'),
          },
        },
      ],
    }).compile();

    service = module.get<MotorQuoteWorkflowService>(MotorQuoteWorkflowService);
  });

  describe('validateTransition', () => {
    it('allows legal transitions (DRAFT -> READY_FOR_PROPOSAL)', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.DRAFT,
          MotorWorkflowState.READY_FOR_PROPOSAL,
          { vehicle: { status: VehicleStatus.NEW } },
        ),
      ).not.toThrow();
    });

    it('rejects illegal transition with ConflictException (DRAFT -> POLICY_ISSUED)', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.DRAFT,
          MotorWorkflowState.POLICY_ISSUED,
          {},
        ),
      ).toThrow(ConflictException);
    });

    it('blocks PAYMENT_PENDING if existing vehicle has no previous policy', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.READY_FOR_PROPOSAL,
          MotorWorkflowState.PAYMENT_PENDING,
          {
            vehicle: { status: VehicleStatus.EXISTING },
            motorPreviousPolicy: null,
          },
        ),
      ).toThrow(BadRequestException);
    });

    it('blocks PAYMENT_PENDING if inspection is REQUIRED but not COMPLETED', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.READY_FOR_PROPOSAL,
          MotorWorkflowState.PAYMENT_PENDING,
          {
            vehicle: { status: VehicleStatus.EXISTING },
            motorPreviousPolicy: { id: 'prev-1' },
            workflowState: MotorWorkflowState.INSPECTION_REQUIRED,
            motorInspection: { status: InspectionStatus.REQUIRED },
          },
        ),
      ).toThrow(BadRequestException);
    });

    it('permits PAYMENT_PENDING if inspection is COMPLETED', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.INSPECTION_COMPLETED,
          MotorWorkflowState.PAYMENT_PENDING,
          {
            vehicle: { status: VehicleStatus.EXISTING },
            motorPreviousPolicy: { id: 'prev-1' },
            motorInspection: { status: InspectionStatus.COMPLETED },
          },
        ),
      ).not.toThrow();
    });

    it('blocks PAYMENT_DONE if payment record is not PAID', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.PAYMENT_PENDING,
          MotorWorkflowState.PAYMENT_DONE,
          {
            motorPaymentRecord: { status: 'UNDER_PROCESS' },
          },
        ),
      ).toThrow(BadRequestException);
    });

    it('permits PAYMENT_DONE if payment record is PAID', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.PAYMENT_PENDING,
          MotorWorkflowState.PAYMENT_DONE,
          {
            motorPaymentRecord: { status: 'PAID' },
          },
        ),
      ).not.toThrow();
    });

    it('blocks POLICY_ISSUED if payment record is not PAID', () => {
      expect(() =>
        service.validateTransition(
          MotorWorkflowState.PAYMENT_DONE,
          MotorWorkflowState.POLICY_ISSUED,
          {
            motorPaymentRecord: null,
          },
        ),
      ).toThrow(ConflictException);
    });
  });

  describe('transitionWorkflowState', () => {
    it('throws NotFoundException if quotation does not belong to company', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null);

      await expect(
        service.transitionWorkflowState(
          'quote-foreign',
          MotorWorkflowState.READY_FOR_PROPOSAL,
          mockActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('transitions quotation state and logs quotationHistory', async () => {
      const mockQuote = {
        id: 'quote-1',
        companyId: mockActor.companyId,
        workflowState: MotorWorkflowState.DRAFT,
        vehicle: { status: VehicleStatus.NEW },
      };
      prisma.quotation.findFirst.mockResolvedValue(mockQuote);
      prisma.quotation.update.mockResolvedValue({
        ...mockQuote,
        workflowState: MotorWorkflowState.READY_FOR_PROPOSAL,
      });

      const result = await service.transitionWorkflowState(
        'quote-1',
        MotorWorkflowState.READY_FOR_PROPOSAL,
        mockActor,
        { reason: 'Customer details verified' },
      );

      expect(prisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: {
          workflowState: MotorWorkflowState.READY_FOR_PROPOSAL,
          updatedById: mockActor.userId,
        },
      });
      expect(prisma.quotationHistory.create).toHaveBeenCalledWith({
        data: {
          quotationId: 'quote-1',
          status: MotorWorkflowState.READY_FOR_PROPOSAL,
          comments: 'Customer details verified',
          createdById: mockActor.userId,
        },
      });
      expect(result.workflowState).toBe(MotorWorkflowState.READY_FOR_PROPOSAL);
    });
  });
});

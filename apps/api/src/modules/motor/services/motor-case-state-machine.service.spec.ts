import { Test, TestingModule } from '@nestjs/testing';
import { MotorCaseStateMachineService, CaseCommand } from './motor-case-state-machine.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MotorCaseStatus, RoleType } from '@prisma/client';

describe('MotorCaseStateMachineService (WF-009 Canonical 19-State Lifecycle)', () => {
  let service: MotorCaseStateMachineService;

  const mockPrisma = {
    motorQuotationCase: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockAdmin = {
    id: 'admin-1',
    companyId: 'comp-1',
    role: RoleType.ADMIN,
  };

  const mockBO = {
    id: 'bo-1',
    companyId: 'comp-1',
    role: RoleType.BACK_OFFICE,
  };
  const mockAgent = {
    id: 'agent-1',
    companyId: 'comp-1',
    role: RoleType.AGENT,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorCaseStateMachineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<MotorCaseStateMachineService>(MotorCaseStateMachineService);
  });

  describe('assertNoDirectStatusMutation', () => {
    it('succeeds when payload has no status property', () => {
      expect(() => service.assertNoDirectStatusMutation({ name: 'test' })).not.toThrow();
    });

    it('throws BadRequestException if status is directly submitted', () => {
      expect(() => service.assertNoDirectStatusMutation({ status: 'INSPECTION_APPROVED' })).toThrow(
        BadRequestException,
      );
    });
  });
  describe('transition', () => {
    it('executes VERIFY_CUSTOMER from DRAFT to CUSTOMER_VERIFIED', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: 'case-1',
        companyId: 'comp-1',
        status: MotorCaseStatus.DRAFT,
      });
      mockPrisma.motorQuotationCase.update.mockResolvedValue({
        id: 'case-1',
        status: MotorCaseStatus.CUSTOMER_VERIFIED,
      });

      const res = await service.transition(
        'case-1',
        'VERIFY_CUSTOMER',
        mockAgent as any,
      );

      expect(mockPrisma.motorQuotationCase.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: { status: MotorCaseStatus.CUSTOMER_VERIFIED },
        include: expect.any(Object),
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'case.transitioned',
        expect.objectContaining({
          caseId: 'case-1',
          companyId: 'comp-1',
          fromStatus: MotorCaseStatus.DRAFT,
          toStatus: MotorCaseStatus.CUSTOMER_VERIFIED,
          command: 'VERIFY_CUSTOMER',
        }),
      );
      expect(res.status).toBe(MotorCaseStatus.CUSTOMER_VERIFIED);
    });

   it('blocks illegal state transition with BadRequestException', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: 'case-1',
        companyId: 'comp-1',
        status: MotorCaseStatus.ISSUED,
      });

      await expect(
        service.transition('case-1', 'VERIFY_CUSTOMER', mockAdmin as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unauthorized role with ForbiddenException', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: 'case-1',
        companyId: 'comp-1',
        status: MotorCaseStatus.READY_FOR_ISSUANCE,
      });

      // Agents are not authorized to issue policies
      await expect(
        service.transition('case-1', 'ISSUE_POLICY', mockAgent as any),
      ).rejects.toThrow(ForbiddenException);
    });
    it('enforces Separation of Duty (SoD): creator cannot approve inspection', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: 'case-1',
        companyId: 'comp-1',
        status: MotorCaseStatus.INSPECTION_SUBMITTED,
        createdById: 'bo-1',
      });

      await expect(
        service.transition('case-1', 'APPROVE_INSPECTION', mockBO as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when case does not belong to actor tenant', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue(null);

      await expect(
        service.transition('case-999', 'VERIFY_CUSTOMER', mockAdmin as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe('getAvailableCommands', () => {
    it('returns VERIFY_CUSTOMER and CANCEL_CASE for admin on DRAFT', async () => {
      mockPrisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: 'case-1',
        companyId: 'comp-1',
        status: MotorCaseStatus.DRAFT,
      });

      const cmmds = await service.getAvailableCommands('case-1', mockAdmin as any);
      expect(cmmds).toContain('VERIFY_CUSTOMER');
      expect(cmmds).toContain('CANCEL_CASE');
      expect(cmmds).not.toContain('ISSUE_POLICY');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { MotorInspectionService } from './motor-inspection.service';
import { PrismaService } from '../../../database/prisma.service';
import { InspectionStatus, RoleType } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

describe('MotorInspectionService (Production State Machine & Role Segregation)', () => {
  let service: MotorInspectionService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn(async (cb) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
    ),
    quotation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    motorInspection: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    motorInspectionHistory: {
      create: jest.fn(),
    },
  };

  const createMockActor = (
    userId: string,
    role: RoleType,
    companyId = 'comp-1',
  ): ActorContext => ({
    userId,
    email: `${userId}@jest.com`,
    firstName: 'Test',
    lastName: 'User',
    organizationId: 'org-1',
    companyId,
    role,
    roles: [role],
    permissions: ['*'],
    workspaces: ['DEFAULT'],
    status: 'ACTIVE' as any,
  });

  const agentActor = createMockActor('agent-1', RoleType.AGENT);
  const backOfficeActor = createMockActor('bo-1', RoleType.BACK_OFFICE);
  const adminActor = createMockActor('admin-1', RoleType.ADMIN);

  const completePhotosInspection = {
    id: 'ins-1',
    inspectionCode: 'INS-0001',
    quotationId: 'q-100',
    companyId: 'comp-1',
    status: InspectionStatus.SUBMITTED_FOR_REVIEW,
    frontImageKey: 'photos/front.jpg',
    backImageKey: 'photos/back.jpg',
    leftImageKey: 'photos/left.jpg',
    rightImageKey: 'photos/right.jpg',
    windshieldImageKey: 'photos/windshield.jpg',
    chassisImageKey: 'photos/chassis.jpg',
    odometerImageKey: 'photos/odometer.jpg',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorInspectionService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide:
            require('../../administration/services/numbering-engine/numbering-engine.service')
              .NumberingEngineService,
          useValue: { generateNext: jest.fn().mockResolvedValue('INS-0001') },
        },
      ],
    }).compile();

    service = module.get<MotorInspectionService>(MotorInspectionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('State Machine Transitions (validateTransition)', () => {
    it('allows REQUIRED -> IN_PROGRESS on UPLOAD_PHOTO', () => {
      expect(
        service.validateTransition(
          InspectionStatus.REQUIRED,
          'UPLOAD_PHOTO',
          RoleType.AGENT,
        ),
      ).toBe(InspectionStatus.IN_PROGRESS);
    });

    it('allows IN_PROGRESS -> SUBMITTED_FOR_REVIEW on SUBMIT_FOR_REVIEW', () => {
      expect(
        service.validateTransition(
          InspectionStatus.IN_PROGRESS,
          'SUBMIT_FOR_REVIEW',
          RoleType.AGENT,
        ),
      ).toBe(InspectionStatus.SUBMITTED_FOR_REVIEW);
    });

    it('allows SUBMITTED_FOR_REVIEW -> COMPLETED on APPROVE for Back Office', () => {
      expect(
        service.validateTransition(
          InspectionStatus.SUBMITTED_FOR_REVIEW,
          'APPROVE',
          RoleType.BACK_OFFICE,
        ),
      ).toBe(InspectionStatus.COMPLETED);
    });

    it('blocks Agent from APPROVE with ForbiddenException', () => {
      expect(() =>
        service.validateTransition(
          InspectionStatus.SUBMITTED_FOR_REVIEW,
          'APPROVE',
          RoleType.AGENT,
        ),
      ).toThrow(ForbiddenException);
    });

    it('allows SUBMITTED_FOR_REVIEW -> REJECTED on REJECT for Back Office', () => {
      expect(
        service.validateTransition(
          InspectionStatus.SUBMITTED_FOR_REVIEW,
          'REJECT',
          RoleType.BACK_OFFICE,
        ),
      ).toBe(InspectionStatus.REJECTED);
    });

    it('allows SUBMITTED_FOR_REVIEW -> WAIVED on WAIVE for Admin', () => {
      expect(
        service.validateTransition(
          InspectionStatus.SUBMITTED_FOR_REVIEW,
          'WAIVE',
          RoleType.ADMIN,
        ),
      ).toBe(InspectionStatus.WAIVED);
    });

    it('allows REJECTED -> IN_PROGRESS on REWORK', () => {
      expect(
        service.validateTransition(
          InspectionStatus.REJECTED,
          'REWORK',
          RoleType.AGENT,
        ),
      ).toBe(InspectionStatus.IN_PROGRESS);
    });

    it('rejects any action from COMPLETED terminal state with ConflictException', () => {
      expect(() =>
        service.validateTransition(
          InspectionStatus.COMPLETED,
          'APPROVE',
          RoleType.ADMIN,
        ),
      ).toThrow(ConflictException);
      expect(() =>
        service.validateTransition(
          InspectionStatus.COMPLETED,
          'UPLOAD_PHOTO',
          RoleType.AGENT,
        ),
      ).toThrow(ConflictException);
    });
  });

  describe('submitForReview', () => {
    it('allows agent to submit when all 7 photos exist', async () => {
      const inProgressInspection = {
        ...completePhotosInspection,
        status: InspectionStatus.IN_PROGRESS,
      };

      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        inProgressInspection,
      );
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...inProgressInspection,
        status: InspectionStatus.SUBMITTED_FOR_REVIEW,
      });

      const res = await service.submitForReview('ins-1', agentActor);
      expect(res.status).toBe(InspectionStatus.SUBMITTED_FOR_REVIEW);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({ workflowState: 'INSPECTION_REQUIRED' }),
      });
    });

    it('rejects submission if photos are missing', async () => {
      const incompleteInspection = {
        ...completePhotosInspection,
        status: InspectionStatus.IN_PROGRESS,
        odometerImageKey: null,
      };

      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        incompleteInspection,
      );

      await expect(
        service.submitForReview('ins-1', agentActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveInspection', () => {
    it('rejects approval if approver is the quotation creator (segregation of duties)', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        quotation: {
          id: 'q-100',
          createdById: 'bo-1',
          motorMetadata: {},
        },
      });
      mockPrisma.quotation.findUnique.mockResolvedValue({
        id: 'q-100',
        createdById: 'bo-1',
      });

      // bo-1 created the quote, so bo-1 cannot approve it
      await expect(
        service.approveInspection('ins-1', {
          ...backOfficeActor,
          userId: 'bo-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Back Office to approve an inspection submitted for review', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        quotation: { id: 'q-100', createdById: 'agent-1', motorMetadata: {} },
      });
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.COMPLETED,
      });

      const res = await service.approveInspection('ins-1', backOfficeActor);
      expect(res.status).toBe(InspectionStatus.COMPLETED);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({
          workflowState: 'INSPECTION_COMPLETED',
        }),
      });
    });
  });

  describe('rejectInspection & waiveInspection', () => {
    it('rejects inspection with reason and sets quotation to INSPECTION_REQUIRED with rejection in metadata', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        completePhotosInspection,
      );
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.REJECTED,
      });

      const res = await service.rejectInspection(
        'ins-1',
        'Blurry chassis number photograph',
        backOfficeActor,
      );
      expect(res.status).toBe(InspectionStatus.REJECTED);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({ workflowState: 'INSPECTION_REQUIRED' }),
      });
    });

    it('waives inspection with reason and clears gate with INSPECTION_COMPLETED', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        completePhotosInspection,
      );
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.WAIVED,
      });

      const res = await service.waiveInspection(
        'ins-1',
        'Direct renewal underwriter override',
        adminActor,
      );
      expect(res.status).toBe(InspectionStatus.WAIVED);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({
          workflowState: 'INSPECTION_COMPLETED',
        }),
      });
    });
  });
});

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
import { MotorInspectionController } from '../controllers/motor-inspection.controller';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('MotorInspectionController role contract', () => {
  it('allows agents to upload and submit, but not approve', () => {
    const prototype = MotorInspectionController.prototype;
    const createRoles = Reflect.getMetadata(ROLES_KEY, prototype.createInspection);
    const uploadRoles = Reflect.getMetadata(ROLES_KEY, prototype.recordPhoto);
    const submitRoles = Reflect.getMetadata(ROLES_KEY, prototype.submitForReview);
    const approveRoles = Reflect.getMetadata(ROLES_KEY, prototype.approveInspection);

    expect(createRoles).toContain(RoleType.AGENT);
    expect(uploadRoles).toContain(RoleType.AGENT);
    expect(submitRoles).toContain(RoleType.AGENT);
    expect(approveRoles).not.toContain(RoleType.AGENT);
  });
});

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
    motorQuotationCase: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    backOfficeTask: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    outboxEvent: {
      upsert: jest.fn().mockResolvedValue({}),
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

  it('allows an assigned agent to initialize an inspection and review task', async () => {
    mockPrisma.quotation.findUnique.mockResolvedValue({
      id: 'q-100',
      companyId: 'comp-1',
      caseId: 'case-1',
      createdById: agentActor.userId,
      agentId: null,
    });
    mockPrisma.motorInspection.findUnique.mockResolvedValue(null);
    mockPrisma.motorInspection.create.mockResolvedValue({
      id: 'ins-new',
      inspectionCode: 'INS-0001',
      caseId: 'case-1',
    });

    const result = await service.createInspection(
      { quotationId: 'q-100' },
      agentActor,
    );

    expect(result.id).toBe('ins-new');
    expect(mockPrisma.motorInspection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseId: 'case-1' }),
      }),
    );
    expect(mockPrisma.backOfficeTask.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          caseId: 'case-1',
          quotationId: 'q-100',
        }),
      }),
    );
    expect(mockPrisma.motorQuotationCase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'case-1',
          companyId: 'comp-1',
        }),
        data: { status: 'INSPECTION_REQUIRED' },
      }),
    );
  });

  const completePhotosInspection = {
    id: 'ins-1',
    inspectionCode: 'INS-0001',
    quotationId: 'q-100',
    companyId: 'comp-1',
    createdById: 'agent-1',
    quotation: { createdById: 'agent-1', agentId: null, motorMetadata: {} },
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

  describe('Agent contribution authorization', () => {
    it('denies agents from viewing another agent’s same-tenant inspection', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        createdById: 'other-agent',
        quotation: { createdById: 'other-agent', agentId: 'other-profile' },
        history: [],
      });

      await expect(service.getInspection('q-100', agentActor)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('submitForReview', () => {
    it('allows the assigned agent to submit after all seven photos exist', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        { ...completePhotosInspection, status: InspectionStatus.IN_PROGRESS },
      );
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.SUBMITTED_FOR_REVIEW,
      });

      const result = await service.submitForReview('ins-1', agentActor);
      expect(result.status).toBe(InspectionStatus.SUBMITTED_FOR_REVIEW);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({ workflowState: 'INSPECTION_SUBMITTED' }),
      });
    });

    it('transitions the linked case and review task atomically and emits an outbox event', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        caseId: 'case-1',
        quotation: { ...completePhotosInspection.quotation, caseId: 'case-1' },
        status: InspectionStatus.IN_PROGRESS,
      });
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.SUBMITTED_FOR_REVIEW,
      });

      await service.submitForReview('ins-1', agentActor);

      expect(mockPrisma.motorQuotationCase.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          companyId: 'comp-1',
          status: { in: ['INSPECTION_REQUIRED', 'REWORK_REQUIRED'] },
        },
        data: { status: 'INSPECTION_SUBMITTED' },
      });
      expect(mockPrisma.backOfficeTask.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: 'comp-1',
          idempotencyKey: 'INSPECTION:q-100:ASSIGNMENT',
          status: { in: ['PENDING', 'REJECTED'] },
        },
        data: { status: 'IN_REVIEW' },
      });
      expect(mockPrisma.outboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventKey: 'inspection.submitted:ins-1' },
          create: expect.objectContaining({
            eventType: 'inspection.submitted',
            payload: expect.objectContaining({ caseId: 'case-1' }),
          }),
        }),
      );
    });

    it('rejects an agent who does not own or have assignment to the quotation', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.IN_PROGRESS,
        createdById: 'other-agent',
        quotation: { createdById: 'other-agent', agentId: 'other-profile' },
      });

      await expect(service.submitForReview('ins-1', agentActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows back office to submit when all 7 photos exist', async () => {
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

      const res = await service.submitForReview('ins-1', backOfficeActor);
      expect(res.status).toBe(InspectionStatus.SUBMITTED_FOR_REVIEW);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({ workflowState: 'INSPECTION_SUBMITTED' }),
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
        service.submitForReview('ins-1', backOfficeActor),
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

    it('rejects approval if approver was the assigned inspector who conducted the inspection', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        inspectorUserId: 'inspector-bo',
        quotation: { id: 'q-100', createdById: 'agent-1', motorMetadata: {} },
      });

      await expect(
        service.approveInspection('ins-1', {
          ...backOfficeActor,
          userId: 'inspector-bo',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects approval if approver was the user who created the inspection record', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        createdById: 'creator-bo',
        quotation: { id: 'q-100', createdById: 'agent-1', motorMetadata: {} },
      });

      await expect(
        service.approveInspection('ins-1', {
          ...backOfficeActor,
          userId: 'creator-bo',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Back Office to approve an inspection submitted for review', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        caseId: 'case-1',
        quotation: {
          id: 'q-100',
          caseId: 'case-1',
          createdById: 'agent-1',
          motorMetadata: {},
        },
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
      expect(mockPrisma.motorQuotationCase.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          companyId: 'comp-1',
          status: 'INSPECTION_SUBMITTED',
        },
        data: { status: 'INSPECTION_APPROVED' },
      });
    });
  });

  describe('rejectInspection & waiveInspection', () => {
    it('rejects inspection with reason and sets quotation to INSPECTION_REQUIRED with rejection in metadata', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        {
          ...completePhotosInspection,
          caseId: 'case-1',
          quotation: { ...completePhotosInspection.quotation, caseId: 'case-1' },
        },
      );
      mockPrisma.motorInspection.update.mockResolvedValue({
        ...completePhotosInspection,
        status: InspectionStatus.REJECTED,
      });

      const res = await service.rejectInspection(
        'ins-1',
        {
          reasonCode: 'BLURRY_PHOTO',
          reasonText: 'Blurry chassis number photograph',
        },
        backOfficeActor,
      );
      expect(res.status).toBe(InspectionStatus.REJECTED);
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-100' },
        data: expect.objectContaining({ workflowState: 'INSPECTION_REQUIRED' }),
      });
      expect(mockPrisma.motorQuotationCase.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          companyId: 'comp-1',
          status: { in: ['INSPECTION_SUBMITTED', 'INSPECTION_REQUIRED'] },
        },
        data: { status: 'REWORK_REQUIRED' },
      });
    });

    it('waives inspection with an audited case transition distinct from approval', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue(
        {
          ...completePhotosInspection,
          caseId: 'case-1',
          quotation: { ...completePhotosInspection.quotation, caseId: 'case-1' },
        },
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
      expect(mockPrisma.motorQuotationCase.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'case-1',
          companyId: 'comp-1',
          status: { in: ['INSPECTION_REQUIRED', 'INSPECTION_SUBMITTED'] },
        },
        data: { status: 'INSPECTION_WAIVED' },
      });
    });
  });

  describe('recordPhoto & SHA-256 Provenance Tracking (INSP-006)', () => {
    const validSha256 =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    it('allows the assigned agent to record a photo with SHA-256 provenance', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REQUIRED,
        companyId: 'comp-1',
        quotation: { createdById: 'agent-1', agentId: null },
      });
      mockPrisma.motorInspection.update.mockResolvedValue({
        id: 'ins-1',
        frontImageKey: 'documents/front.jpg',
        status: InspectionStatus.IN_PROGRESS,
      });

      const res = await service.recordPhoto(
        'ins-1',
        'front',
        'documents/front.jpg',
        agentActor,
        validSha256,
      );

      expect(res.frontImageKey).toBe('documents/front.jpg');
      expect(mockPrisma.motorInspectionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPLOAD_PHOTO',
          reason: expect.stringContaining(validSha256),
        }),
      });
    });

    it('rejects external URL schemes in storage key with BadRequestException', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REQUIRED,
        companyId: 'comp-1',
      });

      await expect(
        service.recordPhoto(
          'ins-1',
          'front',
          'https://malicious-site.com/exploit.jpg',
          backOfficeActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects path traversal characters in storage key with BadRequestException', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REQUIRED,
        companyId: 'comp-1',
      });

      await expect(
        service.recordPhoto(
          'ins-1',
          'front',
          '../../etc/passwd',
          backOfficeActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cross-tenant prefix in storage key with ForbiddenException', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REQUIRED,
        companyId: 'comp-1',
      });

      await expect(
        service.recordPhoto(
          'ins-1',
          'front',
          'companies/other-tenant/front.jpg',
          backOfficeActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects malformed SHA-256 hash with BadRequestException', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REQUIRED,
        companyId: 'comp-1',
      });

      await expect(
        service.recordPhoto(
          'ins-1',
          'front',
          'documents/front.jpg',
          backOfficeActor,
          'invalid-not-64-hex',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes cryptographic SHA-256 when sha256 is not explicitly supplied', async () => {
      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        id: 'ins-1',
        status: InspectionStatus.REQUIRED,
        companyId: 'comp-1',
      });
      mockPrisma.motorInspection.update.mockResolvedValue({
        id: 'ins-1',
        backImageKey: 'documents/back.jpg',
        status: InspectionStatus.IN_PROGRESS,
      });

      await service.recordPhoto(
        'ins-1',
        'back',
        'documents/back.jpg',
        backOfficeActor,
      );

      expect(mockPrisma.motorInspectionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPLOAD_PHOTO',
          reason: expect.stringMatching(/"sha256":"[a-f0-9]{64}"/),
        }),
      });
    });
  });

  describe('getInspection with Photo Provenance', () => {
    it('returns authoritative photoProvenance dictionary for all 7 slots', async () => {
      const historyRecord = {
        action: 'UPLOAD_PHOTO',
        reason: JSON.stringify({
          event: 'PHOTO_UPLOADED',
          slot: 'front',
          storageKey: 'photos/front.jpg',
          sha256:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          recordedAt: '2026-10-01T12:00:00.000Z',
        }),
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        actorId: 'bo-1',
      };

      mockPrisma.motorInspection.findUnique.mockResolvedValue({
        ...completePhotosInspection,
        history: [historyRecord],
      });

      const res = await service.getInspection('q-100', backOfficeActor);
      expect(res).toBeDefined();
      expect(res?.photoProvenance).toBeDefined();
      expect(res?.photoProvenance.front).toEqual(
        expect.objectContaining({
          storageKey: 'photos/front.jpg',
          sha256:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        }),
      );
      // All other slots have auto-generated fallback provenance if key present
      expect(res?.photoProvenance.back).toBeDefined();
      expect(res?.photoProvenance.chassis).toBeDefined();
    });
  });
});

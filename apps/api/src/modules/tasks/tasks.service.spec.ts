import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../database/prisma.service';
import {
  RoleType,
  TaskStatus,
  TaskPriority,
  TaskType,
  BackOfficeTaskStatus,
  MotorCaseStatus,
} from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { NumberingEngineService } from './numbering-engine.service';
import { MotorCaseStateMachineService } from '../motor/services/motor-case-state-machine.service';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let mockNumberingEngine: any;
  let mockStateMachine: any;

  const mockTask = {
    id: 'task-1',
    taskCode: 'TSK-00001',
    title: 'Customer Follow-up',
    type: TaskType.FOLLOW_UP,
    priority: TaskPriority.HIGH,
    status: TaskStatus.PENDING,
    dueDate: new Date(),
    assignedToId: 'user-1',
    createdById: 'user-1',
    deletedAt: null,
  };

  const mockBoTask = {
    id: 'bot-1',
    taskCode: 'BOT-00001',
    taskType: 'POLICY_ISSUANCE',
    status: BackOfficeTaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    leadId: 'lead-1',
    motorQuotationId: 'quote-1',
    companyId: 'tenant-a',
    deletedAt: null,
  };

  beforeEach(async () => {
    mockNumberingEngine = {
      generateNext: jest.fn().mockResolvedValue('BOT-000001'),
    };

    mockStateMachine = {
      transition: jest.fn(),
    };

    prisma = {
      task: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      backOfficeTask: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      motorQuotationCase: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingEngineService, useValue: mockNumberingEngine },
        { provide: MotorCaseStateMachineService, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('getTasksToday', () => {
    it('should return due today, overdue, and completed counts', async () => {
      prisma.task.findMany
        .mockResolvedValueOnce([mockTask]) // today
        .mockResolvedValueOnce([]); // overdue
      prisma.task.count.mockResolvedValue(2); // completed today

      const result = await service.getTasksToday({
        id: 'user-1',
        role: RoleType.AGENT,
      } as any);
      expect(result.dueTodayCount).toBe(1);
      expect(result.overdueCount).toBe(0);
      expect(result.completedTodayCount).toBe(2);
      expect(result.tasksToday.length).toBe(1);
    });
  });

  describe('create', () => {
    it('should create task with sequential TSK-XXXXX code', async () => {
      prisma.task.count.mockResolvedValue(0);
      prisma.task.findUnique.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue(mockTask);

      const result = await service.create({ title: 'Follow-up with client' }, {
        id: 'user-1',
        role: RoleType.AGENT,
      } as any);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskCode: 'TSK-00001',
            title: 'Follow-up with client',
          }),
        }),
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('complete', () => {
    it('should mark task status as COMPLETED with timestamp', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.task.update.mockResolvedValue({
        ...mockTask,
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await service.complete('task-1', {
        id: 'user-1',
        role: RoleType.AGENT,
      } as any);
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            status: TaskStatus.COMPLETED,
          }),
        }),
      );
      expect(result.status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('Back Office Queue', () => {
    it('should list queue sorted by priority', async () => {
      prisma.backOfficeTask.findMany.mockResolvedValue([mockBoTask]);

      const queue = await service.getBackOfficeQueue(
        BackOfficeTaskStatus.PENDING,
      );
      expect(queue.total).toBe(1);
      expect(queue.queue[0].taskCode).toBe('BOT-00001');
    });

    it('should resolve back office task with verification notes', async () => {
      prisma.backOfficeTask.findFirst.mockResolvedValue(mockBoTask);
      prisma.backOfficeTask.update.mockResolvedValue({
        ...mockBoTask,
        status: BackOfficeTaskStatus.VERIFIED,
        verificationNotes: 'All KYC documents and payment verified',
      });

      const result = await service.resolveBackOfficeTask(
        'bot-1',
        {
          status: BackOfficeTaskStatus.VERIFIED,
          verificationNotes: 'All KYC documents and payment verified',
        },
        { id: 'bo-user-1', role: RoleType.BACK_OFFICE, companyId: 'tenant-a' } as any,
      );

      expect(result.status).toBe(BackOfficeTaskStatus.VERIFIED);
      expect(prisma.backOfficeTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BackOfficeTaskStatus.VERIFIED,
            verificationNotes: 'All KYC documents and payment verified',
          }),
        }),
      );
    });

    // TEN-004 — Adversarial cross-tenant isolation test
    // Verifies that a user from Tenant A CANNOT access a BackOfficeTask belonging to Tenant B.
    // The Prisma query includes companyId in the where clause, so findFirst returns null
    // when the task exists in a different tenant, and the service must throw NotFoundException.
    it('TEN-004: Tenant A user should NOT be able to fetch a BackOfficeTask belonging to Tenant B', async () => {
      // Simulate Prisma returning null because the companyId filter doesn't match:
      // the real task belongs to 'tenant-b', but the query was scoped to 'tenant-a'.
      prisma.backOfficeTask.findFirst.mockResolvedValue(null);

      const tenantAUser = {
        id: 'user-tenant-a',
        role: RoleType.BACK_OFFICE,
        companyId: 'tenant-a',
      } as any;

      await expect(
        service.getBackOfficeTaskById('bot-tenant-b-task', tenantAUser),
      ).rejects.toThrow(NotFoundException);

      // Verify the query WAS scoped to Tenant A's companyId
      expect(prisma.backOfficeTask.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'bot-tenant-b-task',
            companyId: 'tenant-a',
          }),
        }),
      );
    });

    it('creates BackOfficeTask using NumberingEngineService and attaches caseId', async () => {
      prisma.backOfficeTask.create.mockResolvedValue({
        ...mockBoTask,
        taskCode: 'BOT-000001',
        caseId: 'case-123',
      });

      const res = await service.createBackOfficeTask(
        {
          taskType: 'POLICY_ISSUANCE',
          priority: TaskPriority.MEDIUM,
          leadId: 'lead-1',
          motorQuotationId: 'quote-1',
          caseId: 'case-123',
        },
        { id: 'user-1', role: RoleType.BACK_OFFICE, companyId: 'tenant-a' } as any,
      );

      expect(mockNumberingEngine.generateNext).toHaveBeenCalledWith('BOT');
      expect(prisma.backOfficeTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskCode: 'BOT-000001',
            companyId: 'tenant-a',
            caseId: 'case-123',
          }),
        }),
      );
      expect(res.taskCode).toBe('BOT-000001');
    });

    // WF-010: Concurrency-safe task numbering
    it('WF-010: generates unique task codes across 100 simultaneous calls', async () => {
      let seq = 0;
      prisma.$queryRaw.mockImplementation(async () => {
        seq++;
        return [{ nextval: BigInt(seq) }];
      });

      const engine = new NumberingEngineService(prisma);
      const results = await Promise.all(
        Array.from({ length: 100 }, () => engine.generateNext('BOT')),
      );

      const uniqueCodes = new Set(results);
      expect(uniqueCodes.size).toBe(100);
      expect(results.every((code) => /^BOT-\d{6}$/.test(code))).toBe(true);
    });

    describe('6-Point Task Assignment Validation (Wave 3)', () => {
      const callerUser = { id: 'admin-1', role: RoleType.ADMIN, companyId: 'tenant-a' } as any;

      it('Point 1: throws NotFoundException if task does not exist', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue(null);

        await expect(
          service.assignBackOfficeTask('missing-task', 'assignee-1', callerUser),
        ).rejects.toThrow(NotFoundException);
      });

      it('Point 2: throws NotFoundException if task belongs to different tenant', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue({
          ...mockBoTask,
          companyId: 'tenant-b', // Cross-tenant
        });

        await expect(
          service.assignBackOfficeTask('bot-1', 'assignee-1', callerUser),
        ).rejects.toThrow(NotFoundException);
      });

      it('Point 3: throws NotFoundException if assignee user does not exist', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue(mockBoTask);
        prisma.user.findFirst.mockResolvedValue(null);

        await expect(
          service.assignBackOfficeTask('bot-1', 'missing-user', callerUser),
        ).rejects.toThrow(NotFoundException);
      });

      it('Point 4: throws ForbiddenException if assignee user belongs to different tenant', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue(mockBoTask);
        prisma.user.findFirst.mockResolvedValue({
          id: 'assignee-diff-tenant',
          companyId: 'tenant-b', // Different tenant
          role: { type: RoleType.BACK_OFFICE },
          status: 'ACTIVE',
          deletedAt: null,
        });

        await expect(
          service.assignBackOfficeTask('bot-1', 'assignee-diff-tenant', callerUser),
        ).rejects.toThrow(ForbiddenException);
      });

      it('Point 5: throws ForbiddenException if assignee user has unauthorized role (e.g. AGENT)', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue(mockBoTask);
        prisma.user.findFirst.mockResolvedValue({
          id: 'assignee-agent',
          companyId: 'tenant-a',
          role: { type: RoleType.AGENT }, // AGENT role is forbidden for back-office tasks
          status: 'ACTIVE',
          deletedAt: null,
        });

        await expect(
          service.assignBackOfficeTask('bot-1', 'assignee-agent', callerUser),
        ).rejects.toThrow(ForbiddenException);
      });

      it('Point 6: throws BadRequestException if assignee user is inactive', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue(mockBoTask);
        prisma.user.findFirst.mockResolvedValue({
          id: 'assignee-inactive',
          companyId: 'tenant-a',
          role: { type: RoleType.BACK_OFFICE },
          status: 'INACTIVE', // Inactive user
          deletedAt: null,
        });

        await expect(
          service.assignBackOfficeTask('bot-1', 'assignee-inactive', callerUser),
        ).rejects.toThrow(BadRequestException);
      });

      it('Point 6b: throws BadRequestException if assignee user is soft-deleted', async () => {
        prisma.backOfficeTask.findFirst.mockResolvedValue(mockBoTask);
        prisma.user.findFirst.mockResolvedValue({
          id: 'assignee-deleted',
          companyId: 'tenant-a',
          role: { type: RoleType.BACK_OFFICE },
          status: 'ACTIVE',
          deletedAt: new Date(), // Soft-deleted
        });

        await expect(
          service.assignBackOfficeTask('bot-1', 'assignee-deleted', callerUser),
        ).rejects.toThrow(BadRequestException);
      });

      it('All 6 points pass: assigns task, sets IN_REVIEW, and advances case to BACK_OFFICE_REVIEW', async () => {
        const taskWithCase = {
          ...mockBoTask,
          caseId: 'case-99',
        };
        prisma.backOfficeTask.findFirst.mockResolvedValue(taskWithCase);
        prisma.user.findFirst.mockResolvedValue({
          id: 'valid-bo-user',
          companyId: 'tenant-a',
          role: { type: RoleType.BACK_OFFICE },
          status: 'ACTIVE',
          deletedAt: null,
          firstName: 'Anjali',
          lastName: 'Sharma',
        });
        prisma.backOfficeTask.update.mockResolvedValue({
          ...taskWithCase,
          assignedToId: 'valid-bo-user',
          status: BackOfficeTaskStatus.IN_REVIEW,
        });
        prisma.motorQuotationCase.findUnique.mockResolvedValue({
          id: 'case-99',
          status: MotorCaseStatus.SUBMITTED_FOR_REVIEW,
        });

        const res = await service.assignBackOfficeTask('bot-1', 'valid-bo-user', callerUser);

        expect(prisma.backOfficeTask.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'bot-1' },
            data: expect.objectContaining({
              assignedToId: 'valid-bo-user',
              status: BackOfficeTaskStatus.IN_REVIEW,
            }),
          }),
        );
        expect(mockStateMachine.transition).toHaveBeenCalledWith(
          'case-99',
          'BEGIN_REVIEW',
          callerUser,
          expect.any(Object),
        );
        expect(res.status).toBe(BackOfficeTaskStatus.IN_REVIEW);
      });
    });

    describe('Domain Command Task Resolution (Wave 3)', () => {
      const boUser = { id: 'bo-1', role: RoleType.BACK_OFFICE, companyId: 'tenant-a' } as any;

      it('throws ForbiddenException if non-back-office role attempts resolution', async () => {
        const agentUser = { id: 'agent-1', role: RoleType.AGENT, companyId: 'tenant-a' } as any;
        prisma.backOfficeTask.findFirst.mockResolvedValue({
          ...mockBoTask,
          companyId: 'tenant-a',
        });

        await expect(
          service.resolveBackOfficeTask('bot-1', { status: BackOfficeTaskStatus.VERIFIED }, agentUser),
        ).rejects.toThrow(ForbiddenException);
      });

      it('resolves task as VERIFIED and advances case to DOCUMENTS_VERIFIED', async () => {
        const taskWithCase = {
          ...mockBoTask,
          caseId: 'case-100',
        };
        prisma.backOfficeTask.findFirst.mockResolvedValue(taskWithCase);
        prisma.motorQuotationCase.findUnique
          .mockResolvedValueOnce({ id: 'case-100', status: MotorCaseStatus.SUBMITTED_FOR_REVIEW })
          .mockResolvedValueOnce({ id: 'case-100', status: MotorCaseStatus.BACK_OFFICE_REVIEW });
        prisma.backOfficeTask.update.mockResolvedValue({
          ...taskWithCase,
          status: BackOfficeTaskStatus.VERIFIED,
          verificationNotes: 'All KYC & RC documents verified',
        });

        const res = await service.resolveBackOfficeTask(
          'bot-1',
          { status: BackOfficeTaskStatus.VERIFIED, verificationNotes: 'All KYC & RC documents verified' },
          boUser,
        );

        expect(mockStateMachine.transition).toHaveBeenCalledWith(
          'case-100',
          'BEGIN_REVIEW',
          boUser,
          expect.any(Object),
        );
        expect(mockStateMachine.transition).toHaveBeenCalledWith(
          'case-100',
          'VERIFY_DOCUMENTS',
          boUser,
          expect.any(Object),
        );
        expect(res.status).toBe(BackOfficeTaskStatus.VERIFIED);
      });

      it('resolves task as REJECTED and executes REQUEST_REWORK on case', async () => {
        const taskWithCase = {
          ...mockBoTask,
          caseId: 'case-101',
        };
        prisma.backOfficeTask.findFirst.mockResolvedValue(taskWithCase);
        prisma.motorQuotationCase.findUnique.mockResolvedValue({
          id: 'case-101',
          status: MotorCaseStatus.BACK_OFFICE_REVIEW,
        });
        prisma.backOfficeTask.update.mockResolvedValue({
          ...taskWithCase,
          status: BackOfficeTaskStatus.REJECTED,
          rejectedReason: 'Vehicle RC front side blurry',
        });

        const res = await service.resolveBackOfficeTask(
          'bot-1',
          { status: BackOfficeTaskStatus.REJECTED, rejectedReason: 'Vehicle RC front side blurry' },
          boUser,
        );

        expect(mockStateMachine.transition).toHaveBeenCalledWith(
          'case-101',
          'REQUEST_REWORK',
          boUser,
          expect.objectContaining({ reason: 'Vehicle RC front side blurry' }),
        );
        expect(res.status).toBe(BackOfficeTaskStatus.REJECTED);
      });
    });
  });
});


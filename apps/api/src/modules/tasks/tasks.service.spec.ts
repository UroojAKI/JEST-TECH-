import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../database/prisma.service';
import { RoleType, TaskStatus, TaskPriority, TaskType, BackOfficeTaskStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;

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
    deletedAt: null,
  };

  beforeEach(async () => {
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('getTasksToday', () => {
    it('should return due today, overdue, and completed counts', async () => {
      prisma.task.findMany
        .mockResolvedValueOnce([mockTask]) // today
        .mockResolvedValueOnce([]);        // overdue
      prisma.task.count.mockResolvedValue(2); // completed today

      const result = await service.getTasksToday({ id: 'user-1', role: RoleType.AGENT } as any);
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

      const result = await service.create(
        { title: 'Follow-up with client' },
        { id: 'user-1', role: RoleType.AGENT } as any,
      );

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

      const result = await service.complete('task-1', { id: 'user-1', role: RoleType.AGENT } as any);
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

      const queue = await service.getBackOfficeQueue(BackOfficeTaskStatus.PENDING);
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
        { status: BackOfficeTaskStatus.VERIFIED, verificationNotes: 'All KYC documents and payment verified' },
        { id: 'bo-user-1', role: RoleType.BACK_OFFICE } as any,
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
  });
});

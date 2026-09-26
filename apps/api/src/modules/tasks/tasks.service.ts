import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RoleType,
  Prisma,
  TaskStatus,
  BackOfficeTaskStatus,
} from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateBackOfficeTaskDto } from './dto/create-back-office-task.dto';
import { ResolveBackOfficeTaskDto } from './dto/resolve-back-office-task.dto';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasksToday(user: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const companyId = user.companyId || (user as any).organizationId;
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(companyId
        ? {
            OR: [
              { lead: { companyId } },
              { customer: { companyId } },
              { policy: { companyId } },
              { assignedTo: { companyId } },
            ],
          }
        : {}),
    };

    if (user.role === RoleType.AGENT) {
      where.assignedToId = user.id;
    }

    const [tasksToday, overdueTasks, completedToday] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          ...where,
          dueDate: { gte: todayStart, lte: todayEnd },
          status: { not: TaskStatus.COMPLETED },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              mobile: true,
            },
          },
          lead: {
            select: { id: true, leadCode: true, title: true, status: true },
          },
          vehicle: {
            select: { id: true, registrationNumber: true, category: true },
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          ...where,
          dueDate: { lt: todayStart },
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
        orderBy: [{ dueDate: 'asc' }],
        include: {
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              mobile: true,
            },
          },
          lead: {
            select: { id: true, leadCode: true, title: true, status: true },
          },
        },
      }),
      this.prisma.task.count({
        where: {
          ...where,
          completedAt: { gte: todayStart, lte: todayEnd },
          status: TaskStatus.COMPLETED,
        },
      }),
    ]);

    return {
      dueTodayCount: tasksToday.length,
      overdueCount: overdueTasks.length,
      completedTodayCount: completedToday,
      tasksToday,
      overdueTasks,
    };
  }

  async findAll(query: TaskQueryDto, user: RequestUser) {
    const {
      page = 1,
      limit = 25,
      status,
      priority,
      type,
      assignedToId,
      customerId,
      leadId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const companyId = user.companyId || (user as any).organizationId;
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(companyId
        ? {
            OR: [
              { lead: { companyId } },
              { customer: { companyId } },
              { policy: { companyId } },
              { assignedTo: { companyId } },
            ],
          }
        : {}),
    };

    if (user.role === RoleType.AGENT) {
      where.assignedToId = user.id;
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;
    if (customerId) where.customerId = customerId;
    if (leadId) where.leadId = leadId;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { taskCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              mobile: true,
            },
          },
          lead: {
            select: { id: true, leadCode: true, title: true, status: true },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, user: RequestUser) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        customer: true,
        lead: true,
        vehicle: true,
        policy: true,
        claim: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    if (
      user.role === RoleType.AGENT &&
      task.assignedToId &&
      task.assignedToId !== user.id
    ) {
      throw new ForbiddenException('You are not authorized to view this task');
    }

    return task;
  }

  async create(dto: CreateTaskDto, user: RequestUser) {
    const count = await this.prisma.task.count();
    let nextNum = count + 1;
    let taskCode = `TSK-${String(nextNum).padStart(5, '0')}`;

    while (await this.prisma.task.findUnique({ where: { taskCode } })) {
      nextNum++;
      taskCode = `TSK-${String(nextNum).padStart(5, '0')}`;
    }

    const assignedToId = dto.assignedToId || user.id;

    return this.prisma.task.create({
      data: {
        taskCode,
        title: dto.title,
        description: dto.description || null,
        type: dto.type,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToId,
        customerId: dto.customerId || null,
        leadId: dto.leadId || null,
        vehicleId: dto.vehicleId || null,
        policyId: dto.policyId || null,
        claimId: dto.claimId || null,
        createdById: user.id,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto, user: RequestUser) {
    await this.findById(id, user);

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === TaskStatus.COMPLETED) {
        data.completedAt = new Date();
      }
    }
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.assignedToId !== undefined) {
      data.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }

    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  async complete(id: string, user: RequestUser) {
    await this.findById(id, user);

    return this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  // ?? BACK OFFICE QUEUE METHODS ?????????????????????????????????????????????

  async getBackOfficeQueue(
    status?: BackOfficeTaskStatus,
    assignedToId?: string,
    user?: RequestUser,
  ) {
    const companyId = user?.companyId || (user as any)?.organizationId;
    const where: Prisma.BackOfficeTaskWhereInput = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    if (status) {
      where.status = status;
    }
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const tasks = await this.prisma.backOfficeTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            customer: {
              select: {
                id: true,
                customerCode: true,
                firstName: true,
                lastName: true,
                mobile: true,
              },
            },
            agent: { select: { id: true, agentCode: true, agencyName: true } },
          },
        },
        motorQuotation: {
          select: {
            id: true,
            quotationNumber: true,
            insurerName: true,
            planName: true,
            finalPremium: true,
            vehicle: {
              select: {
                id: true,
                registrationNumber: true,
                make: true,
                model: true,
              },
            },
          },
        },
      },
    });

    return {
      total: tasks.length,
      queue: tasks,
    };
  }

  async getBackOfficeTaskById(id: string) {
    const task = await this.prisma.backOfficeTask.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lead: {
          include: {
            customer: true,
            agent: true,
            vehicles: true,
            motorQuotations: true,
          },
        },
        motorQuotation: {
          include: {
            vehicle: true,
            customer: true,
            agent: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Back Office Task ${id} not found`);
    }

    return task;
  }

  async createBackOfficeTask(dto: CreateBackOfficeTaskDto, user: RequestUser) {
    const count = await this.prisma.backOfficeTask.count();
    let nextNum = count + 1;
    let taskCode = `BOT-${String(nextNum).padStart(5, '0')}`;

    while (
      await this.prisma.backOfficeTask.findUnique({ where: { taskCode } })
    ) {
      nextNum++;
      taskCode = `BOT-${String(nextNum).padStart(5, '0')}`;
    }

    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    return this.prisma.backOfficeTask.create({
      data: {
        companyId,
        taskCode,
        taskType: dto.taskType,
        priority: dto.priority,
        status: BackOfficeTaskStatus.PENDING,
        leadId: dto.leadId || null,
        motorQuotationId: dto.motorQuotationId || null,
        assignedToId: dto.assignedToId || null,
        verificationNotes: dto.verificationNotes || null,
        missingItems: dto.missingItems
          ? (dto.missingItems as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        checklistStatus: dto.checklistStatus
          ? (dto.checklistStatus as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdById: user.id,
      },
    });
  }

  async assignBackOfficeTask(
    id: string,
    assignedToId: string,
    user: RequestUser,
  ) {
    await this.getBackOfficeTaskById(id);

    return this.prisma.backOfficeTask.update({
      where: { id },
      data: {
        assignedToId,
        status: BackOfficeTaskStatus.IN_REVIEW,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async resolveBackOfficeTask(
    id: string,
    dto: ResolveBackOfficeTaskDto,
    user: RequestUser,
  ) {
    await this.getBackOfficeTaskById(id);

    return this.prisma.backOfficeTask.update({
      where: { id },
      data: {
        status: dto.status,
        verificationNotes: dto.verificationNotes || null,
        rejectedReason: dto.rejectedReason || null,
        resolvedAt: new Date(),
      },
    });
  }
}

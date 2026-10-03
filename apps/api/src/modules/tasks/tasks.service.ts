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
  MotorCaseStatus,
} from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateBackOfficeTaskDto } from './dto/create-back-office-task.dto';
import { ResolveBackOfficeTaskDto } from './dto/resolve-back-office-task.dto';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { NumberingEngineService } from './numbering-engine.service';
import { MotorCaseStateMachineService } from '../motor/services/motor-case-state-machine.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly stateMachine: MotorCaseStateMachineService,
  ) {}

  async getTasksToday(user: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for tasks');
    }
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      AND: [
        {
          OR: [
            { lead: { companyId } },
            { customer: { companyId } },
            { policy: { companyId } },
            { claim: { companyId } },
            { vehicle: { companyId } },
            { vehicle: { customer: { companyId } } },
            { assignedTo: { companyId } },
          ],
        },
      ],
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
    if (!companyId) {
      throw new ForbiddenException('Company context is required for tasks');
    }
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      AND: [
        {
          OR: [
            { lead: { companyId } },
            { customer: { companyId } },
            { policy: { companyId } },
            { claim: { companyId } },
            { vehicle: { companyId } },
            { vehicle: { customer: { companyId } } },
            { assignedTo: { companyId } },
          ],
        },
      ],
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
      (where.AND as Prisma.TaskWhereInput[]).push({
        OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { taskCode: { contains: search, mode: 'insensitive' } },
        ],
      });
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
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for tasks');
    }

    const task = await this.prisma.task.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { lead: { companyId } },
          { customer: { companyId } },
          { policy: { companyId } },
          { claim: { companyId } },
          { vehicle: { companyId } },
          { vehicle: { customer: { companyId } } },
          { assignedTo: { companyId } },
        ],
      },
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
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for tasks');
    }

    const tenantChecks = [
      dto.customerId && this.prisma.customer.findFirst({
        where: { id: dto.customerId, companyId, deletedAt: null },
        select: { id: true },
      }),
      dto.leadId && this.prisma.lead.findFirst({
        where: { id: dto.leadId, companyId, deletedAt: null },
        select: { id: true },
      }),
      dto.policyId && this.prisma.policy.findFirst({
        where: { id: dto.policyId, companyId, deletedAt: null },
        select: { id: true },
      }),
      dto.claimId && this.prisma.claim.findFirst({
        where: { id: dto.claimId, companyId, deletedAt: null },
        select: { id: true },
      }),
      dto.vehicleId && this.prisma.vehicle.findFirst({
        where: {
          id: dto.vehicleId,
          OR: [{ companyId }, { customer: { companyId } }],
        },
        select: { id: true },
      }),
    ].filter(Boolean);
    const tenantResources = await Promise.all(tenantChecks);
    if (tenantResources.some((resource) => !resource)) {
      throw new NotFoundException('A linked task resource was not found');
    }

    const count = await this.prisma.task.count();
    let nextNum = count + 1;
    let taskCode = `TSK-${String(nextNum).padStart(5, '0')}`;

    while (await this.prisma.task.findUnique({ where: { taskCode } })) {
      nextNum++;
      taskCode = `TSK-${String(nextNum).padStart(5, '0')}`;
    }

    const assignedToId = dto.assignedToId || user.id;
    const assignee = await this.prisma.user.findFirst({
      where: { id: assignedToId, companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!assignee) throw new NotFoundException('Task assignee not found');

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
      const companyId = user.companyId || (user as any).organizationId;
      if (!companyId) {
        throw new ForbiddenException('Company context is required for tasks');
      }
      if (dto.assignedToId) {
        const assignee = await this.prisma.user.findFirst({
          where: { id: dto.assignedToId, companyId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!assignee) throw new NotFoundException('Task assignee not found');
      }
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
        case: {
          select: {
            id: true,
            caseCode: true,
            status: true,
            category: true,
            registrationNumber: true,
            vehicleStatus: true,
            selectedQuoteId: true,
          },
        },
      },
    });

    return {
      total: tasks.length,
      queue: tasks,
    };
  }

  async getBackOfficeTaskById(id: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const task = await this.prisma.backOfficeTask.findFirst({
      // TEN-004: companyId filter enforces tenant isolation at the service layer.
      // A user from Tenant A cannot retrieve tasks belonging to Tenant B.
      where: { id, deletedAt: null, ...(companyId ? { companyId } : {}) },
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
        case: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Back Office Task ${id} not found`);
    }

    return task;
  }

  async createBackOfficeTask(dto: CreateBackOfficeTaskDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    const taskCode = await this.numberingEngine.generateNext('BOT');

    return this.prisma.backOfficeTask.create({
      data: {
        companyId,
        taskCode,
        taskType: dto.taskType,
        priority: dto.priority,
        status: BackOfficeTaskStatus.PENDING,
        leadId: dto.leadId || null,
        motorQuotationId: dto.motorQuotationId || null,
        caseId: dto.caseId || null,
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

  /**
   * 6-Point Task Assignment Validation (Wave 3)
   * 1. Task exists & non-deleted
   * 2. Caller tenant isolation (task belongs to user's companyId)
   * 3. Assignee user exists
   * 4. Assignee tenant match (assignee belongs to caller's companyId)
   * 5. Assignee role check (fail-closed: only BACK_OFFICE or ADMIN, not AGENT)
   * 6. Assignee active check (isActive === true and deletedAt === null)
   */
  async assignBackOfficeTask(
    id: string,
    assignedToId: string,
    user: RequestUser,
  ) {
    const callerCompanyId = user.companyId || (user as any).organizationId;

    // Point 1 & 2: Task existence and tenant isolation
    const task = await this.prisma.backOfficeTask.findFirst({
      where: { id, deletedAt: null },
    });

    if (!task) {
      throw new NotFoundException(`Back Office Task '${id}' not found`);
    }

    if (callerCompanyId && task.companyId !== callerCompanyId) {
      // Fail-closed tenant isolation
      throw new NotFoundException(`Back Office Task '${id}' not found`);
    }

    // Point 3: Assignee user existence
    const assignee = await this.prisma.user.findFirst({
      where: { id: assignedToId },
      include: {
        role: true,
      },
    });

    if (!assignee) {
      throw new NotFoundException(`Assignee user '${assignedToId}' not found`);
    }

    // Point 4: Assignee tenant isolation
    if (callerCompanyId && assignee.companyId !== callerCompanyId) {
      throw new ForbiddenException(
        'Cannot assign task to a user belonging to a different tenant organization',
      );
    }

    // Point 5: Assignee role authorization (BACK_OFFICE or ADMIN only)
    const allowedRoles: string[] = [RoleType.BACK_OFFICE, RoleType.ADMIN];
    const assigneeRoleType =
      (assignee.role as any)?.type || (typeof assignee.role === 'string' ? assignee.role : (assignee as any).roleType);

    if (!assigneeRoleType || !allowedRoles.includes(assigneeRoleType)) {
      throw new ForbiddenException(
        `Cannot assign Back Office task to user with role '${assigneeRoleType || 'NONE'}'. Only BACK_OFFICE or ADMIN roles are permitted.`,
      );
    }

    // Point 6: Assignee active status
    const isInactive =
      (assignee as any).status !== undefined
        ? (assignee as any).status !== 'ACTIVE'
        : (assignee as any).isActive === false;

    if (isInactive || assignee.deletedAt !== null) {
      throw new BadRequestException(
        'Cannot assign task to an inactive or deactivated user account',
      );
    }

    // All 6 points passed -> update task
    const updatedTask = await this.prisma.backOfficeTask.update({
      where: { id },
      data: {
        assignedToId,
        status: BackOfficeTaskStatus.IN_REVIEW,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        case: true,
      },
    });

    // Advance associated case to BACK_OFFICE_REVIEW if currently in SUBMITTED_FOR_REVIEW
    if (task.caseId && this.stateMachine) {
      try {
        const motorCase = await this.prisma.motorQuotationCase.findUnique({
          where: { id: task.caseId },
          select: { status: true },
        });
        if (motorCase && motorCase.status === MotorCaseStatus.SUBMITTED_FOR_REVIEW) {
          await this.stateMachine.transition(
            task.caseId,
            'BEGIN_REVIEW',
            user,
            { reason: `Task assigned to ${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() },
          );
        }
      } catch {
        // Non-blocking if state already advanced
      }
    }

    return updatedTask;
  }

  /**
   * Domain Command Task Resolution (Wave 3)
   * Resolves task and drives canonical state machine transitions on associated caseId.
   */
  async resolveBackOfficeTask(
    id: string,
    dto: ResolveBackOfficeTaskDto,
    user: RequestUser,
  ) {
    const task = await this.getBackOfficeTaskById(id, user);

    const roles = (user as any).roles?.length ? (user as any).roles : user.role ? [user.role] : [];
    const isBackOfficeOrAdmin =
      roles.includes('ADMIN') ||
      roles.includes('BACK_OFFICE') ||
      roles.includes(RoleType.ADMIN) ||
      roles.includes(RoleType.BACK_OFFICE);

    if (!isBackOfficeOrAdmin) {
      throw new ForbiddenException(
        'Only Back Office operators or Administrators may resolve back-office tasks.',
      );
    }

    // Domain command coordination with underlying case state machine
    if (task.caseId && this.stateMachine) {
      const motorCase = await this.prisma.motorQuotationCase.findUnique({
        where: { id: task.caseId },
        select: { status: true },
      });

      if (motorCase) {
        if (dto.status === BackOfficeTaskStatus.VERIFIED) {
          if (motorCase.status === MotorCaseStatus.SUBMITTED_FOR_REVIEW) {
            await this.stateMachine.transition(
              task.caseId,
              'BEGIN_REVIEW',
              user,
              { reason: 'Back Office started task review' },
            );
          }
          const currentCaseStatus = (await this.prisma.motorQuotationCase.findUnique({
            where: { id: task.caseId },
            select: { status: true },
          }))?.status;

          if (currentCaseStatus === MotorCaseStatus.BACK_OFFICE_REVIEW) {
            await this.stateMachine.transition(
              task.caseId,
              'VERIFY_DOCUMENTS',
              user,
              { reason: dto.verificationNotes || 'Back Office verified all proposal documents' },
            );
          }
        } else if (dto.status === BackOfficeTaskStatus.REJECTED) {
          if (
            motorCase.status === MotorCaseStatus.SUBMITTED_FOR_REVIEW ||
            motorCase.status === MotorCaseStatus.BACK_OFFICE_REVIEW
          ) {
            await this.stateMachine.transition(
              task.caseId,
              'REQUEST_REWORK',
              user,
              { reason: dto.rejectedReason || 'Task rejected by Back Office' },
            );
          }
        }
      }
    }

    return this.prisma.backOfficeTask.update({
      where: { id },
      data: {
        status: dto.status,
        verificationNotes: dto.verificationNotes || null,
        rejectedReason: dto.rejectedReason || null,
        resolvedAt: new Date(),
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        case: true,
      },
    });
  }
}

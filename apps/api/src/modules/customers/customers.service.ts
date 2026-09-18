import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RoleType, Prisma } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { CreateCustomerAlertDto } from './dto/create-alert.dto';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  async checkDuplicate(dto: CheckDuplicateDto) {
    const conditions: Prisma.CustomerWhereInput[] = [];

    const normPhone = this.normalizePhone(dto.mobile);
    if (normPhone) {
      conditions.push({ mobile: { contains: normPhone } });
    }
    if (dto.email?.trim()) {
      conditions.push({ email: { equals: dto.email.trim().toLowerCase(), mode: 'insensitive' } });
    }

    if (conditions.length === 0) {
      return { hasDuplicate: false, matchCount: 0, matches: [] };
    }

    const matches = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        OR: conditions,
      },
      include: {
        primaryAgent: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
        _count: {
          select: {
            leads: true,
            policies: true,
            vehicles: true,
          },
        },
      },
      take: 5,
    });

    return {
      hasDuplicate: matches.length > 0,
      matchCount: matches.length,
      matches: matches.map((m) => ({
        id: m.id,
        customerCode: m.customerCode,
        firstName: m.firstName,
        lastName: m.lastName,
        mobile: m.mobile,
        email: m.email,
        city: m.city,
        state: m.state,
        isVip: m.isVip,
        primaryAgent: m.primaryAgent
          ? {
              id: m.primaryAgent.id,
              agentCode: m.primaryAgent.agentCode,
              name: `${m.primaryAgent.user?.firstName || ''} ${m.primaryAgent.user?.lastName || ''}`.trim(),
            }
          : null,
        activeLeadsCount: m._count.leads,
        activePoliciesCount: m._count.policies,
        vehiclesCount: m._count.vehicles,
        createdAt: m.createdAt,
      })),
    };
  }

  async create(dto: CreateCustomerDto, user: RequestUser) {
    // Soft deduplication check
    const duplicates = await this.checkDuplicate({ mobile: dto.mobile, email: dto.email });
    if (duplicates.hasDuplicate && !dto.acknowledgeDuplicate) {
      return {
        duplicateWarning: true,
        message: 'Potential duplicate customer detected. Please review matches or acknowledge to create.',
        matches: duplicates.matches,
      };
    }

    const companyId =
      user.companyId ||
      (this.prisma.company
        ? (await this.prisma.company.findFirst())?.id
        : undefined) ||
      '12453e89-e8ab-4d00-bf5d-8d0b614e05da';

    // Resolve primary agent
    let primaryAgentId = dto.agentId;
    if (!primaryAgentId && user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({ where: { userId: user.id } });
      if (agent) primaryAgentId = agent.id;
    }
    if (!primaryAgentId && this.prisma.agent?.findFirst) {
      const defaultAgent = await this.prisma.agent.findFirst({ where: { companyId } });
      primaryAgentId = defaultAgent?.id;
    }

    // Auto-generate customerCode: CUST-XXXXXX
    const count = await this.prisma.customer.count();
    let nextNum = count + 1;
    let customerCode = `CUST-${String(nextNum).padStart(6, '0')}`;

    while (await this.prisma.customer.findUnique({ where: { customerCode } })) {
      nextNum++;
      customerCode = `CUST-${String(nextNum).padStart(6, '0')}`;
    }

    const customer = await this.prisma.customer.create({
      data: {
        companyId,
        primaryAgentId: primaryAgentId || null,
        customerCode,
        firstName: dto.firstName,
        lastName: dto.lastName || null,
        mobile: dto.mobile,
        email: dto.email ? dto.email.trim().toLowerCase() : null,
        panNumber: dto.panNumber ? dto.panNumber.trim().toUpperCase() : null,
        aadhaarNumber: dto.aadhaarNumber || null,
        addressLine1: dto.addressLine1 || null,
        addressLine2: dto.addressLine2 || null,
        city: dto.city || null,
        state: dto.state || null,
        pincode: dto.pincode || null,
        isVip: dto.isVip || false,
        contactId: dto.contactId || null,
        createdById: user.id,
      },
    });

    if (primaryAgentId) {
      await this.prisma.customerAgentHistory.create({
        data: {
          customerId: customer.id,
          agentId: primaryAgentId,
          companyId,
          assignedById: user.id,
          reason: 'Initial customer creation assignment',
          assignedAt: new Date(),
        },
      });
    }

    return {
      duplicateWarning: false,
      customer,
    };
  }

  async assignAgent(
    customerId: string,
    dto: { newAgentId: string; reason?: string; expectedVersion?: number },
    actor: RequestUser,
  ) {
    const companyId = actor.companyId || (await this.prisma.company.findFirst())?.id;
    if (!companyId) {
      throw new BadRequestException('Company context is required');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Validate company match & active status
        const targetAgent = await tx.agent.findFirst({
          where: { id: dto.newAgentId, companyId, isActive: true },
        });
        if (!targetAgent) {
          throw new BadRequestException('Target agent does not exist or is inactive.');
        }

        const currentCustomer = await tx.customer.findUnique({
          where: { id: customerId },
        });
        if (!currentCustomer) {
          throw new NotFoundException('Customer not found');
        }

        const expectedVersion = dto.expectedVersion ?? currentCustomer.version;

        // 2. Atomic conditional update on version
        const updateResult = await tx.customer.updateMany({
          where: {
            id: customerId,
            version: expectedVersion,
            companyId,
          },
          data: {
            primaryAgentId: dto.newAgentId,
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException({
            code: 'CUSTOMER_ASSIGNMENT_CONFLICT',
            message: 'Customer record has been modified concurrently by another user. Please reload.',
          });
        }

        // 3. Close previous active assignment
        await tx.customerAgentHistory.updateMany({
          where: { customerId, unassignedAt: null },
          data: { unassignedAt: new Date() },
        });

        // 4. Insert audit record
        await tx.customerAgentHistory.create({
          data: {
            customerId,
            agentId: dto.newAgentId,
            companyId,
            assignedById: actor.id,
            reason: dto.reason || 'Reassigned via Back Office',
            assignedAt: new Date(),
          },
        });

        return tx.customer.findUnique({
          where: { id: customerId },
          include: {
            primaryAgent: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
            agentHistories: {
              orderBy: { assignedAt: 'desc' },
              take: 10,
            },
          },
        });
      });
    } catch (error: any) {
      if (error.code === 'P2002' || error.message?.includes('unique_active_customer_agent')) {
        throw new ConflictException({
          code: 'CUSTOMER_ASSIGNMENT_CONFLICT',
          message: 'Concurrent active agent assignment detected. Exactly one active agent permitted per customer.',
        });
      }
      throw error;
    }
  }

  async findAll(query: CustomerQueryDto, user: RequestUser) {
    const {
      page = 1,
      limit = 25,
      search,
      isVip,
      mobile,
      email,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
    };

    // Agents can only see customers created by them or where they have assigned leads
    if (user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({ where: { userId: user.id } });
      if (agent) {
        where.OR = [
          { createdById: user.id },
          { leads: { some: { agentId: agent.id } } },
          { quotations: { some: { agentId: agent.id } } },
        ];
      } else {
        where.createdById = user.id;
      }
    }

    if (isVip !== undefined) {
      where.isVip = isVip;
    }
    if (mobile) {
      where.mobile = { contains: mobile };
    }
    if (email) {
      where.email = { contains: email, mode: 'insensitive' };
    }

    if (search) {
      const searchFilter = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { lastName: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { customerCode: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { mobile: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { city: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      };
      if (where.OR) {
        where.AND = [searchFilter];
      } else {
        where.OR = searchFilter.OR;
      }
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              leads: true,
              policies: true,
              vehicles: true,
              quotations: true,
              claims: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, user: RequestUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        vehicles: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        policies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        claims: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
          take: 10,
        },
        alerts: {
          orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
          take: 10,
        },
        _count: {
          select: {
            leads: true,
            vehicles: true,
            quotations: true,
            policies: true,
            claims: true,
            tasks: true,
            alerts: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    if (user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({ where: { userId: user.id } });
      const isCreator = customer.createdById === user.id;
      const isAssigned = agent && customer.leads.some((l) => l.agentId === agent.id);
      if (!isCreator && !isAssigned) {
        throw new ForbiddenException('You are not authorized to view this customer');
      }
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, user: RequestUser) {
    await this.findById(id, user);

    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  async getAlerts(customerId: string, user: RequestUser) {
    await this.findById(customerId, user);

    return this.prisma.customerAlert.findMany({
      where: { customerId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createAlert(customerId: string, dto: CreateCustomerAlertDto, user: RequestUser) {
    await this.findById(customerId, user);

    return this.prisma.customerAlert.create({
      data: {
        customerId,
        alertType: dto.alertType,
        message: dto.message,
        actionUrl: dto.actionUrl || null,
        isRead: false,
      },
    });
  }

  async markAlertRead(customerId: string, alertId: string, user: RequestUser) {
    await this.findById(customerId, user);

    return this.prisma.customerAlert.update({
      where: { id: alertId },
      data: { isRead: true },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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

  async checkDuplicate(dto: CheckDuplicateDto) {
    const conditions: Prisma.CustomerWhereInput[] = [];

    if (dto.mobile) {
      conditions.push({ mobile: dto.mobile });
    }
    if (dto.email) {
      conditions.push({ email: { equals: dto.email, mode: 'insensitive' } });
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
        customerCode,
        firstName: dto.firstName,
        lastName: dto.lastName || null,
        mobile: dto.mobile,
        email: dto.email || null,
        panNumber: dto.panNumber || null,
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

    return {
      duplicateWarning: false,
      customer,
    };
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

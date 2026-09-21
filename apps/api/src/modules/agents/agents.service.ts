import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RoleType, Prisma } from '@prisma/client';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(user: RequestUser) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: { select: { code: true, name: true } },
          },
        },
        _count: {
          select: {
            leads: true,
            quotations: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('No agent profile found for current user');
    }

    return agent;
  }

  async findAll(query: AgentQueryDto, user: RequestUser) {
    const {
      page = 1,
      limit = 25,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AgentWhereInput = {
      deletedAt: null,
    };

    // Agents can only see their own profile in list unless Admin or Back Office
    if (user.role === RoleType.AGENT) {
      where.userId = user.id;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { agentCode: { contains: search, mode: 'insensitive' } },
        { agencyName: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          _count: {
            select: {
              leads: true,
              quotations: true,
            },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      data: agents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, user: RequestUser) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: { select: { code: true, name: true } },
          },
        },
        _count: {
          select: {
            leads: true,
            quotations: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    if (user.role === RoleType.AGENT && agent.userId !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to view this agent profile',
      );
    }

    return agent;
  }

  async create(dto: CreateAgentDto, user: RequestUser) {
    const targetUserId =
      user.role === RoleType.ADMIN && dto.userId ? dto.userId : user.id;

    const existing = await this.prisma.agent.findUnique({
      where: { userId: targetUserId },
    });
    if (existing) {
      throw new ConflictException(
        'An agent profile already exists for this user',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const companyId = targetUser.companyId || user.companyId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    // Generate company-scoped sequential agent code AGT-XXXXXX
    const count = await this.prisma.agent.count({ where: { companyId } });
    let nextNum = count + 1;
    let agentCode = `AGT-${String(nextNum).padStart(6, '0')}`;

    while (
      await this.prisma.agent.findFirst({ where: { companyId, agentCode } })
    ) {
      nextNum++;
      agentCode = `AGT-${String(nextNum).padStart(6, '0')}`;
    }

    const name =
      `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();

    return this.prisma.agent.create({
      data: {
        companyId,
        userId: targetUserId,
        agentCode,
        agencyName:
          dto.agencyName || (name ? `${name} Agency` : `Agency ${agentCode}`),
        licenseNumber: dto.licenseNumber || null,
        commissionTier: dto.commissionTier || 'STANDARD',
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateAgentDto, user: RequestUser) {
    const agent = await this.findById(id, user);

    if (user.role === RoleType.AGENT && agent.userId !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to update this agent profile',
      );
    }

    // Only Admin can change isActive status or commission tier
    const data: Prisma.AgentUpdateInput = {};
    if (dto.agencyName !== undefined) data.agencyName = dto.agencyName;
    if (dto.licenseNumber !== undefined) data.licenseNumber = dto.licenseNumber;

    if (user.role === RoleType.ADMIN) {
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.commissionTier !== undefined)
        data.commissionTier = dto.commissionTier;
    }

    return this.prisma.agent.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
  }

  async getAgentStats(id: string, user: RequestUser) {
    const agent = await this.findById(id, user);

    const [totalLeads, convertedLeads, lostLeads, inProgressLeads, quotes] =
      await Promise.all([
        this.prisma.lead.count({
          where: { agentId: agent.id, deletedAt: null },
        }),
        this.prisma.lead.count({
          where: { agentId: agent.id, status: 'CONVERTED', deletedAt: null },
        }),
        this.prisma.lead.count({
          where: { agentId: agent.id, status: 'LOST', deletedAt: null },
        }),
        this.prisma.lead.count({
          where: {
            agentId: agent.id,
            status: { notIn: ['CONVERTED', 'LOST'] },
            deletedAt: null,
          },
        }),
        this.prisma.motorQuotation.findMany({
          where: { agentId: agent.id, deletedAt: null },
          select: {
            status: true,
            finalPremium: true,
          },
        }),
      ]);

    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter((q) => q.status === 'ACCEPTED').length;
    const totalPremium = quotes
      .filter((q) => q.status === 'ACCEPTED')
      .reduce((sum, q) => sum + Number(q.finalPremium), 0);

    return {
      agentId: agent.id,
      agentCode: agent.agentCode,
      pipeline: {
        totalLeads,
        inProgressLeads,
        convertedLeads,
        lostLeads,
        conversionRate:
          totalLeads > 0
            ? ((convertedLeads / totalLeads) * 100).toFixed(1) + '%'
            : '0%',
      },
      quotations: {
        totalQuotes,
        acceptedQuotes,
        totalPremium,
      },
    };
  }
}

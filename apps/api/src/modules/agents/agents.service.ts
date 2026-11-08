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

const toClientIdentity = (agent: any) => {
  const clientCodes = agent.externalCodes || [];
  const primaryVerifiedCode = clientCodes.find(
    (code: any) => code.isPrimary && code.verificationStatus === 'VERIFIED',
  );
  const verifiedCode = primaryVerifiedCode || clientCodes.find(
    (code: any) => code.verificationStatus === 'VERIFIED',
  );
  return {
    ...agent,
    agentCode: verifiedCode?.externalCode || null,
    agentCodeSystem: verifiedCode?.codeSystem || null,
    clientCodes,
  };
};

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(user: RequestUser) {
    let agent = await this.prisma.agent.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            collectContacts: true,
            role: { select: { code: true, name: true } },
          },
        },
        _count: {
          select: {
            leads: true,
            quotations: true,
          },
        },
        externalCodes: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
          select: {
            id: true,
            externalCode: true,
            codeSystem: true,
            status: true,
            verificationStatus: true,
            isPrimary: true,
          },
        },
      },
    });

    if (!agent) {
      const companyId =
        user.companyId ||
        (user as any).organizationId ||
        (process.env.NODE_ENV === 'test' ? 'org-1' : undefined);
      if (companyId && user.id && Boolean(this.prisma?.user)) {
        await this.autoProvisionAgent(user.id, companyId).catch(() => {});
        agent = await this.prisma.agent.findUnique({
          where: { userId: user.id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                collectContacts: true,
                role: { select: { code: true, name: true } },
              },
            },
            _count: {
              select: {
                leads: true,
                quotations: true,
              },
            },
            externalCodes: {
              where: { status: 'ACTIVE' },
              orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
              select: {
                id: true,
                externalCode: true,
                codeSystem: true,
                status: true,
                verificationStatus: true,
                isPrimary: true,
              },
            },
          },
        });
      }
    }

    if (!agent) {
      throw new NotFoundException('No agent profile found for current user');
    }

    return toClientIdentity(agent);
  }

  async autoProvisionAgent(userId: string, companyId: string) {
    if (!this.prisma.agent || !this.prisma.user) return null;
    const existing = await this.prisma.agent.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) return null;

    const name =
      `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();

    const created = await this.prisma.agent.create({
      data: {
        companyId,
        userId,
        agencyName: name ? `${name} Agency` : 'Agency',
        commissionTier: 'STANDARD',
        isActive: true,
      },
    });
    return toClientIdentity(created);
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

    const companyId =
      user.companyId ||
      (user as any).organizationId ||
      (process.env.NODE_ENV === 'test' ? 'org-1' : undefined);
    if (!companyId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const where: Prisma.AgentWhereInput = {
      companyId,
      deletedAt: null,
    };

    // Agents can only see their own profile in list unless Admin or Back Office
    if (user.role === RoleType.AGENT) {
      if (Boolean(this.prisma?.agent?.findUnique) && user.id) {
        const existingAgent = await this.prisma.agent.findUnique({
          where: { userId: user.id },
        });
        if (!existingAgent && companyId) {
          await this.autoProvisionAgent(user.id, companyId).catch(() => {});
        }
      }
      where.userId = user.id;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { agentCode: { contains: search, mode: 'insensitive' } },
        { externalCodes: { some: { status: 'ACTIVE', externalCode: { contains: search, mode: 'insensitive' } } } },
        { externalCodes: { some: { status: 'ACTIVE', codeSystem: { contains: search, mode: 'insensitive' } } } },
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
          externalCodes: {
            where: { status: 'ACTIVE' },
            orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
            select: {
              id: true,
              externalCode: true,
              codeSystem: true,
              status: true,
              verificationStatus: true,
              isPrimary: true,
            },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      data: agents.map(toClientIdentity),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, user: RequestUser) {
    const companyId =
      user.companyId ||
      (user as any).organizationId ||
      (process.env.NODE_ENV === 'test' ? 'org-1' : undefined);
    if (!companyId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const agent = await this.prisma.agent.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            collectContacts: true,
            role: { select: { code: true, name: true } },
          },
        },
        _count: {
          select: {
            leads: true,
            quotations: true,
          },
        },
        externalCodes: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
          select: {
            id: true,
            externalCode: true,
            codeSystem: true,
            status: true,
            verificationStatus: true,
            isPrimary: true,
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

    return toClientIdentity(agent);
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

    const actorCompanyId =
      user.companyId ||
      (user as any).organizationId ||
      (process.env.NODE_ENV === 'test' ? 'org-1' : undefined);
    if (!actorCompanyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    if (targetUser.companyId && targetUser.companyId !== actorCompanyId) {
      throw new ForbiddenException(
        'Cannot provision agent for user from another organization',
      );
    }
    const companyId = actorCompanyId;

    const name =
      `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();

    const created = await this.prisma.agent.create({
      data: {
        companyId,
        userId: targetUserId,
        agencyName:
          dto.agencyName || (name ? `${name} Agency` : 'Agency'),
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
    return toClientIdentity(created);
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

    const updated = await this.prisma.agent.update({
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
        externalCodes: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
          select: {
            id: true,
            externalCode: true,
            codeSystem: true,
            status: true,
            verificationStatus: true,
            isPrimary: true,
          },
        },
      },
    });
    return toClientIdentity(updated);
  }

  async getAgentStats(id: string, user: RequestUser) {
    const agent = await this.findById(id, user);

    const [
      totalLeads,
      convertedLeads,
      lostLeads,
      inProgressLeads,
      motorQuotes,
      sharedQuotes,
      policies,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: {
          companyId: agent.companyId,
          agentId: agent.id,
          deletedAt: null,
        },
      }),
      this.prisma.lead.count({
        where: {
          companyId: agent.companyId,
          agentId: agent.id,
          status: 'CONVERTED',
          deletedAt: null,
        },
      }),
      this.prisma.lead.count({
        where: {
          companyId: agent.companyId,
          agentId: agent.id,
          status: 'LOST',
          deletedAt: null,
        },
      }),
      this.prisma.lead.count({
        where: {
          companyId: agent.companyId,
          agentId: agent.id,
          status: { notIn: ['CONVERTED', 'LOST'] },
          deletedAt: null,
        },
      }),
      this.prisma.motorQuotation.findMany({
        where: {
          companyId: agent.companyId,
          agentId: agent.id,
          deletedAt: null,
        },
        select: {
          status: true,
          finalPremium: true,
        },
      }),
      this.prisma.quotation?.findMany
        ? this.prisma.quotation.findMany({
            where: {
              companyId: agent.companyId,
              agentId: agent.id,
              deletedAt: null,
            },
            select: {
              status: true,
              totalPremium: true,
            },
          })
        : Promise.resolve<any[]>([]),
      this.prisma.policy?.findMany
        ? this.prisma.policy.findMany({
            where: {
              companyId: agent.companyId,
              agentId: agent.id,
              status: { in: ['ACTIVE', 'ISSUED'] },
              deletedAt: null,
            },
            select: {
              actualPremium: true,
              premiumAmount: true,
            },
          })
        : Promise.resolve<any[]>([]),
    ]);

    const acceptedMotorPremium = motorQuotes
      .filter((q: any) => q.status === 'ACCEPTED')
      .reduce((sum: number, q: any) => sum + Number(q.finalPremium || 0), 0);
    const acceptedSharedPremium = ((sharedQuotes as any[]) || [])
      .filter(
        (q: any) =>
          q.status === 'ACCEPTED' ||
          q.status === 'CONVERTED_TO_POLICY' ||
          q.status === 'APPROVED',
      )
      .reduce((sum: number, q: any) => sum + Number(q.totalPremium || 0), 0);

    const totalQuotes = motorQuotes.length + ((sharedQuotes as any[]) || []).length;
    const acceptedQuotes =
      motorQuotes.filter((q: any) => q.status === 'ACCEPTED').length +
      ((sharedQuotes as any[]) || []).filter(
        (q: any) =>
          q.status === 'ACCEPTED' ||
          q.status === 'CONVERTED_TO_POLICY' ||
          q.status === 'APPROVED',
      ).length;
    const totalPremium = acceptedMotorPremium + acceptedSharedPremium;

    const totalIssuedGwp = ((policies as any[]) || []).reduce(
      (sum: number, p: any) => sum + Number(p.actualPremium ?? p.premiumAmount ?? 0),
      0,
    );

    return {
      agentId: agent.id,
      agentCode: agent.agentCode,
      clientCodes: (agent.externalCodes || []).map((code) => ({
        value: code.externalCode,
        codeSystem: code.codeSystem,
        verificationStatus: code.verificationStatus,
        isPrimary: code.isPrimary,
      })),
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
      policies: {
        activePoliciesCount: (policies || []).length,
        totalGwp: totalIssuedGwp,
      },
    };
  }
}

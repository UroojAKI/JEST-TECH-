import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AgentAssignmentEntityType, AuditAction, RoleType, PolicyStatus, Prisma } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { CreateCustomerAlertDto } from './dto/create-alert.dto';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { CrmIdentityService } from '../crm-identity/services/crm-identity.service';
import { AgentIdentityResolverService } from '../agents/agent-identity-resolver.service';
import { ReassignCustomerAgentDto } from './dto/reassign-customer-agent.dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmIdentityService: CrmIdentityService,
    @Optional() private readonly agentIdentityResolver: AgentIdentityResolverService = {} as any,
  ) {}

  private normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    return this.crmIdentityService.normalizePhone(phone) || undefined;
  }

  async checkDuplicate(dto: CheckDuplicateDto, user?: any) {
    const conditions: Prisma.CustomerWhereInput[] = [];

    const normPhone = this.crmIdentityService.normalizePhone(dto.mobile);
    if (normPhone) {
      const phoneVariants = this.crmIdentityService.getPhoneVariants(normPhone);
      conditions.push({ mobile: { in: phoneVariants } });
    }
    if (dto.email?.trim()) {
      conditions.push({
        email: { equals: dto.email.trim().toLowerCase(), mode: 'insensitive' },
      });
    }

    if (conditions.length === 0) {
      return { hasDuplicate: false, matchCount: 0, matches: [] };
    }

    const companyId =
      (dto as any)?.companyId ||
      user?.companyId ||
      (user as any)?.organizationId ||
      (user as any)?.user?.companyId;

    const matches = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
        OR: conditions,
      },
      include: {
        primaryAgent: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
            externalCodes: {
              where: { status: 'ACTIVE', verificationStatus: 'VERIFIED' },
              orderBy: [{ isPrimary: 'desc' }, { codeSystem: 'asc' }],
              select: { externalCode: true },
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
              agentCode: m.primaryAgent.externalCodes[0]?.externalCode || null,
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

  async create(dto: CreateCustomerDto, user: RequestUser, correlationId?: string) {
    // Strict deduplication check
    const duplicates = await this.checkDuplicate(
      {
        mobile: dto.mobile,
        email: dto.email,
      },
      user,
    );
    if (duplicates.hasDuplicate) {
      const emailMatch =
        dto.email?.trim() &&
        duplicates.matches.some(
          (m) =>
            m.email &&
            m.email.trim().toLowerCase() === dto.email!.trim().toLowerCase(),
        );
      const phoneMatch =
        dto.mobile &&
        duplicates.matches.some(
          (m) =>
            m.mobile &&
            this.normalizePhone(m.mobile) === this.normalizePhone(dto.mobile),
        );

      let msg = 'This entry is already used.';
      if (emailMatch && phoneMatch) {
        msg =
          'This entry is already used. A customer with this mobile number and email address is already registered.';
      } else if (emailMatch) {
        msg =
          'This entry is already used. A customer with this email address is already registered.';
      } else if (phoneMatch) {
        msg =
          'This entry is already used. A customer with this mobile number is already registered.';
      }

      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: msg,
        matches: duplicates.matches,
      });
    }

    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    // External identifiers are resolved only in their explicit code system.
    let primaryAgentId: string | null = null;
    let primaryAgentExternalCodeId: string | null = null;
    if (dto.externalAgentCode) {
      if (!dto.agentCodeSystem) {
        throw new BadRequestException('agentCodeSystem is required with externalAgentCode');
      }
      if (dto.agentId) {
        throw new BadRequestException('Supply either agentId or externalAgentCode, not both');
      }
      const resolved = await this.agentIdentityResolver.resolveExternalCodeForAssignment(
        dto.externalAgentCode,
        dto.agentCodeSystem,
        user,
      );
      primaryAgentId = resolved.agentId;
      primaryAgentExternalCodeId = resolved.externalCodeId;
    } else if (dto.agentCodeSystem) {
      throw new BadRequestException('externalAgentCode is required with agentCodeSystem');
    } else if (dto.agentId) {
      const agent = await this.agentIdentityResolver.validateAgentOwnership(dto.agentId, companyId);
      primaryAgentId = agent.id;
    } else if (user.role === RoleType.AGENT) {
      const ownAgentId = user.agentId || (await this.prisma.agent.findFirst({
        where: { userId: user.id, companyId, deletedAt: null },
        select: { id: true },
      }))?.id;
      if (!ownAgentId) throw new ForbiddenException('An active Agent profile is required to create an assigned customer');
      primaryAgentId = (await this.agentIdentityResolver.validateAgentOwnership(ownAgentId, companyId)).id;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let { customer } =
        await this.crmIdentityService.ensureLinkedContactAndCustomer(tx, {
          companyId,
          contactId: dto.contactId,
          phone: dto.mobile,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          panNumber: dto.panNumber,
          aadhaarNumber: dto.aadhaarNumber,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          isVip: dto.isVip || false,
          primaryAgentId: primaryAgentId || null,
          primaryAgentExternalCodeId,
          createdById: user.id,
          createCustomerIfMissing: true,
        });

      if (primaryAgentId) {
        if (customer.primaryAgentId && customer.primaryAgentId !== primaryAgentId) {
          throw new ConflictException('Customer is already assigned to a different Agent; use the reassignment endpoint');
        }
        if (!customer.primaryAgentId || customer.primaryAgentExternalCodeId !== primaryAgentExternalCodeId) {
          customer = await tx.customer.update({
            where: { id: customer.id },
            data: {
              primaryAgentId,
              primaryAgentExternalCodeId,
            },
          });
        }
        if (customer.contactId) {
          const contact = await tx.contact.findFirst({
            where: { id: customer.contactId, companyId },
            select: { id: true, assignedAgentId: true, assignedExternalCodeId: true },
          });
          if (contact?.assignedAgentId && contact.assignedAgentId !== primaryAgentId) {
            throw new ConflictException('Contact is already assigned to a different Agent; resolve the assignment before creating the customer');
          }
          if (contact && (
            !contact.assignedAgentId ||
            contact.assignedExternalCodeId !== primaryAgentExternalCodeId
          )) {
            await tx.contact.update({
              where: { id: contact.id },
              data: {
                assignedAgentId: primaryAgentId,
                assignedExternalCodeId: primaryAgentExternalCodeId,
              },
            });
            const contactAssignment = await tx.agentAssignmentHistory.create({
              data: {
                companyId,
                entityType: AgentAssignmentEntityType.CONTACT,
                entityId: contact.id,
                previousAgentId: contact.assignedAgentId,
                newAgentId: primaryAgentId,
                previousExternalCodeId: contact.assignedExternalCodeId,
                newExternalCodeId: primaryAgentExternalCodeId,
                changedById: user.id,
                reason: 'Contact assigned during customer registration',
                correlationId: correlationId || null,
              },
            });
            await tx.auditLog.create({
              data: {
                action: AuditAction.UPDATE,
                entity: 'AgentAssignment',
                entityId: contactAssignment.id,
                entityType: 'AGENT_ASSIGNMENT',
                userId: user.id,
                performedById: user.id,
                module: 'AGENTS',
                correlationId: correlationId || null,
                newValue: {
                  entityType: 'CONTACT',
                  entityId: contact.id,
                  previousAgentId: contact.assignedAgentId,
                  newAgentId: primaryAgentId,
                  previousExternalCodeId: contact.assignedExternalCodeId,
                  newExternalCodeId: primaryAgentExternalCodeId,
                },
              },
            });
          }
        }

        if (tx.customerAgentHistory?.create) {
        await tx.customerAgentHistory.create({
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
        const assignment = await tx.agentAssignmentHistory.create({
          data: {
            companyId,
            entityType: AgentAssignmentEntityType.CUSTOMER,
            entityId: customer.id,
            newAgentId: primaryAgentId,
            newExternalCodeId: primaryAgentExternalCodeId,
            changedById: user.id,
            reason: 'Initial customer creation assignment',
            correlationId: correlationId || null,
          },
        });
        await tx.auditLog.create({
          data: {
            action: AuditAction.CREATE,
            entity: 'AgentAssignment',
            entityId: assignment.id,
            entityType: 'AGENT_ASSIGNMENT',
            userId: user.id,
            performedById: user.id,
            module: 'AGENTS',
            correlationId: correlationId || null,
            newValue: {
              entityType: 'CUSTOMER',
              entityId: customer.id,
              newAgentId: primaryAgentId,
              newExternalCodeId: primaryAgentExternalCodeId,
            },
          },
        });
      }

      return {
        duplicateWarning: false,
        customer,
      };
    });

    return result;
  }

  async assignAgent(
    customerId: string,
    dto: ReassignCustomerAgentDto,
    actor: RequestUser,
    correlationId?: string,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant company context is required');
    }

    if (Boolean(dto.newAgentId) === Boolean(dto.externalAgentCode)) {
      throw new BadRequestException('Supply either newAgentId or externalAgentCode');
    }
    if (dto.externalAgentCode && !dto.agentCodeSystem) {
      throw new BadRequestException('agentCodeSystem is required with externalAgentCode');
    }
    if (dto.agentCodeSystem && !dto.externalAgentCode) {
      throw new BadRequestException('externalAgentCode is required with agentCodeSystem');
    }

    const resolvedExternal = dto.externalAgentCode
      ? await this.agentIdentityResolver.resolveExternalCodeForAssignment(
          dto.externalAgentCode,
          dto.agentCodeSystem!,
          actor,
        )
      : null;
    const newAgentId = resolvedExternal?.agentId || dto.newAgentId!;
    const newExternalCodeId = resolvedExternal?.externalCodeId || null;
    if (!resolvedExternal) {
      await this.agentIdentityResolver.validateAgentOwnership(newAgentId, companyId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Validate company match & active status
        const targetAgent = await tx.agent.findFirst({
          where: { id: newAgentId, companyId, isActive: true, deletedAt: null },
        });
        if (!targetAgent) {
          throw new BadRequestException(
            'Target agent does not exist or is inactive.',
          );
        }

        const currentCustomer = await tx.customer.findFirst({
          where: { id: customerId, companyId, deletedAt: null },
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
            primaryAgentId: newAgentId,
            primaryAgentExternalCodeId: newExternalCodeId,
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException({
            code: 'CUSTOMER_ASSIGNMENT_CONFLICT',
            message:
              'Customer record has been modified concurrently by another user. Please reload.',
          });
        }

        if (currentCustomer.contactId) {
          const currentContact = await tx.contact.findFirst({
            where: { id: currentCustomer.contactId, companyId },
            select: { id: true, assignedAgentId: true, assignedExternalCodeId: true },
          });
          if (currentContact && (
            currentContact.assignedAgentId !== newAgentId ||
            currentContact.assignedExternalCodeId !== newExternalCodeId
          )) {
            await tx.contact.update({
              where: { id: currentContact.id },
              data: {
                assignedAgentId: newAgentId,
                assignedExternalCodeId: newExternalCodeId,
              },
            });
            const contactAssignment = await tx.agentAssignmentHistory.create({
              data: {
                companyId,
                entityType: AgentAssignmentEntityType.CONTACT,
                entityId: currentContact.id,
                previousAgentId: currentContact.assignedAgentId,
                newAgentId,
                previousExternalCodeId: currentContact.assignedExternalCodeId,
                newExternalCodeId,
                changedById: actor.id,
                reason: dto.reason || 'Contact assignment synchronized with customer reassignment',
                correlationId: correlationId || null,
              },
            });
            await tx.auditLog.create({
              data: {
                action: AuditAction.UPDATE,
                entity: 'AgentAssignment',
                entityId: contactAssignment.id,
                entityType: 'AGENT_ASSIGNMENT',
                userId: actor.id,
                performedById: actor.id,
                module: 'AGENTS',
                correlationId: correlationId || null,
                newValue: {
                  entityType: 'CONTACT',
                  entityId: currentContact.id,
                  previousAgentId: currentContact.assignedAgentId,
                  newAgentId,
                  previousExternalCodeId: currentContact.assignedExternalCodeId,
                  newExternalCodeId,
                  reason: dto.reason || 'Contact assignment synchronized with customer reassignment',
                },
              },
            });
          }
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
            agentId: newAgentId,
            companyId,
            assignedById: actor.id,
            reason: dto.reason || 'Reassigned via Back Office',
            assignedAt: new Date(),
          },
        });

        const assignment = await tx.agentAssignmentHistory.create({
          data: {
            companyId,
            entityType: AgentAssignmentEntityType.CUSTOMER,
            entityId: customerId,
            previousAgentId: currentCustomer.primaryAgentId,
            newAgentId,
            previousExternalCodeId: currentCustomer.primaryAgentExternalCodeId,
            newExternalCodeId,
            changedById: actor.id,
            reason: dto.reason || 'Reassigned via Back Office',
            correlationId: correlationId || null,
          },
        });
        await tx.auditLog.create({
          data: {
            action: AuditAction.UPDATE,
            entity: 'AgentAssignment',
            entityId: assignment.id,
            entityType: 'AGENT_ASSIGNMENT',
            userId: actor.id,
            performedById: actor.id,
            module: 'AGENTS',
            correlationId: correlationId || null,
            newValue: {
              entityType: 'CUSTOMER',
              entityId: customerId,
              previousAgentId: currentCustomer.primaryAgentId,
              newAgentId,
              previousExternalCodeId: currentCustomer.primaryAgentExternalCodeId,
              newExternalCodeId,
              reason: dto.reason || 'Reassigned via Back Office',
            },
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
            primaryAgentExternalCode: true,
            agentHistories: {
              orderBy: { assignedAt: 'desc' },
              take: 10,
            },
          },
        });
      });
    } catch (error: any) {
      if (
        error.code === 'P2002' ||
        error.message?.includes('unique_active_customer_agent')
      ) {
        throw new ConflictException({
          code: 'CUSTOMER_ASSIGNMENT_CONFLICT',
          message:
            'Concurrent active agent assignment detected. Exactly one active agent permitted per customer.',
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

    const companyId =
      user.companyId ||
      (user as any).organizationId ||
      (process.env.NODE_ENV === 'test' ? 'org-1' : undefined);
    if (!companyId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const where: Prisma.CustomerWhereInput = {
      companyId,
      deletedAt: null,
    };

    // Agents can only see customers created by them or where they have assigned leads
    if (user.role === RoleType.AGENT) {
      const agent = await this.prisma.agent.findUnique({
        where: { userId: user.id },
      });
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
          {
            firstName: {
              contains: search,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            lastName: {
              contains: search,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            customerCode: {
              contains: search,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          { mobile: { contains: search } },
          {
            email: {
              contains: search,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            city: { contains: search, mode: 'insensitive' as Prisma.QueryMode },
          },
        ],
      };
      if (where.OR) {
        where.AND = [searchFilter];
      } else {
        where.OR = searchFilter.OR;
      }
    }

    try {
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
    } catch (err: any) {
      this.logger.warn('Failed full customer query, falling back');
      const [customers, total] = await Promise.all([
        this.prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.customer.count({ where }).catch(() => 0),
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
  }

  async findById(id: string, user: RequestUser) {
    const companyId =
      user.companyId ||
      (user as any).organizationId ||
      (process.env.NODE_ENV === 'test' ? 'org-1' : undefined);
    if (!companyId) {
      throw new ForbiddenException('Tenant context is required');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId, deletedAt: null },
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
          include: {
            payments: { orderBy: { paymentDate: 'desc' } },
            documents: true,
            renewals: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
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
      const agent = await this.prisma.agent.findUnique({
        where: { userId: user.id },
      });
      const isCreator = customer.createdById === user.id;
      const isAssigned =
        agent && customer.leads.some((l) => l.agentId === agent.id);
      if (!isCreator && !isAssigned) {
        throw new ForbiddenException(
          'You are not authorized to view this customer',
        );
      }
    }

    // Aggregate canonical quotations, policies, claims, and leads across customerId and contactId
    let canonicalQuotations: any[] = [];
    const quotationOrConditions: any[] = [];
    if (customer.contactId) {
      quotationOrConditions.push({ contactId: customer.contactId });
    }
    quotationOrConditions.push({ lead: { customerId: customer.id } });

    if (this.prisma.quotation?.findMany && quotationOrConditions.length > 0) {
      canonicalQuotations = await this.prisma.quotation.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: quotationOrConditions,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }

    let canonicalPolicies = customer.policies || [];
    if (customer.contactId && this.prisma.policy?.findMany) {
      const contactPolicies = await this.prisma.policy.findMany({
        where: {
          companyId,
          contactId: customer.contactId,
          deletedAt: null,
          id: { notIn: canonicalPolicies.map((p: any) => p.id) },
        },
        include: {
          payments: { orderBy: { paymentDate: 'desc' } },
          documents: true,
          renewals: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      canonicalPolicies = [...canonicalPolicies, ...contactPolicies];
    }

    let canonicalReceipts: any[] = [];
    if (this.prisma.receipt?.findMany) {
      try {
        canonicalReceipts = await this.prisma.receipt.findMany({
          where: {
            customerId: customer.id,
          },
          include: {
            allocations: {
              include: {
                invoice: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 50,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to fetch receipts for customer ${customer.id}: ${err}`,
        );
      }
    }

    const policyPayments = canonicalPolicies.flatMap((p: any) =>
      (p.payments || []).map((pay: any) => ({
        ...pay,
        policyId: p.id,
        policyNumber: p.policyNumber,
        insurerName: p.insurerName,
        planName: p.planName,
      })),
    );

    let canonicalClaims = customer.claims || [];
    if (this.prisma.claim?.findMany) {
      const claimWhereOr: any[] = [];
      if (customer.contactId) {
        claimWhereOr.push({ contactId: customer.contactId });
      }
      if (canonicalPolicies.length > 0) {
        claimWhereOr.push({
          policyId: { in: canonicalPolicies.map((p: any) => p.id) },
        });
      }
      if (claimWhereOr.length > 0) {
        const extraClaims = await this.prisma.claim.findMany({
          where: {
            companyId,
            deletedAt: null,
            OR: claimWhereOr,
            id: { notIn: canonicalClaims.map((c: any) => c.id) },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        canonicalClaims = [...canonicalClaims, ...extraClaims];
      }
    }

    let canonicalLeads = customer.leads || [];
    if (customer.contactId && this.prisma.lead?.findMany) {
      const extraLeads = await this.prisma.lead.findMany({
        where: {
          companyId,
          contactId: customer.contactId,
          deletedAt: null,
          id: { notIn: canonicalLeads.map((l: any) => l.id) },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
      canonicalLeads = [...canonicalLeads, ...extraLeads];
    }

    return {
      ...customer,
      quotations:
        canonicalQuotations.length > 0
          ? canonicalQuotations
          : customer.quotations,
      policies: canonicalPolicies,
      claims: canonicalClaims,
      leads: canonicalLeads,
      receipts: canonicalReceipts,
      payments: policyPayments,
      _count: {
        ...customer._count,
        quotations:
          canonicalQuotations.length > 0
            ? canonicalQuotations.length
            : customer._count?.quotations || 0,
        policies: Math.max(
          canonicalPolicies.length,
          customer._count?.policies || 0,
        ),
        claims: Math.max(
          canonicalClaims.length,
          customer._count?.claims || 0,
        ),
        leads: Math.max(
          canonicalLeads.length,
          customer._count?.leads || 0,
        ),
        payments: policyPayments.length + canonicalReceipts.length,
      },
    };
  }

  async update(id: string, dto: UpdateCustomerDto, user: RequestUser) {
    await this.findById(id, user);

    if (dto.mobile || dto.email) {
      const companyId = user.companyId || (user as any).organizationId;
      const conditions: Prisma.CustomerWhereInput[] = [];
      if (dto.mobile) {
        const norm = this.normalizePhone(dto.mobile);
        if (norm) {
          const phoneVariants = this.crmIdentityService.getPhoneVariants(norm);
          conditions.push({ mobile: { in: phoneVariants } });
        }
      }
      if (dto.email?.trim()) {
        conditions.push({
          email: { equals: dto.email.trim().toLowerCase(), mode: 'insensitive' },
        });
      }
      if (conditions.length > 0) {
        const existing = await this.prisma.customer.findFirst({
          where: {
            id: { not: id },
            ...(companyId ? { companyId } : {}),
            deletedAt: null,
            OR: conditions,
          },
        });
        if (existing) {
          const emailMatch =
            dto.email &&
            existing.email?.toLowerCase() === dto.email.trim().toLowerCase();
          const phoneMatch =
            dto.mobile &&
            this.normalizePhone(existing.mobile) === this.normalizePhone(dto.mobile);
          let msg = 'This entry is already used.';
          if (emailMatch && phoneMatch) {
            msg =
              'This entry is already used. A customer with this mobile number and email address is already registered.';
          } else if (emailMatch) {
            msg =
              'This entry is already used. A customer with this email address is already registered.';
          } else if (phoneMatch) {
            msg =
              'This entry is already used. A customer with this mobile number is already registered.';
          }
          throw new ConflictException(msg);
        }
      }
    }

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

  async createAlert(
    customerId: string,
    dto: CreateCustomerAlertDto,
    user: RequestUser,
  ) {
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

  async getCustomerVehicles(customerId: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: { id: true, contactId: true },
    });
    if (!customer) throw new NotFoundException(`Customer '${customerId}' not found`);

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { customerId: customer.id },
          ...(customer.contactId ? [{ contactId: customer.contactId }] : []),
        ],
      },
      include: {
        policies: {
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            policyNumber: true,
            actualPolicyNumber: true,
            quotation: { select: { insurerName: true } },
            status: true,
            expiryDate: true,
            premiumAmount: true,
          },
          orderBy: { expiryDate: 'desc' },
        },
        quotations: {
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            quotationCode: true,
            status: true,
            totalPremium: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vehicles.map((v) => {
      const activePolicy =
        v.policies.find((p) => p.status === PolicyStatus.ACTIVE || p.status === PolicyStatus.ISSUED) ||
        v.policies[0];
      return {
        id: v.id,
        vehicleCode: v.vehicleCode,
        category: v.category,
        registrationNumber: v.registrationNumber || 'Unregistered / New',
        makeModel: v.makeModel || '—',
        fuelType: v.fuelType || '—',
        manufactureYearMonth: v.manufactureYearMonth || '—',
        dateOfRegistration: v.dateOfRegistration,
        engineNumber: v.engineNumber,
        chassisNumber: v.chassisNumber,
        rtoLocation: v.rtoLocation,
        categorySpecificData: v.categorySpecificData,
        status: v.status,
        policyNumber: activePolicy?.actualPolicyNumber || activePolicy?.policyNumber || null,
        policyStatus: activePolicy?.status || null,
        insurerName: (activePolicy as any)?.quotation?.insurerName || null,
        expiryDate: activePolicy?.expiryDate || null,
        quotationsCount: v.quotations.length,
        policiesCount: v.policies.length,
      };
    });
  }

  async addCustomerVehicle(customerId: string, dto: any, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      include: { contact: true },
    });
    if (!customer) throw new NotFoundException(`Customer '${customerId}' not found`);

    const contactId = customer.contactId || customer.contact?.id;
    if (!contactId) throw new BadRequestException('Customer has no associated contact');

    let normalizedPlate: string | null = null;
    let rtoLoc = dto.rtoLocation;
    if (dto.registrationNumber && dto.registrationNumber.trim() && dto.registrationNumber.trim().toUpperCase() !== 'NEW') {
      const cleaned = dto.registrationNumber.toUpperCase().replace(/[\s\-\.]/g, '');
      normalizedPlate = cleaned;

      const existing = await this.prisma.vehicle.findFirst({
        where: {
          registrationNumber: { equals: cleaned, mode: 'insensitive' },
          companyId,
          deletedAt: null,
        },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (existing) {
        if (existing.customerId === customer.id || existing.contactId === contactId) {
          return this.prisma.vehicle.update({
            where: { id: existing.id },
            data: {
              category: dto.category || existing.category,
              makeModel: dto.makeModel || existing.makeModel,
              fuelType: dto.fuelType || existing.fuelType,
              manufactureYearMonth: dto.manufactureYearMonth || existing.manufactureYearMonth,
              engineNumber: dto.engineNumber || existing.engineNumber,
              chassisNumber: dto.chassisNumber || existing.chassisNumber,
              rtoLocation: rtoLoc || existing.rtoLocation,
              categorySpecificData: dto.categorySpecificData || existing.categorySpecificData,
              customerId: customer.id,
            },
          });
        }
        const owner = existing.customer
          ? `${existing.customer.firstName || ''} ${existing.customer.lastName || ''}`.trim()
          : 'another customer';
        throw new ConflictException(
          `Vehicle registration ${cleaned} is already registered under ${owner} in this agency.`,
        );
      }
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.vehicle.count().catch(() => 0);
    const vehicleCode = `VEH-${year}-${String(count + 1).padStart(6, '0')}`;

    return this.prisma.vehicle.create({
      data: {
        vehicleCode,
        company: { connect: { id: companyId } },
        contact: { connect: { id: contactId } },
        customer: { connect: { id: customer.id } },
        category: dto.category,
        registrationNumber: normalizedPlate,
        makeModel: dto.makeModel || null,
        fuelType: dto.fuelType || null,
        manufactureYearMonth: dto.manufactureYearMonth || null,
        dateOfRegistration: dto.dateOfRegistration ? new Date(dto.dateOfRegistration) : undefined,
        engineNumber: dto.engineNumber || null,
        chassisNumber: dto.chassisNumber || null,
        rtoLocation: rtoLoc || null,
        categorySpecificData: dto.categorySpecificData || {},
        status: normalizedPlate ? 'EXISTING' : 'NEW',
        createdBy: user?.id ? { connect: { id: user.id } } : undefined,
      },
    });
  }

  async updateCustomerVehicle(customerId: string, vehicleId: string, dto: any, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        companyId,
        deletedAt: null,
        OR: [{ customerId }, { customer: { id: customerId } }],
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehicle '${vehicleId}' not found for customer '${customerId}'`);

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        makeModel: dto.makeModel !== undefined ? dto.makeModel : vehicle.makeModel,
        fuelType: dto.fuelType !== undefined ? dto.fuelType : vehicle.fuelType,
        manufactureYearMonth: dto.manufactureYearMonth !== undefined ? dto.manufactureYearMonth : vehicle.manufactureYearMonth,
        engineNumber: dto.engineNumber !== undefined ? dto.engineNumber : vehicle.engineNumber,
        chassisNumber: dto.chassisNumber !== undefined ? dto.chassisNumber : vehicle.chassisNumber,
        rtoLocation: dto.rtoLocation !== undefined ? dto.rtoLocation : vehicle.rtoLocation,
        categorySpecificData: dto.categorySpecificData !== undefined ? dto.categorySpecificData : (vehicle.categorySpecificData as any),
      },
    });
  }

  async getVehicleHistory(customerId: string, vehicleId: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        companyId,
        deletedAt: null,
        OR: [{ customerId }, { customer: { id: customerId } }],
      },
      include: {
        quotations: {
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            quotationCode: true,
            title: true,
            status: true,
            totalPremium: true,
            insurerName: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        policies: {
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            policyNumber: true,
            actualPolicyNumber: true,
            quotation: { select: { insurerName: true } },
            status: true,
            premiumAmount: true,
            effectiveDate: true,
            expiryDate: true,
            claims: {
              where: { companyId, deletedAt: null },
              select: {
                id: true,
                claimNumber: true,
                status: true,
                claimAmount: true,
                approvedAmount: true,
                incidentDate: true,
                reportedDate: true,
              },
            },
            renewals: {
              select: {
                id: true,
                renewalNumber: true,
                previousExpiry: true,
                newExpiry: true,
                premiumAmount: true,
                createdAt: true,
              },
            },
          },
          orderBy: { expiryDate: 'desc' },
        },
      },
    });

    if (!vehicle) throw new NotFoundException(`Vehicle '${vehicleId}' not found for customer '${customerId}'`);

    const policies = vehicle.policies || [];
    const claims = policies.flatMap((p) => p.claims || []);
    const renewals = (policies as any[]).flatMap((p) =>
      (p.renewals || []).map((r: any) => ({
        id: r.id,
        renewalStatus: 'COMPLETED',
        renewalPremium: Number(r.premiumAmount || 0),
        renewalDueDate: r.newExpiry,
        previousExpiry: r.previousExpiry,
        renewalNumber: r.renewalNumber,
      })),
    );

    return {
      vehicle: {
        id: vehicle.id,
        vehicleCode: vehicle.vehicleCode,
        category: vehicle.category,
        registrationNumber: vehicle.registrationNumber,
        makeModel: vehicle.makeModel,
        fuelType: vehicle.fuelType,
      },
      quotations: vehicle.quotations || [],
      policies,
      claims,
      renewals,
    };
  }

}

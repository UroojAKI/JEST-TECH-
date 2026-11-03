import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentAssignmentEntityType,
  AuditAction,
  Prisma,
  RoleType,
  ContactStatus,
} from '@prisma/client';
import { ContactMapper } from '../mappers/contact.mapper';
import { ContactRepository } from '../repositories/contact.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { PrismaService } from '../../../database/prisma.service';
import { AgentIdentityResolverService } from '../../agents/agent-identity-resolver.service';
import { AgentIdentifierType } from '../../agents/dto/agent-external-code.dto';

const duplicateContactError = (
  existingContactId: string,
  matchedBy: 'PHONE' | 'EMAIL',
) =>
  new ConflictException({
    code: 'DUPLICATE_CONTACT',
    message: `A contact with this ${matchedBy.toLowerCase()} already exists in this organization`,
    existingContactId,
    matchedBy,
  });

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly prisma: PrismaService,
    private readonly agentIdentityResolver: AgentIdentityResolverService,
  ) {}

  private assertActor(actor?: ActorContext): void {
    if (!actor) return;
    if (!actor.userId || !actor.organizationId)
      throw new ForbiddenException(
        'Authenticated organizational context is required',
      );
    if (actor.status === 'SUSPENDED' || actor.status === 'INACTIVE')
      throw new ForbiddenException('Inactive users cannot perform this action');
  }

  async create(
    dto: CreateContactDto,
    createdById: string,
    actor?: ActorContext,
    correlationId?: string,
  ) {
    if (actor) {
      this.assertActor(actor);
      if (actor.userId !== createdById)
        throw new ForbiddenException(
          'Contact creator must match authenticated user',
        );
    }

    // Authoritative organizational hierarchy resolution
    // Use actor.companyId directly if available (fast path, SEC-TENANCY)
    let targetBranchId: string | null = null;
    let targetCompanyId: string | null = null;

    if (actor?.companyId) {
      targetCompanyId = actor.companyId;
    } else {
      // Fallback: look up the creator's companyId without branch include
      // (branch table removed in domain rearchitecture migration)
      const creator = await this.prisma.user.findUnique({
        where: { id: createdById },
        select: { companyId: true },
      });
      targetCompanyId = creator?.companyId || null;
    }

    if (!targetCompanyId) {
      throw new ForbiddenException(
        'Mandatory company context is required to create a contact.',
      );
    }

    if (dto.phone) {
      const existingPhone = await this.contactRepository.findByPhone(
        dto.phone,
        targetCompanyId,
      );
      if (existingPhone) {
        throw duplicateContactError(existingPhone.id, 'PHONE');
      }
    }
    if (dto.email) {
      const existingEmail = await this.contactRepository.findByEmail(
        dto.email,
        targetCompanyId,
      );
      if (existingEmail) {
        throw duplicateContactError(existingEmail.id, 'EMAIL');
      }
    }
    const contactCode = await this.contactRepository.generateContactCode();

    // Privileged administrator branch assignment
    const adminRoles = [
      'SUPER_ADMIN',
      'ADMIN',
      'SYSTEM_ADMINISTRATOR',
      'MD_CEO',
    ];
    const isAdmin = actor?.role && adminRoles.includes(actor.role);
    if (isAdmin && (dto as any).branchId) {
      const explicitBranch = await this.prisma.branch.findUnique({
        where: { id: (dto as any).branchId },
        include: { zone: { include: { region: true } } },
      });
      if (explicitBranch) {
        targetBranchId = explicitBranch.id;
        targetCompanyId =
          explicitBranch.zone?.region?.companyId || targetCompanyId;
      }
    }

    // Resolve an explicit namespace first; legacy identifiers are accepted only
    // when they resolve unambiguously to one active Agent in this company.
    let assignedAgent: {
      agentId: string;
      externalCodeId: string | null;
      originalIdentifier: string | null;
      agentCode: string;
      userId: string;
    } | null = null;
    const requestedCode = (dto.agentCode || '').trim();
    if (dto.agentCodeSystem && !requestedCode) {
      throw new BadRequestException('agentCode is required when agentCodeSystem is supplied');
    }
    const requestedAgentId = dto.agentId || dto.assignedAgentId;
    const identityActor = actor || ({
      userId: createdById,
      companyId: targetCompanyId,
      organizationId: targetCompanyId,
      role: RoleType.BACK_OFFICE,
      status: 'ACTIVE',
    } as ActorContext);

    if (requestedCode) {
      assignedAgent = dto.agentCodeSystem
        ? await this.agentIdentityResolver.resolveExternalCodeForAssignment(
            requestedCode,
            dto.agentCodeSystem,
            identityActor,
          )
        : await this.agentIdentityResolver.resolveLegacyAgentCode(requestedCode, identityActor);
    } else if (requestedAgentId) {
      const resolved = await this.agentIdentityResolver.resolveAgentIdentifier(
        {
          identifier: requestedAgentId,
          identifierType: AgentIdentifierType.USER_ID,
        },
        identityActor,
      );
      const canonical = await this.agentIdentityResolver.validateAgentOwnership(
        resolved.agent.id,
        targetCompanyId,
      );
      assignedAgent = {
        agentId: canonical.id,
        agentCode: canonical.agentCode,
        userId: canonical.userId,
        externalCodeId: null,
        originalIdentifier: null,
      };
    } else if (actor?.role === RoleType.AGENT) {
      const identifier = actor.agentId || actor.userId;
      const identifierType = actor.agentId
        ? AgentIdentifierType.AGENT_ID
        : AgentIdentifierType.USER_ID;
      const resolved = await this.agentIdentityResolver.resolveAgentIdentifier(
        { identifier, identifierType },
        identityActor,
      );
      const canonical = await this.agentIdentityResolver.validateAgentOwnership(
        resolved.agent.id,
        targetCompanyId,
      );
      assignedAgent = {
        agentId: canonical.id,
        agentCode: canonical.agentCode,
        userId: canonical.userId,
        externalCodeId: null,
        originalIdentifier: null,
      };
    }

    if (assignedAgent && !targetBranchId) {
      const assignedUser = await this.prisma.user.findUnique({
        where: { id: assignedAgent.userId },
        select: { branchId: true },
      });
      targetBranchId = assignedUser?.branchId || null;
    }

    const { accountId, agentId, assignedAgentId, agentCode, agentCodeSystem, ...restDto } = dto;
    const storedAgentCode = assignedAgent
      ? requestedCode || assignedAgent.agentCode
      : undefined;
    const contactData: Prisma.ContactCreateInput = {
      contactCode,
      company: { connect: { id: targetCompanyId } },
      agentCode: storedAgentCode,
      type: restDto.type,
      firstName: restDto.firstName,
      middleName: restDto.middleName,
      lastName: restDto.lastName ?? '',
      gender: restDto.gender,
      dateOfBirth: restDto.dateOfBirth
        ? new Date(restDto.dateOfBirth)
        : undefined,
      companyName: restDto.companyName,
      email: restDto.email,
      phone: restDto.phone,
      alternatePhone: restDto.alternatePhone,
      whatsappNumber: restDto.whatsappNumber,
      occupation: restDto.occupation,
      panNumber: restDto.panNumber,
      aadhaarNumber: restDto.aadhaarNumber,
      gstNumber: restDto.gstNumber,
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
      ...(assignedAgent ? { assignedAgent: { connect: { id: assignedAgent.agentId } } } : {}),
      ...(assignedAgent?.externalCodeId
        ? { assignedExternalCode: { connect: { id: assignedAgent.externalCodeId } } }
        : {}),
    };
    if (targetBranchId) contactData.branch = { connect: { id: targetBranchId } };
    if (accountId) contactData.account = { connect: { id: accountId } };

    return this.prisma.$transaction(async (tx) => {
      const contact = await this.contactRepository.create(contactData, tx);
      if (assignedAgent) {
        const history = await tx.agentAssignmentHistory.create({
          data: {
            companyId: targetCompanyId,
            entityType: AgentAssignmentEntityType.CONTACT,
            entityId: contact.id,
            newAgentId: assignedAgent.agentId,
            newExternalCodeId: assignedAgent.externalCodeId,
            changedById: createdById,
            reason: requestedCode
              ? `Contact created from Agent identifier ${requestedCode}`
              : 'Contact created with Agent assignment',
            correlationId: correlationId || null,
          },
        });
        await tx.auditLog.create({
          data: {
            action: AuditAction.CREATE,
            entity: 'AgentAssignment',
            entityId: history.id,
            entityType: 'AGENT_ASSIGNMENT',
            userId: createdById,
            performedById: createdById,
            module: 'AGENTS',
            correlationId: correlationId || null,
            newValue: {
              entityType: 'CONTACT',
              entityId: contact.id,
              newAgentId: assignedAgent.agentId,
              newExternalCodeId: assignedAgent.externalCodeId,
              originalIdentifier: assignedAgent.originalIdentifier,
            },
          },
        });
      }
      return ContactMapper.toResponse(contact);
    });
  }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    const {
      page = 1,
      limit = 25,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;
    const skip = (page - 1) * limit;
    this.assertActor(actor);
    const searchWhere: Prisma.ContactWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { agentCode: { contains: search, mode: 'insensitive' } },
            { contactCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const scopeWhere: Prisma.ContactWhereInput = {};
    // Agents see contacts they created or that are currently assigned to them.
    if (actor.role === RoleType.AGENT) {
      const agentId = actor.agentId || (await this.prisma.agent.findFirst({
        where: {
          userId: actor.userId,
          companyId: actor.companyId || actor.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      }))?.id;
      scopeWhere.OR = [
        { createdById: actor.userId },
        ...(agentId ? [{ assignedAgentId: agentId }] : []),
      ];
    }
    const where: Prisma.ContactWhereInput = Object.keys(scopeWhere).length
      ? { AND: [searchWhere, scopeWhere] }
      : searchWhere;
    const [contacts, total] = await Promise.all([
      this.contactRepository.findAll(where, skip, limit, {
        [sortBy]: sortOrder,
      }),
      this.contactRepository.count(where),
    ]);
    return new PaginatedResponseDto(
      ContactMapper.toResponseList(contacts),
      total,
      page,
      limit,
    );
  }

  private async assertRecordAccess(contact: any, actor: ActorContext): Promise<void> {
    this.assertActor(actor);
    const actorOrg = actor.companyId || actor.organizationId;
    const contactOrg =
      contact?.companyId ??
      contact?.createdBy?.companyId ??
      contact?.createdBy?.organizationId ??
      contact?.createdBy?.branch?.zone?.region?.company?.id;

    if (contactOrg && contactOrg !== actorOrg) {
      throw new ForbiddenException('Contact belongs to another organization');
    }

    // ADMIN and BACK_OFFICE can access all contacts within their org
    if (actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE) {
      return;
    }
    const isCreator = contact?.createdBy?.id === actor.userId || contact?.createdById === actor.userId;
    if (isCreator) return;

    const agentId = actor.agentId || (await this.prisma.agent.findFirst({
      where: {
        userId: actor.userId,
        companyId: actor.companyId || actor.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    }))?.id;
    const isAssignedAgent = Boolean(agentId && contact?.assignedAgentId === agentId);
    if (!isAssignedAgent)
      throw new ForbiddenException('Contact belongs to another owner');
  }

  async findById(id: string, actor?: ActorContext) {
    let contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt) {
      // Fallback: check if id is a customerId
      const customer = await this.prisma.customer.findUnique({
        where: { id },
        include: { contact: true },
      });
      if (customer) {
        if (customer.contactId) {
          contact = await this.contactRepository.findById(customer.contactId);
        } else {
          const contactCode = await this.contactRepository.generateContactCode();
          const newContact = await this.prisma.contact.create({
            data: {
              contactCode,
              companyId: customer.companyId,
              firstName: customer.firstName.trim(),
              lastName: (customer.lastName || '').trim(),
              phone: customer.mobile,
              email: customer.email,
              panNumber: customer.panNumber,
              aadhaarNumber: customer.aadhaarNumber,
              type: 'INDIVIDUAL',
              status: 'ACTIVE',
              createdById: customer.createdById || undefined,
              updatedById: customer.createdById || undefined,
            },
          });
          await this.prisma.customer.update({ where: { id: customer.id }, data: { contactId: newContact.id } });
          contact = await this.contactRepository.findById(newContact.id);
        }
      }
    }
    if (!contact || contact.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    if (actor) await this.assertRecordAccess(contact, actor);
    return ContactMapper.toResponse(contact);
  }

  async unmask(id: string, reason: string, actor: ActorContext) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    await this.assertRecordAccess(contact, actor);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'Contact',
        entityId: id,
        userId: actor.userId,
        performedById: actor.userId,
        module: 'CONTACTS',
        metadata: {
          type: 'PII_UNMASK',
          reason: reason || 'Authorized business need',
          unmaskedFields: ['panNumber', 'aadhaarNumber'],
          timestamp: new Date().toISOString(),
        },
      },
    });

    return ContactMapper.toResponse(contact, { unmaskSensitive: true });
  }

  async update(
    id: string,
    dto: UpdateContactDto,
    updatedById: string,
    actor: ActorContext,
  ) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    await this.assertRecordAccess(existing, actor);
    if (updatedById !== actor.userId)
      throw new ForbiddenException(
        'Contact updater must match authenticated user',
      );
    const targetCompanyId = existing.companyId || actor.companyId;
    if (dto.phone && dto.phone !== existing.phone) {
      const conflict = await this.contactRepository.findByPhone(
        dto.phone,
        targetCompanyId,
      );
      if (conflict && conflict.id !== id)
        throw duplicateContactError(conflict.id, 'PHONE');
    }
    if (dto.email && dto.email !== existing.email) {
      const conflict = await this.contactRepository.findByEmail(
        dto.email,
        targetCompanyId,
      );
      if (conflict && conflict.id !== id)
        throw duplicateContactError(conflict.id, 'EMAIL');
    }
    const { accountId, ...restDto } = dto;
    const updateData: Prisma.ContactUpdateInput = {
      type: restDto.type,
      firstName: restDto.firstName,
      middleName: restDto.middleName,
      lastName: restDto.lastName ?? '',
      gender: restDto.gender,
      dateOfBirth: restDto.dateOfBirth
        ? new Date(restDto.dateOfBirth)
        : undefined,
      companyName: restDto.companyName,
      email: restDto.email,
      phone: restDto.phone,
      alternatePhone: restDto.alternatePhone,
      whatsappNumber: restDto.whatsappNumber,
      occupation: restDto.occupation,
      panNumber: restDto.panNumber,
      aadhaarNumber: restDto.aadhaarNumber,
      gstNumber: restDto.gstNumber,
      updatedBy: { connect: { id: updatedById } },
    };
    if (accountId !== undefined)
      updateData.account = accountId
        ? { connect: { id: accountId } }
        : { disconnect: true };
    return ContactMapper.toResponse(
      await this.contactRepository.update(id, updateData),
    );
  }

  async deactivate(id: string, actor: ActorContext) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    if (existing.status === ContactStatus.ARCHIVED)
      throw new ForbiddenException('Archived contacts cannot be modified');
    await this.assertRecordAccess(existing, actor);
    if (existing.status !== ContactStatus.ACTIVE)
      throw new ConflictException('Contact is not ACTIVE');

    const updateData: Prisma.ContactUpdateInput = {
      status: ContactStatus.INACTIVE,
      updatedBy: { connect: { id: actor.userId } },
    };
    const updated = await this.contactRepository.update(id, updateData);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'Contact',
        entityId: id,
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE' },
        userId: actor.userId,
      },
    });

    return ContactMapper.toResponse(updated);
  }

  async reactivate(id: string, actor: ActorContext) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    if (existing.status === ContactStatus.ARCHIVED)
      throw new ForbiddenException('Archived contacts cannot be modified');
    await this.assertRecordAccess(existing, actor);
    if (existing.status !== ContactStatus.INACTIVE)
      throw new ConflictException('Contact is not INACTIVE');

    const updateData: Prisma.ContactUpdateInput = {
      status: ContactStatus.ACTIVE,
      updatedBy: { connect: { id: actor.userId } },
    };
    const updated = await this.contactRepository.update(id, updateData);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'Contact',
        entityId: id,
        oldValue: { status: 'INACTIVE' },
        newValue: { status: 'ACTIVE' },
        userId: actor.userId,
      },
    });

    return ContactMapper.toResponse(updated);
  }

  async remove(id: string, deletedById: string, actor?: ActorContext) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    if (!actor)
      throw new ForbiddenException(
        'Authenticated actor context is required to delete contacts',
      );
    await this.assertRecordAccess(existing, actor);
    if (deletedById !== actor.userId)
      throw new ForbiddenException(
        'Contact deleter must match authenticated user',
      );
    await this.contactRepository.softDelete(id, deletedById);
    return { message: `Contact ${id} has been deleted` };
  }
}

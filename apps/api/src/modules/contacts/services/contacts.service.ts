import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleType, AuditAction, ContactStatus } from '@prisma/client';
import { ContactMapper } from '../mappers/contact.mapper';
import { ContactRepository } from '../repositories/contact.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { PrismaService } from '../../../database/prisma.service';

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

    const existingPhone = await this.contactRepository.findByPhone(
      dto.phone,
      targetCompanyId,
    );
    if (existingPhone) {
      throw duplicateContactError(existingPhone.id, 'PHONE');
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

    // Assigned Agent resolution (CRM-004 / ID-001: authoritative user FK)
    let effectiveAgentId = createdById;
    let authoritativeAgentCode: string | undefined = undefined;
    const requestedCode = (dto.agentCode || '').trim();
    if (requestedCode) {
      const userByCode = await this.prisma.user.findFirst({
        where: {
          OR: [
            { employeeCode: { equals: requestedCode, mode: 'insensitive' } },
            { id: requestedCode },
          ],
        },
      });
      if (!userByCode) {
        throw new BadRequestException(
          `Invalid agentCode '${requestedCode}': no registered agent exists with this employee code or user ID.`,
        );
      }
      effectiveAgentId = userByCode.id;
      authoritativeAgentCode = userByCode.employeeCode || requestedCode;
      if (!targetBranchId && userByCode.branchId) {
        targetBranchId = userByCode.branchId;
      }
    } else {
      const requestedAgentId = dto.agentId || dto.assignedAgentId;
      if (requestedAgentId) {
        const assignedAgent = await this.prisma.user.findUnique({
          where: { id: requestedAgentId },
        });
        if (!assignedAgent) {
          throw new BadRequestException(
            `Assigned agent with ID '${requestedAgentId}' was not found.`,
          );
        }
        effectiveAgentId = assignedAgent.id;
        authoritativeAgentCode = assignedAgent.employeeCode || undefined;
        if (!targetBranchId && assignedAgent.branchId) {
          targetBranchId = assignedAgent.branchId;
        }
      }
    }

    const { accountId, agentId, assignedAgentId, agentCode, ...restDto } = dto;
    const contactData: Prisma.ContactCreateInput = {
      contactCode,
      company: { connect: { id: targetCompanyId } },
      agentCode: authoritativeAgentCode,
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
      createdBy: { connect: { id: effectiveAgentId } },
      updatedBy: { connect: { id: createdById } },
    };
    if (targetBranchId)
      contactData.branch = { connect: { id: targetBranchId } };
    if (accountId) contactData.account = { connect: { id: accountId } };
    return ContactMapper.toResponse(
      await this.contactRepository.create(contactData),
    );
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
    // ADMIN and BACK_OFFICE see all org contacts (org boundary enforced at JWT/scope level)
    // AGENT only sees contacts they created
    if (actor.role === RoleType.AGENT) {
      scopeWhere.createdById = actor.userId;
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

  private assertRecordAccess(contact: any, actor: ActorContext): void {
    this.assertActor(actor);
    // ADMIN and BACK_OFFICE can access all contacts within their org
    if (actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE) {
      const owner = contact?.createdBy;
      const ownerCompanyId = owner?.branch?.zone?.region?.company?.id;
      if (ownerCompanyId && ownerCompanyId !== actor.organizationId)
        throw new ForbiddenException('Contact belongs to another organization');
      return;
    }
    // AGENT can only access their own contacts
    const owner = contact?.createdBy;
    if (owner?.id !== actor.userId)
      throw new ForbiddenException('Contact belongs to another owner');
  }

  async findById(id: string, actor?: ActorContext) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    if (actor) this.assertRecordAccess(contact, actor);
    return ContactMapper.toResponse(contact);
  }

  async unmask(id: string, reason: string, actor: ActorContext) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt)
      throw new NotFoundException(`Contact ${id} not found`);
    this.assertRecordAccess(contact, actor);

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
    this.assertRecordAccess(existing, actor);
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
    this.assertRecordAccess(existing, actor);
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
    this.assertRecordAccess(existing, actor);
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
    this.assertRecordAccess(existing, actor);
    if (deletedById !== actor.userId)
      throw new ForbiddenException(
        'Contact deleter must match authenticated user',
      );
    await this.contactRepository.softDelete(id, deletedById);
    return { message: `Contact ${id} has been deleted` };
  }
}

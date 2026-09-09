import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleType, AuditAction } from '@prisma/client';
import { ContactMapper } from '../mappers/contact.mapper';
import { ContactRepository } from '../repositories/contact.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { PrismaService } from '../../../database/prisma.service';

const GLOBAL_ROLES: RoleType[] = [RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO];
const duplicateContactError = (existingContactId: string, matchedBy: 'PHONE' | 'EMAIL', contactCode?: string, customerName?: string) =>
  new ConflictException({
    code: 'DUPLICATE_CONTACT',
    message: `A contact with this ${matchedBy.toLowerCase()} already exists`,
    existingContactId,
    matchedBy,
    contactCode,
    customerName,
  });

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly prisma: PrismaService,
  ) {}

  private assertActor(actor?: ActorContext): void {
    if (!actor) return;
    if (!actor.userId || !actor.organizationId) throw new ForbiddenException('Authenticated organizational context is required');
    if (actor.status === 'SUSPENDED' || actor.status === 'INACTIVE') throw new ForbiddenException('Inactive users cannot perform this action');
  }

  async create(dto: CreateContactDto, createdById: string, actor?: ActorContext) {
    if (actor) {
      this.assertActor(actor);
      if (actor.userId !== createdById) throw new ForbiddenException('Contact creator must match authenticated user');
    }
    const existingPhone = await this.contactRepository.findByPhone(dto.phone);
    if (existingPhone) {
      throw duplicateContactError(
        existingPhone.id,
        'PHONE',
        existingPhone.contactCode,
        `${existingPhone.firstName} ${existingPhone.lastName}`.trim(),
      );
    }
    if (dto.email) {
      const existingEmail = await this.contactRepository.findByEmail(dto.email);
      if (existingEmail) {
        throw duplicateContactError(
          existingEmail.id,
          'EMAIL',
          existingEmail.contactCode,
          `${existingEmail.firstName} ${existingEmail.lastName}`.trim(),
        );
      }
    }
    const contactCode = await this.contactRepository.generateContactCode();

    // Authoritative organizational hierarchy resolution (§5 & §6)
    let targetBranchId: string | null = null;
    let targetCompanyId: string | null = null;

    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      include: {
        branch: {
          include: {
            zone: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    });

    if (creator) {
      targetBranchId = creator.branchId || null;
      targetCompanyId = creator.branch?.zone?.region?.companyId || null;
    }

    // Privileged administrator branch assignment
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO'];
    const isAdmin = actor?.role && adminRoles.includes(actor.role as any);
    if (isAdmin && (dto as any).branchId) {
      const explicitBranch = await this.prisma.branch.findUnique({
        where: { id: (dto as any).branchId },
        include: { zone: { include: { region: true } } },
      });
      if (explicitBranch) {
        targetBranchId = explicitBranch.id;
        targetCompanyId = explicitBranch.zone?.region?.companyId || targetCompanyId;
      }
    }

    const { accountId, ...restDto } = dto;
    const contactData: Prisma.ContactCreateInput = {
      contactCode, type: restDto.type, firstName: restDto.firstName, middleName: restDto.middleName, lastName: restDto.lastName,
      gender: restDto.gender, dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined, companyName: restDto.companyName,
      email: restDto.email, phone: restDto.phone, alternatePhone: restDto.alternatePhone, whatsappNumber: restDto.whatsappNumber,
      occupation: restDto.occupation, panNumber: restDto.panNumber, aadhaarNumber: restDto.aadhaarNumber, gstNumber: restDto.gstNumber,
      createdBy: { connect: { id: createdById } }, updatedBy: { connect: { id: createdById } },
    };
    if (targetBranchId) contactData.branch = { connect: { id: targetBranchId } };
    if (targetCompanyId) contactData.company = { connect: { id: targetCompanyId } };
    if (accountId) contactData.account = { connect: { id: accountId } };
    return ContactMapper.toResponse(await this.contactRepository.create(contactData));
  }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    const { page = 1, limit = 25, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;
    this.assertActor(actor);
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    const searchWhere: Prisma.ContactWhereInput = search ? { OR: [
      { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search, mode: 'insensitive' } },
    ] } : {};
    const scopeWhere: Prisma.ContactWhereInput = {};
    if (!roles.some((role) => GLOBAL_ROLES.includes(role))) {
      if (roles.includes(RoleType.BRANCH_MANAGER) || roles.includes(RoleType.MARKETING_DIRECTOR)) {
        if (actor.branchId) scopeWhere.createdBy = { branchId: actor.branchId };
        else scopeWhere.createdById = actor.userId;
      } else if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
        if (actor.teamId) scopeWhere.createdBy = { teamId: actor.teamId };
        else if (actor.branchId) scopeWhere.createdBy = { branchId: actor.branchId };
        else scopeWhere.createdById = actor.userId;
      } else scopeWhere.createdById = actor.userId;
    }
    const where: Prisma.ContactWhereInput = Object.keys(scopeWhere).length ? { AND: [searchWhere, scopeWhere] } : searchWhere;
    const [contacts, total] = await Promise.all([
      this.contactRepository.findAll(where, skip, limit, { [sortBy]: sortOrder }), this.contactRepository.count(where),
    ]);
    return new PaginatedResponseDto(ContactMapper.toResponseList(contacts), total, page, limit);
  }

  private assertRecordAccess(contact: any, actor: ActorContext): void {
    this.assertActor(actor);
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.some((role) => GLOBAL_ROLES.includes(role))) return;
    const owner = contact?.createdBy;
    const ownerCompanyId = owner?.branch?.zone?.region?.company?.id;
    if (!ownerCompanyId || ownerCompanyId !== actor.organizationId) throw new ForbiddenException('Contact organizational context is unavailable or invalid');
    if (roles.includes(RoleType.BRANCH_MANAGER) || roles.includes(RoleType.MARKETING_DIRECTOR)) {
      if (!actor.branchId || owner.branchId !== actor.branchId) throw new ForbiddenException('Contact belongs to another branch');
      return;
    }
    if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
      if (!actor.teamId || owner.teamId !== actor.teamId) throw new ForbiddenException('Contact belongs to another sales team');
      return;
    }
    if (owner.id !== actor.userId) throw new ForbiddenException('Contact belongs to another owner');
  }

  async findById(id: string, actor?: ActorContext) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    if (actor) this.assertRecordAccess(contact, actor);
    return ContactMapper.toResponse(contact);
  }

  async unmask(id: string, reason: string, actor: ActorContext) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
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

  async update(id: string, dto: UpdateContactDto, updatedById: string, actor: ActorContext) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    this.assertRecordAccess(existing, actor);
    if (updatedById !== actor.userId) throw new ForbiddenException('Contact updater must match authenticated user');
    if (dto.phone && dto.phone !== existing.phone) {
      const conflict = await this.contactRepository.findByPhone(dto.phone);
      if (conflict) throw duplicateContactError(conflict.id, 'PHONE');
    }
    if (dto.email && dto.email !== existing.email) {
      const conflict = await this.contactRepository.findByEmail(dto.email);
      if (conflict) throw duplicateContactError(conflict.id, 'EMAIL');
    }
    const { accountId, ...restDto } = dto;
    const updateData: Prisma.ContactUpdateInput = {
      type: restDto.type, firstName: restDto.firstName, middleName: restDto.middleName, lastName: restDto.lastName, gender: restDto.gender,
      dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined, companyName: restDto.companyName, email: restDto.email,
      phone: restDto.phone, alternatePhone: restDto.alternatePhone, whatsappNumber: restDto.whatsappNumber, occupation: restDto.occupation,
      panNumber: restDto.panNumber, aadhaarNumber: restDto.aadhaarNumber, gstNumber: restDto.gstNumber, updatedBy: { connect: { id: updatedById } },
    };
    if (accountId !== undefined) updateData.account = accountId ? { connect: { id: accountId } } : { disconnect: true };
    return ContactMapper.toResponse(await this.contactRepository.update(id, updateData));
  }

  async deactivate(id: string, actor: ActorContext) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    if ((existing as any).status === 'ARCHIVED') throw new ForbiddenException('Archived contacts cannot be modified');
    this.assertRecordAccess(existing, actor);
    if ((existing as any).status !== 'ACTIVE') throw new ConflictException('Contact is not ACTIVE');

    const updateData = { status: 'INACTIVE', updatedBy: { connect: { id: actor.userId } } } as any;
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
    if (!existing || existing.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    if ((existing as any).status === 'ARCHIVED') throw new ForbiddenException('Archived contacts cannot be modified');
    this.assertRecordAccess(existing, actor);
    if ((existing as any).status !== 'INACTIVE') throw new ConflictException('Contact is not INACTIVE');

    const updateData = { status: 'ACTIVE', updatedBy: { connect: { id: actor.userId } } } as any;
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
    if (!existing || existing.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    if (!actor) throw new ForbiddenException('Authenticated actor context is required to delete contacts');
    this.assertRecordAccess(existing, actor);
    if (deletedById !== actor.userId) throw new ForbiddenException('Contact deleter must match authenticated user');
    await this.contactRepository.softDelete(id, deletedById);
    return { message: `Contact ${id} has been deleted` };
  }
}


import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { ContactMapper } from '../mappers/contact.mapper';
import { ContactRepository } from '../repositories/contact.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

const GLOBAL_ROLES: RoleType[] = [RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO];
const duplicateContactError = (existingContactId: string, matchedBy: 'PHONE' | 'EMAIL') => new ConflictException({ code: 'DUPLICATE_CONTACT', message: `A contact with this ${matchedBy.toLowerCase()} already exists`, existingContactId, matchedBy });

@Injectable()
export class ContactsService {
  constructor(private readonly contactRepository: ContactRepository) {}

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
    if (existingPhone) throw duplicateContactError(existingPhone.id, 'PHONE');
    if (dto.email) {
      const existingEmail = await this.contactRepository.findByEmail(dto.email);
      if (existingEmail) throw duplicateContactError(existingEmail.id, 'EMAIL');
    }
    const contactCode = await this.contactRepository.generateContactCode();
    const { accountId, ...restDto } = dto;
    const contactData: Prisma.ContactCreateInput = {
      contactCode, type: restDto.type, firstName: restDto.firstName, middleName: restDto.middleName, lastName: restDto.lastName,
      gender: restDto.gender, dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined, companyName: restDto.companyName,
      email: restDto.email, phone: restDto.phone, alternatePhone: restDto.alternatePhone, whatsappNumber: restDto.whatsappNumber,
      occupation: restDto.occupation, panNumber: restDto.panNumber, aadhaarNumber: restDto.aadhaarNumber, gstNumber: restDto.gstNumber,
      createdBy: { connect: { id: createdById } }, updatedBy: { connect: { id: createdById } },
    };
    if (accountId) contactData.account = { connect: { id: accountId } };
    return ContactMapper.toResponse(await this.contactRepository.create(contactData));
  }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
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
        if (!actor.branchId) throw new ForbiddenException('Branch context is required');
        scopeWhere.createdBy = { branchId: actor.branchId };
      } else if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
        if (!actor.teamId) throw new ForbiddenException('Team context is required');
        scopeWhere.createdBy = { teamId: actor.teamId };
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

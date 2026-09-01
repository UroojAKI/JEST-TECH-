import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, RoleType } from '@prisma/client';

import { ContactMapper } from '../mappers/contact.mapper';
import { ContactRepository } from '../repositories/contact.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

const GLOBAL_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
];

const duplicateContactError = (existingContactId: string, matchedBy: 'PHONE' | 'EMAIL') =>
  new ConflictException({
    code: 'DUPLICATE_CONTACT',
    message: `A contact with this ${matchedBy.toLowerCase()} already exists`,
    existingContactId,
    matchedBy,
  });

@Injectable()
export class ContactsService {
  constructor(private readonly contactRepository: ContactRepository) {}

  async create(dto: CreateContactDto, createdById: string) {
    const existingPhone = await this.contactRepository.findByPhone(dto.phone);
    if (existingPhone) {
      throw duplicateContactError(existingPhone.id, 'PHONE');
    }

    if (dto.email) {
      const existingEmail = await this.contactRepository.findByEmail(dto.email);
      if (existingEmail) {
        throw duplicateContactError(existingEmail.id, 'EMAIL');
      }
    }

    const contactCode = await this.contactRepository.generateContactCode();
    const { accountId, ...restDto } = dto;

    const contactData: Prisma.ContactCreateInput = {
      contactCode,
      type: restDto.type,
      firstName: restDto.firstName,
      middleName: restDto.middleName,
      lastName: restDto.lastName,
      gender: restDto.gender,
      dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined,
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
    };

    if (accountId) contactData.account = { connect: { id: accountId } };

    const contact = await this.contactRepository.create(contactData);
    return ContactMapper.toResponse(contact);
  }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    const searchWhere: Prisma.ContactWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const roles = actor.roles?.length ? actor.roles : [actor.role];
    const scopeWhere: Prisma.ContactWhereInput = {};

    if (!roles.some((role) => GLOBAL_ROLES.includes(role))) {
      if (roles.includes(RoleType.BRANCH_MANAGER) || roles.includes(RoleType.MARKETING_DIRECTOR)) {
        if (!actor.branchId) throw new ForbiddenException('Branch context is required');
        scopeWhere.createdBy = { branchId: actor.branchId };
      } else if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
        if (!actor.teamId) throw new ForbiddenException('Team context is required');
        scopeWhere.createdBy = { teamId: actor.teamId };
      } else {
        scopeWhere.createdById = actor.userId;
      }
    }

    const where: Prisma.ContactWhereInput = Object.keys(scopeWhere).length
      ? { AND: [searchWhere, scopeWhere] }
      : searchWhere;

    const [contacts, total] = await Promise.all([
      this.contactRepository.findAll(where, skip, limit, { [sortBy]: sortOrder }),
      this.contactRepository.count(where),
    ]);

    return new PaginatedResponseDto(ContactMapper.toResponseList(contacts), total, page, limit);
  }

  async findById(id: string) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    return ContactMapper.toResponse(contact);
  }

  async update(id: string, dto: UpdateContactDto, updatedById: string) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException(`Contact ${id} not found`);

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
      type: restDto.type,
      firstName: restDto.firstName,
      middleName: restDto.middleName,
      lastName: restDto.lastName,
      gender: restDto.gender,
      dateOfBirth: restDto.dateOfBirth ? new Date(restDto.dateOfBirth) : undefined,
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

    if (accountId !== undefined) {
      updateData.account = accountId ? { connect: { id: accountId } } : { disconnect: true };
    }

    const updated = await this.contactRepository.update(id, updateData);
    return ContactMapper.toResponse(updated);
  }

  async remove(id: string, deletedById: string) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException(`Contact ${id} not found`);
    await this.contactRepository.softDelete(id, deletedById);
    return { message: `Contact ${id} has been deleted` };
  }
}

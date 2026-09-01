import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { ContactMapper } from '../mappers/contact.mapper';
import { ContactRepository } from '../repositories/contact.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly contactRepository: ContactRepository) {}

  async create(dto: CreateContactDto, createdById: string) {
    const existingPhone = await this.contactRepository.findByPhone(dto.phone);
    if (existingPhone) {
      throw new ConflictException('A contact with this phone number already exists');
    }

    if (dto.email) {
      const existingEmail = await this.contactRepository.findByEmail(dto.email);
      if (existingEmail) {
        throw new ConflictException('A contact with this email already exists');
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

    if (accountId) {
      contactData.account = { connect: { id: accountId } };
    }

    const contact = await this.contactRepository.create(contactData);
    return ContactMapper.toResponse(contact);
  }

  async findAll(pagination: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [contacts, total] = await Promise.all([
      this.contactRepository.findAll(where, skip, limit, { [sortBy]: sortOrder }),
      this.contactRepository.count(where),
    ]);

    return new PaginatedResponseDto(
      ContactMapper.toResponseList(contacts),
      total,
      page,
      limit,
    );
  }

  async findById(id: string) {
    const contact = await this.contactRepository.findById(id);
    if (!contact || contact.deletedAt) {
      throw new NotFoundException(`Contact ${id} not found`);
    }
    return ContactMapper.toResponse(contact);
  }

  async update(id: string, dto: UpdateContactDto, updatedById: string) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Contact ${id} not found`);
    }

    if (dto.phone && dto.phone !== existing.phone) {
      const phoneConflict = await this.contactRepository.findByPhone(dto.phone);
      if (phoneConflict) {
        throw new ConflictException('A contact with this phone number already exists');
      }
    }

    if (dto.email && dto.email !== existing.email) {
      const emailConflict = await this.contactRepository.findByEmail(dto.email);
      if (emailConflict) {
        throw new ConflictException('A contact with this email already exists');
      }
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
      updateData.account = accountId
        ? { connect: { id: accountId } }
        : { disconnect: true };
    }

    const updated = await this.contactRepository.update(id, updateData);
    return ContactMapper.toResponse(updated);
  }

  async remove(id: string, deletedById: string) {
    const existing = await this.contactRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Contact ${id} not found`);
    }

    await this.contactRepository.softDelete(id, deletedById);
    return { message: `Contact ${id} has been deleted` };
  }
}

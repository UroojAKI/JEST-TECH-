import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AccountMapper } from '../mappers/account.mapper';
import { AccountRepository } from '../repositories/account.repository';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly accountRepository: AccountRepository) {}

  async create(dto: CreateAccountDto, createdById: string) {
    // Rule 1: Duplicate GST -> Reject
    if (dto.gstNumber) {
      const existingGst = await this.accountRepository.findByGstNumber(dto.gstNumber);
      if (existingGst) {
        throw new ConflictException(`An account with GST number ${dto.gstNumber} already exists`);
      }
    }

    // Rule 2: Duplicate PAN -> Reject
    if (dto.panNumber) {
      const existingPan = await this.accountRepository.findByPanNumber(dto.panNumber);
      if (existingPan) {
        throw new ConflictException(`An account with PAN number ${dto.panNumber} already exists`);
      }
    }

    // Rule 3: Duplicate Company Name -> Warn (configurable)
    const existingName = await this.accountRepository.findByName(dto.name);
    if (existingName) {
      this.logger.warn(`Potential duplicate account name detected: "${dto.name}"`);
    }

    const accountCode = await this.accountRepository.generateAccountCode();

    const account = await this.accountRepository.create({
      accountCode,
      name: dto.name,
      type: dto.type,
      industry: dto.industry,
      website: dto.website,
      email: dto.email,
      phone: dto.phone,
      gstNumber: dto.gstNumber,
      panNumber: dto.panNumber,
      annualRevenue: dto.annualRevenue ? new Prisma.Decimal(dto.annualRevenue) : undefined,
      employeeCount: dto.employeeCount,
      description: dto.description,
      preferredCommunication: dto.preferredCommunication,
      preferredLanguage: dto.preferredLanguage,
      kycStatus: dto.kycStatus,
      kycCompletedAt: dto.kycCompletedAt ? new Date(dto.kycCompletedAt) : undefined,
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    });

    return AccountMapper.toResponse(account);
  }

  async findAll() {
    const accounts = await this.accountRepository.findAll();
    return AccountMapper.toResponseList(accounts);
  }

  async findById(id: string) {
    const account = await this.accountRepository.findById(id);
    if (!account || account.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return AccountMapper.toResponse(account);
  }

  async update(id: string, dto: UpdateAccountDto, updatedById: string) {
    const existing = await this.accountRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    // Rule 1: Duplicate GST -> Reject
    if (dto.gstNumber && dto.gstNumber !== existing.gstNumber) {
      const existingGst = await this.accountRepository.findByGstNumber(dto.gstNumber);
      if (existingGst) {
        throw new ConflictException(`An account with GST number ${dto.gstNumber} already exists`);
      }
    }

    // Rule 2: Duplicate PAN -> Reject
    if (dto.panNumber && dto.panNumber !== existing.panNumber) {
      const existingPan = await this.accountRepository.findByPanNumber(dto.panNumber);
      if (existingPan) {
        throw new ConflictException(`An account with PAN number ${dto.panNumber} already exists`);
      }
    }

    // Rule 3: Duplicate Company Name -> Warn (configurable)
    if (dto.name && dto.name !== existing.name) {
      const existingName = await this.accountRepository.findByName(dto.name);
      if (existingName) {
        this.logger.warn(`Potential duplicate account name detected: "${dto.name}"`);
      }
    }

    const updated = await this.accountRepository.update(id, {
      name: dto.name,
      type: dto.type,
      industry: dto.industry,
      website: dto.website,
      email: dto.email,
      phone: dto.phone,
      gstNumber: dto.gstNumber,
      panNumber: dto.panNumber,
      annualRevenue: dto.annualRevenue !== undefined ? (dto.annualRevenue ? new Prisma.Decimal(dto.annualRevenue) : null) : undefined,
      employeeCount: dto.employeeCount,
      description: dto.description,
      preferredCommunication: dto.preferredCommunication,
      preferredLanguage: dto.preferredLanguage,
      kycStatus: dto.kycStatus,
      kycCompletedAt: dto.kycCompletedAt !== undefined ? (dto.kycCompletedAt ? new Date(dto.kycCompletedAt) : null) : undefined,
      updatedBy: { connect: { id: updatedById } },
    });

    return AccountMapper.toResponse(updated);
  }

  async remove(id: string, deletedById: string) {
    const existing = await this.accountRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    // Rule 5: Cannot delete an Account that still has active Contacts.
    if (existing.contacts && existing.contacts.length > 0) {
      throw new BadRequestException('Cannot delete account with active contacts.');
    }

    await this.accountRepository.softDelete(id, deletedById);

    return { message: `Account ${id} has been deleted` };
  }
}

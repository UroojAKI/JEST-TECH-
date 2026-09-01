import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { AccountMapper } from '../mappers/account.mapper';
import { AccountRepository } from '../repositories/account.repository';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

const GLOBAL_ROLES: RoleType[] = [RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO];

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  constructor(private readonly accountRepository: AccountRepository) {}

  private scope(actor: ActorContext): Prisma.AccountWhereInput {
    if (!actor?.userId || !actor.organizationId) throw new BadRequestException('Actor organizational context is required');
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.some((r) => GLOBAL_ROLES.includes(r))) return {};
    if (roles.includes(RoleType.BRANCH_MANAGER) || roles.includes(RoleType.MARKETING_DIRECTOR)) {
      if (!actor.branchId) throw new BadRequestException('Branch context is required');
      return { createdBy: { branchId: actor.branchId } };
    }
    if (roles.includes(RoleType.TEAM_LEADER) || roles.includes(RoleType.SALES_MANAGER)) {
      if (!actor.teamId) throw new BadRequestException('Team context is required');
      return { createdBy: { teamId: actor.teamId } };
    }
    return { createdById: actor.userId };
  }

  async create(dto: CreateAccountDto, createdById: string, actor?: ActorContext) {
    if (actor) this.scope(actor);
    if (dto.gstNumber && await this.accountRepository.findByGstNumber(dto.gstNumber)) throw new ConflictException(`An account with GST number ${dto.gstNumber} already exists`);
    if (dto.panNumber && await this.accountRepository.findByPanNumber(dto.panNumber)) throw new ConflictException(`An account with PAN number ${dto.panNumber} already exists`);
    const existingName = await this.accountRepository.findByName(dto.name);
    if (existingName) this.logger.warn(`Potential duplicate account name detected: "${dto.name}"`);
    const accountCode = await this.accountRepository.generateAccountCode();
    const account = await this.accountRepository.create({
      accountCode, name: dto.name, type: dto.type, industry: dto.industry, website: dto.website,
      email: dto.email, phone: dto.phone, gstNumber: dto.gstNumber, panNumber: dto.panNumber,
      annualRevenue: dto.annualRevenue ? new Prisma.Decimal(dto.annualRevenue) : undefined,
      employeeCount: dto.employeeCount, description: dto.description,
      preferredCommunication: dto.preferredCommunication, preferredLanguage: dto.preferredLanguage,
      kycStatus: dto.kycStatus, kycCompletedAt: dto.kycCompletedAt ? new Date(dto.kycCompletedAt) : undefined,
      createdBy: { connect: { id: createdById } }, updatedBy: { connect: { id: createdById } },
    });
    return AccountMapper.toResponse(account);
  }

  async findAll(pagination: PaginationDto, actor: ActorContext) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;
    const scope = this.scope(actor);
    const searchWhere: Prisma.AccountWhereInput = search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search, mode: 'insensitive' } },
    ] } : {};
    const where: Prisma.AccountWhereInput = Object.keys(scope).length ? { AND: [searchWhere, scope] } : searchWhere;
    const [accounts, total] = await Promise.all([
      this.accountRepository.findAll(where, skip, limit, { [sortBy]: sortOrder }),
      this.accountRepository.count(where),
    ]);
    return new PaginatedResponseDto(AccountMapper.toResponseList(accounts), total, page, limit);
  }

  async findById(id: string, actor?: ActorContext) {
    const scope = actor ? this.scope(actor) : {};
    const accounts = await this.accountRepository.findAll({ AND: [{ id }, scope] }, 0, 1);
    const account = accounts[0];
    if (!account) throw new NotFoundException(`Account with ID ${id} not found`);
    return AccountMapper.toResponse(account);
  }

  async update(id: string, dto: UpdateAccountDto, updatedById: string, actor: ActorContext) {
    const scope = this.scope(actor);
    const scoped = await this.accountRepository.findAll({ AND: [{ id }, scope] }, 0, 1);
    const existing = scoped[0];
    if (!existing) throw new NotFoundException(`Account with ID ${id} not found`);
    if (dto.gstNumber && dto.gstNumber !== existing.gstNumber && await this.accountRepository.findByGstNumber(dto.gstNumber)) throw new ConflictException(`An account with GST number ${dto.gstNumber} already exists`);
    if (dto.panNumber && dto.panNumber !== existing.panNumber && await this.accountRepository.findByPanNumber(dto.panNumber)) throw new ConflictException(`An account with PAN number ${dto.panNumber} already exists`);
    if (dto.name && dto.name !== existing.name && await this.accountRepository.findByName(dto.name)) this.logger.warn(`Potential duplicate account name detected: "${dto.name}"`);
    const updated = await this.accountRepository.update(id, {
      name: dto.name, type: dto.type, industry: dto.industry, website: dto.website, email: dto.email, phone: dto.phone,
      gstNumber: dto.gstNumber, panNumber: dto.panNumber,
      annualRevenue: dto.annualRevenue !== undefined ? (dto.annualRevenue ? new Prisma.Decimal(dto.annualRevenue) : null) : undefined,
      employeeCount: dto.employeeCount, description: dto.description, preferredCommunication: dto.preferredCommunication,
      preferredLanguage: dto.preferredLanguage, kycStatus: dto.kycStatus,
      kycCompletedAt: dto.kycCompletedAt !== undefined ? (dto.kycCompletedAt ? new Date(dto.kycCompletedAt) : null) : undefined,
      updatedBy: { connect: { id: updatedById } },
    });
    return AccountMapper.toResponse(updated);
  }

  async remove(id: string, deletedById: string, actor: ActorContext) {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.some((r) => GLOBAL_ROLES.includes(r))) throw new BadRequestException('Only administrators can delete accounts');
    await this.findById(id, actor);
    const existing = await this.accountRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException(`Account with ID ${id} not found`);
    if (existing.contacts && existing.contacts.length > 0) throw new BadRequestException('Cannot delete account with active contacts.');
    await this.accountRepository.softDelete(id, deletedById);
    return { message: `Account ${id} has been deleted` };
  }
}
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import { AuditAction, RoleType, UserStatus, Prisma } from '@prisma/client';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

import { UserMapper } from '../mappers/user.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getPrimaryOrganizationId(): Promise<string | null> {
    const company = await this.prisma.company.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return company?.id || null;
  }

  async generateEmployeeCode(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('employee_code_seq')`;
      return `EMP-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      await this.prisma
        .$executeRaw`CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;`;
      const retry = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('employee_code_seq')`;
      return `EMP-${retry[0].nextval.toString().padStart(6, '0')}`;
    }
  }

  async create(dto: CreateUserDto, actor?: any) {
    const actorCompanyId =
      actor?.companyId ||
      actor?.organizationId ||
      actor?.user?.companyId;

    if (
      actorCompanyId &&
      dto.companyId &&
      dto.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization user creation is strictly prohibited',
      );
    }

    let canonicalRole: RoleType = RoleType.AGENT;
    const rawRole = String(dto.role || '').toUpperCase();
    if (rawRole === 'ADMIN' || rawRole === 'SUPER_ADMIN') {
      canonicalRole = RoleType.ADMIN;
    } else if (
      [
        'BACK_OFFICE',
        'UNDERWRITER',
        'FINANCE',
        'CLAIMS_OFFICER',
        'BRANCH_MANAGER',
        'OPERATIONS',
      ].includes(rawRole)
    ) {
      canonicalRole = RoleType.BACK_OFFICE;
    } else {
      canonicalRole = RoleType.AGENT;
    }

    let role = await this.userRepository.findRoleByType(canonicalRole);

    if (!role) {
      role = await this.prisma.role.findFirst({
        where: { type: canonicalRole },
      });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name: String(canonicalRole),
            code: String(canonicalRole),
            type: canonicalRole,
          },
        });
      }
    }

    const initialPassword =
      dto.password || `${crypto.randomBytes(16).toString('hex')}A1`;
    const passwordHash = await argon2.hash(initialPassword);
    const empCode =
      dto.employeeCode || (await this.generateEmployeeCode());

    const targetBranchId = dto.branchId || dto.branch;
    let branchConnect: any = undefined;
    if (targetBranchId) {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          targetBranchId,
        );
      if (isUUID) {
        branchConnect = { connect: { id: targetBranchId } };
      }
    }

    const targetDepartmentId = (dto as any).departmentId || dto.department;
    let departmentConnect: any = undefined;
    if (targetDepartmentId) {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          targetDepartmentId,
        );
      if (isUUID) {
        departmentConnect = { connect: { id: targetDepartmentId } };
      }
    }

    const defaultCompanyId = await this.getPrimaryOrganizationId();
    const targetCompanyId = actorCompanyId || dto.companyId || defaultCompanyId;
    let companyConnect: any = undefined;
    if (targetCompanyId) {
      companyConnect = { connect: { id: targetCompanyId } };
    }

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      employeeCode: empCode,
      designation: (dto as any).designation,
      role: { connect: { id: role.id } },
      company: companyConnect,
      status: (dto as any).status || UserStatus.ACTIVE,
      branch: branchConnect,
      department: departmentConnect,
    });

    const response: any = UserMapper.toResponse(user);
    response.initialPassword = initialPassword;
    return response;
  }

  async adminResetPassword(userId: string, newPassword?: string, actor?: any) {
    await this.findById(userId, actor);
    const password =
      newPassword || `${crypto.randomBytes(16).toString('hex')}A1`;
    const passwordHash = await argon2.hash(password);
    await this.userRepository.update(userId, { passwordHash });
    return {
      success: true,
      message: 'Password reset successfully',
      newPassword: password,
    };
  }

  async changePassword(
    userId: string,
    currentPassword?: string,
    newPassword?: string,
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters long',
      );
    }

    if (currentPassword) {
      const isValid = await argon2.verify(user.passwordHash, currentPassword);
      if (!isValid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.userRepository.update(userId, { passwordHash });
    return { success: true, message: 'Password changed successfully' };
  }

  async findAll(pagination: PaginationDto, status?: string, actor?: any) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;

    const actorCompanyId =
      actor?.companyId ||
      actor?.organizationId ||
      actor?.user?.companyId;

    const where: Prisma.UserWhereInput = {
      ...(actorCompanyId ? { companyId: actorCompanyId } : {}),
    };
    if (pagination.search) {
      where.OR = [
        { firstName: { contains: pagination.search, mode: 'insensitive' } },
        { lastName: { contains: pagination.search, mode: 'insensitive' } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'ALL') {
      if (status === 'LOCKED') {
        where.status = UserStatus.SUSPENDED;
      } else if (status === 'DISABLED') {
        where.status = UserStatus.INACTIVE;
      } else if (Object.values(UserStatus).includes(status as UserStatus)) {
        where.status = status as UserStatus;
      }
    }

    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { createdAt: 'desc' };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { role: true, branch: true, team: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = UserMapper.toResponseList(users);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findById(id: string, actor?: any) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const actorCompanyId =
      actor?.companyId ||
      actor?.organizationId ||
      actor?.user?.companyId;
    if (actorCompanyId && user.companyId && user.companyId !== actorCompanyId) {
      throw new NotFoundException('User not found');
    }

    return UserMapper.toResponse(user);
  }

  async updateStatus(
    id: string,
    targetStatus: UserStatus,
    reason?: string,
    actorId?: string,
    actor?: any,
  ) {
    const actorCompanyId =
      actor?.companyId ||
      actor?.organizationId ||
      actor?.user?.companyId;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { role: true },
      });

      if (
        !user ||
        (actorCompanyId && user.companyId && user.companyId !== actorCompanyId)
      ) {
        throw new NotFoundException('User not found');
      }

      const currentStatus = user.status;

      if (currentStatus === targetStatus) {
        return UserMapper.toResponse(user);
      }

      // Explicit State Machine Rules:
      // PENDING_VERIFICATION -> ACTIVE
      // ACTIVE <-> SUSPENDED
      // ACTIVE <-> INACTIVE
      const validTransitions: Record<UserStatus, UserStatus[]> = {
        [UserStatus.PENDING_VERIFICATION]: [UserStatus.ACTIVE],
        [UserStatus.ACTIVE]: [UserStatus.SUSPENDED, UserStatus.INACTIVE],
        [UserStatus.SUSPENDED]: [UserStatus.ACTIVE],
        [UserStatus.INACTIVE]: [UserStatus.ACTIVE],
      };

      const allowed = validTransitions[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
        throw new BadRequestException(
          `Invalid status transition from ${currentStatus} to ${targetStatus}.`,
        );
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          status: targetStatus,
          updatedAt: new Date(),
        },
        include: { role: true },
      });

      // Audit trail logging
      await tx.auditLog
        .create({
          data: {
            action: 'UPDATE',
            entity: 'User',
            entityType: 'USER',
            entityId: id,
            userId: id,
            performedById: actorId || null,
            oldValue: { status: currentStatus },
            newValue: { status: targetStatus, reason: reason || null },
            module: 'USER_MANAGEMENT',
          },
        })
        .catch(() => {});

      return UserMapper.toResponse(updated);
    });
  }

  async lockUser(id: string, actorId?: string, actor?: any) {
    return this.updateStatus(
      id,
      UserStatus.SUSPENDED,
      'User locked by administrator',
      actorId,
      actor,
    );
  }

  async unlockUser(id: string, actorId?: string, actor?: any) {
    return this.updateStatus(
      id,
      UserStatus.ACTIVE,
      'User unlocked by administrator',
      actorId,
      actor,
    );
  }

  async update(id: string, dto: any, actor?: any) {
    await this.findById(id, actor);
    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.email) updateData.email = dto.email;
    if (dto.status) updateData.status = dto.status;
    if (dto.role) {
      const role = await this.userRepository.findRoleByType(dto.role);
      if (role) {
        updateData.role = { connect: { id: role.id } };
      }
    }
    const updated = await this.userRepository.update(id, updateData);
    return UserMapper.toResponse(updated);
  }

  async delete(id: string, actor?: any) {
    await this.findById(id, actor);
    const deleted = await this.userRepository.softDelete(id);
    return UserMapper.toResponse(deleted);
  }

  async findByEmailForAuth(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async updateLastLogin(userId: string): Promise<any> {
    return this.userRepository.updateLastLogin(userId);
  }

  async storeRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.userRepository.storeRefreshToken(data);
  }

  async findActiveRefreshTokens(userId: string) {
    return this.userRepository.findActiveRefreshTokens(userId);
  }

  async findUserRefreshTokens(userId: string) {
    return this.userRepository.findUserRefreshTokens(userId);
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    return this.userRepository.revokeRefreshToken(tokenId);
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    return this.userRepository.revokeAllUserRefreshTokens(userId);
  }

  async createAuditLog(data: {
    userId: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.userRepository.createAuditLog(data);
  }
}

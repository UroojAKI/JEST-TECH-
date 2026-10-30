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
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;

    if (actorCompanyId && dto.companyId && dto.companyId !== actorCompanyId) {
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
    const empCode = dto.employeeCode || (await this.generateEmployeeCode());

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
      collectContacts: canonicalRole === RoleType.AGENT && dto.collectContacts === true,
      employeeCode: empCode,
      designation: (dto as any).designation,
      role: { connect: { id: role.id } },
      company: companyConnect,
      status: (dto as any).status || UserStatus.ACTIVE,
      branch: branchConnect,
      department: departmentConnect,
    });

    if (canonicalRole === RoleType.AGENT && targetCompanyId) {
      try {
        const count = await this.prisma.agent.count({
          where: { companyId: targetCompanyId },
        });
        let nextNum = count + 1;
        let agentCode = `AGT-${String(nextNum).padStart(6, '0')}`;
        while (
          await this.prisma.agent.findFirst({
            where: { companyId: targetCompanyId, agentCode },
          })
        ) {
          nextNum++;
          agentCode = `AGT-${String(nextNum).padStart(6, '0')}`;
        }

        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        await this.prisma.agent.create({
          data: {
            companyId: targetCompanyId,
            userId: user.id,
            agentCode,
            agencyName: name ? `${name} Agency` : `Agency ${agentCode}`,
            commissionTier: 'STANDARD',
            isActive: true,
          },
        });
      } catch {
        // Safe fallback if agent profile already exists or in case of concurrency
      }
    }

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
    await this.revokeAllUserRefreshTokens(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
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
    if (!currentPassword) {
      throw new BadRequestException('Current password is required');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters long',
      );
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.userRepository.update(userId, { passwordHash });
    await this.revokeAllUserRefreshTokens(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
    return { success: true, message: 'Password changed successfully' };
  }

  async findAll(pagination: PaginationDto, status?: string, actor?: any) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;

    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;

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
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;
    if (actorCompanyId && user.companyId && user.companyId !== actorCompanyId) {
      throw new NotFoundException('User not found');
    }

    return UserMapper.toResponse(user);
  }

  async getUserWorkspace(id: string, actor?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        branch: true,
        team: true,
        department: true,
        agentProfile: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;
    if (actorCompanyId && user.companyId && user.companyId !== actorCompanyId) {
      throw new NotFoundException('User not found');
    }

    const companyId = user.companyId;
    const agentId = user.agentProfile?.id;

    const [
      leadsCreated,
      leadsAssigned,
      leadsConverted,
      leadsLost,
      contactsCreated,
      customersCreated,
      customersManaged,
      policiesIssued,
      renewalsPending,
      pendingTasks,
      overdueTasks,
      recentActivities,
      recentTasks,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: { createdById: id, companyId, deletedAt: null },
      }),
      this.prisma.lead.count({
        where: { assignedToId: id, companyId, deletedAt: null },
      }),
      this.prisma.lead.count({
        where: { assignedToId: id, status: 'CONVERTED', companyId, deletedAt: null },
      }),
      this.prisma.lead.count({
        where: { assignedToId: id, status: 'LOST', companyId, deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { createdById: id, companyId, deletedAt: null },
      }),
      this.prisma.customer.count({
        where: { createdById: id, companyId, deletedAt: null },
      }),
      agentId
        ? this.prisma.customer.count({
            where: { primaryAgentId: agentId, companyId, deletedAt: null },
          })
        : this.prisma.customer.count({
            where: { createdById: id, companyId, deletedAt: null },
          }),
      agentId
        ? this.prisma.policy.count({
            where: { agentId, status: 'ISSUED', companyId, deletedAt: null },
          })
        : this.prisma.policy.count({
            where: { createdById: id, status: 'ISSUED', companyId, deletedAt: null },
          }),
      this.prisma.policy.count({
        where: {
          companyId,
          deletedAt: null,
          status: 'ACTIVE',
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
          ...(agentId ? { agentId } : { createdById: id }),
        },
      }),
      this.prisma.task.count({
        where: {
          assignedToId: id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deletedAt: null,
        },
      }),
      this.prisma.task.count({
        where: {
          assignedToId: id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
          deletedAt: null,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [{ userId: id }, { performedById: id }],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.task.findMany({
        where: {
          assignedToId: id,
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
    ]);

    return {
      profile: {
        id: user.id,
        employeeCode: user.employeeCode,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone,
        designation: user.designation,
        department: user.department?.name || user.legacyDepartment,
        status: user.status,
        companyId: user.companyId,
        collectContacts: user.collectContacts,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
              type: user.role.type,
              description: user.role.description,
              permissions:
                user.role.permissions?.map((rp: any) => ({
                  id: rp.permission?.id,
                  code: rp.permission?.code,
                  name: rp.permission?.name,
                  category: rp.permission?.category,
                  scope: rp.scope,
                })) || [],
            }
          : null,
        branch: user.branch
          ? {
              id: user.branch.id,
              code: user.branch.code,
              name: user.branch.name,
              city: user.branch.city,
            }
          : null,
        team: user.team
          ? {
              id: user.team.id,
              name: user.team.name,
            }
          : null,
        agentProfile: user.agentProfile
          ? {
              id: user.agentProfile.id,
              agentCode: user.agentProfile.agentCode,
              agencyName: user.agentProfile.agencyName,
              licenseNumber: user.agentProfile.licenseNumber,
              commissionTier: user.agentProfile.commissionTier,
              isActive: user.agentProfile.isActive,
            }
          : null,
      },
      portfolio: {
        leadsCreated,
        leadsAssigned,
        leadsConverted,
        leadsLost,
        contactsCreated,
        customersCreated,
        customersManaged,
        policiesIssued,
        renewalsPending,
        pendingTasks,
        overdueTasks,
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
        details: a.newValue || a.metadata,
      })),
      recentTasks: recentTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
      })),
    };
  }

  async updateStatus(
    id: string,
    targetStatus: UserStatus,
    reason?: string,
    actorId?: string,
    actor?: any,
  ) {
    const actorCompanyId =
      actor?.companyId || actor?.organizationId || actor?.user?.companyId;

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
    if (dto.collectContacts !== undefined) {
      const targetUser = await this.userRepository.findById(id);
      const targetRole = targetUser?.role?.type;
      if (dto.collectContacts === true && targetRole !== RoleType.AGENT) {
        throw new BadRequestException(
          'Contact collection preference can only be enabled for agent users',
        );
      }
      updateData.collectContacts =
        targetRole === RoleType.AGENT && dto.collectContacts === true;
    }
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

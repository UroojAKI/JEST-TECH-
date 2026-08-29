import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuditAction, RoleType, Prisma } from '@prisma/client';

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

  async create(dto: CreateUserDto) {
    let role = await this.userRepository.findRoleByType(dto.role);

    if (!role) {
      // Find any existing role or create the requested role type
      role = await this.prisma.role.findFirst({ where: { type: dto.role } });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name: String(dto.role),
            code: String(dto.role),
            type: dto.role,
          },
        });
      }
    }

    const initialPassword = dto.password || 'JestPolicy2026!';
    const passwordHash = await argon2.hash(initialPassword);
    const empCode =
      dto.employeeCode || `EMP-${Date.now().toString().slice(-6)}`;

    const user = await this.userRepository.create({
      employeeCode: empCode,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone || null,
      passwordHash,
      status: 'ACTIVE',
      isEmailVerified: true,
      role: {
        connect: {
          id: role.id,
        },
      },
    });

    const response: any = UserMapper.toResponse(user);
    response.initialPassword = initialPassword;
    return response;
  }

  async adminResetPassword(userId: string, newPassword?: string) {
    await this.findById(userId);
    const password = newPassword || 'JestPolicy2026!';
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

  async findAll(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (pagination.search) {
      where.OR = [
        { firstName: { contains: pagination.search, mode: 'insensitive' } },
        { lastName: { contains: pagination.search, mode: 'insensitive' } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
      ];
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
        include: { role: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = UserMapper.toResponseList(users);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findById(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserMapper.toResponse(user);
  }

  async lockUser(id: string) {
    await this.findById(id);
    const updated = await this.userRepository.updateStatus(id, 'SUSPENDED');
    return UserMapper.toResponse(updated);
  }

  async unlockUser(id: string) {
    await this.findById(id);
    const updated = await this.userRepository.updateStatus(id, 'ACTIVE');
    return UserMapper.toResponse(updated);
  }

  async update(id: string, dto: any) {
    await this.findById(id);
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

  async delete(id: string) {
    await this.findById(id);
    const deleted = await this.userRepository.softDelete(id);
    return UserMapper.toResponse(deleted);
  }

  async findByEmailForAuth(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async updateLastLogin(userId: string): Promise<void> {
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

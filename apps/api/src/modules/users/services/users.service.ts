import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuditAction, RoleType } from '@prisma/client';

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

    const passwordHash = await argon2.hash(dto.password || 'JestPolicy2026!');
    const empCode = dto.employeeCode || `EMP-${Date.now().toString().slice(-6)}`;

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

    return UserMapper.toResponse(user);
  }

  async findAll() {
    const users = await this.userRepository.findAll();

    return UserMapper.toResponseList(users);
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

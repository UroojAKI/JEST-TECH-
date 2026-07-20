import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuditAction, RoleType } from '@prisma/client';

import { UserMapper } from '../mappers/user.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(dto: CreateUserDto) {
    const role = await this.userRepository.findRoleByType(dto.role);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
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

  /**
   * FOR AUTHENTICATION USE ONLY.
   * Returns the raw user entity including passwordHash.
   * Never expose this through a controller endpoint.
   */
  async findByEmailForAuth(email: string) {
    return this.userRepository.findByEmail(email);
  }

  /**
   * FOR AUTHENTICATION USE ONLY.
   * Stamps lastLoginAt on the user record.
   */
  async updateLastLogin(userId: string): Promise<void> {
    return this.userRepository.updateLastLogin(userId);
  }

  /**
   * FOR AUTHENTICATION USE ONLY.
   * Stores the hashed refresh token in the database.
   */
  async storeRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.userRepository.storeRefreshToken(data);
  }

  /**
   * FOR AUTHENTICATION USE ONLY.
   * Writes an audit log entry for the given action.
   */
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

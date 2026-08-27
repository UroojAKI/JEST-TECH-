import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma, RoleType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

// ---------------------------------------------------------------------------
// Precise return type for queries that include the role relation.
// Prisma.UserGetPayload derives the exact shape TypeScript needs — it
// accounts for every field returned by `include: { role: true }` without
// manual duplication.
// ---------------------------------------------------------------------------
const userIncludeClause = {
  role: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
  branch: {
    include: {
      zone: {
        include: {
          region: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  },
  department: true,
  team: true,
  jobRole: true,
};

const userWithRole = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: userIncludeClause,
});

export type UserWithRole = Prisma.UserGetPayload<typeof userWithRole>;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<UserWithRole> {
    return this.prisma.user.create({
      data,
      include: userIncludeClause,
    });
  }

  async findRoleByType(type: RoleType) {
    return this.prisma.role.findUnique({
      where: {
        type,
      },
    });
  }

  async findAll(): Promise<UserWithRole[]> {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      include: userIncludeClause,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: userIncludeClause,
    });
  }

  async updateStatus(id: string, status: any): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      include: userIncludeClause,
    });
  }

  async findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: userIncludeClause,
    });
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput,
  ): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: userIncludeClause,
    });
  }

  async softDelete(id: string): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
      include: userIncludeClause,
    });
  }

  // ---------------------------------------------------------------------------
  // Auth helpers — called only by AuthService, never exposed through controllers
  // ---------------------------------------------------------------------------

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async storeRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async findActiveRefreshTokens(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }



  async createAuditLog(data: {
    userId: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { RoleType, AccessScope } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

export interface UpdateRolePermissionsDto {
  permissions: Array<{
    permissionId: string;
    scope?: AccessScope;
  }>;
}

@ApiTags('Administration - Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get all system roles' })
  async getRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code || r.type,
      name: r.name,
      description: r.description,
      type: r.type,
      permissionsCount: r.permissions.length,
    }));
  }

  @Get(':roleId/permissions')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get permissions for a specific role' })
  async getRolePermissions(@Param('roleId') roleId: string) {
    // Find role by id or by code/type
    const role = await this.prisma.role.findFirst({
      where: {
        OR: [{ id: roleId }, { code: roleId }, { type: roleId as RoleType }],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    return {
      role: {
        id: role.id,
        code: role.code || role.type,
        name: role.name,
        type: role.type,
        description: role.description,
      },
      permissions: role.permissions.map((rp) => ({
        id: rp.id,
        permissionId: rp.permissionId,
        code: rp.permission.code,
        name: rp.permission.name,
        category: rp.permission.category,
        description: rp.permission.description,
        scope: rp.scope,
      })),
    };
  }

  @Put(':roleId/permissions')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update permissions for a specific role' })
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const role = await this.prisma.role.findFirst({
      where: {
        OR: [{ id: roleId }, { code: roleId }, { type: roleId as RoleType }],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    if (!Array.isArray(dto.permissions)) {
      throw new BadRequestException('Permissions must be an array');
    }

    // Validate permission IDs exist
    const permissionIds = dto.permissions.map((p) => p.permissionId).filter(Boolean);
    const validPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });
    const validIdSet = new Set(validPermissions.map((p) => p.id));

    return this.prisma.$transaction(async (tx) => {
      // Delete existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      // Insert new role permissions
      const toCreate = dto.permissions
        .filter((p) => validIdSet.has(p.permissionId))
        .map((p) => ({
          roleId: role.id,
          permissionId: p.permissionId,
          scope: p.scope && Object.values(AccessScope).includes(p.scope) ? p.scope : AccessScope.ORGANIZATION,
        }));

      if (toCreate.length > 0) {
        await tx.rolePermission.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }

      // Log audit
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'RolePermission',
          entityType: 'ROLE_PERMISSION',
          entityId: role.id,
          performedById: actor?.id || null,
          newValue: { permissionsCount: toCreate.length },
          module: 'ADMIN_RBAC',
        },
      }).catch(() => {});

      return {
        success: true,
        message: `Updated permissions for role ${role.name}`,
        count: toCreate.length,
      };
    });
  }
}

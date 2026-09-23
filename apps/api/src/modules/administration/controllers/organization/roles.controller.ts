import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
    permissionId?: string;
    category?: string;
    action?: string;
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

    // SEC-010 FIX: Role definitions are system-wide resources. Only platform super-admins
    // (identified by permissions: ['*']) may mutate them. Tenant-level ADMINs are blocked
    // from altering global role definitions to prevent cross-tenant privilege escalation.
    const isSuperAdmin =
      Array.isArray((actor as any).permissions) &&
      (actor as any).permissions.includes('*');
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'Only platform super-administrators may modify system-wide role permissions. Contact your platform administrator.',
      );
    }

    if (!Array.isArray(dto.permissions)) {
      throw new BadRequestException('Permissions must be an array');
    }

    return this.prisma.$transaction(async (tx) => {
      const resolvedIds = new Set<string>();
      const toCreateRoleLinks: any[] = [];

      for (const p of dto.permissions) {
        if (p.permissionId) {
          resolvedIds.add(p.permissionId);
          toCreateRoleLinks.push({
            roleId: role.id,
            permissionId: p.permissionId,
            scope:
              p.scope && Object.values(AccessScope).includes(p.scope)
                ? p.scope
                : AccessScope.ORGANIZATION,
          });
        } else if (p.category && p.action) {
          const actionCode = p.action.toUpperCase();
          const categorySlug = p.category
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_');
          const code = `${actionCode}_${categorySlug}`;

          let perm = await tx.permission.findFirst({
            where: { code },
          });

          if (!perm) {
            perm = await tx.permission.create({
              data: {
                name: `${p.action.charAt(0).toUpperCase() + p.action.slice(1)} ${p.category}`,
                code,
                category: 'SYSTEM',
                description: `Allows ${p.action} operations on ${p.category}`,
              },
            });
          }

          if (!resolvedIds.has(perm.id)) {
            resolvedIds.add(perm.id);
            toCreateRoleLinks.push({
              roleId: role.id,
              permissionId: perm.id,
              scope:
                p.scope && Object.values(AccessScope).includes(p.scope)
                  ? p.scope
                  : AccessScope.ORGANIZATION,
            });
          }
        }
      }

      // Delete existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      // Insert new role permissions
      if (toCreateRoleLinks.length > 0) {
        await tx.rolePermission.createMany({
          data: toCreateRoleLinks,
          skipDuplicates: true,
        });
      }

      // Log audit
      await tx.auditLog
        .create({
          data: {
            action: 'UPDATE',
            entity: 'RolePermission',
            entityType: 'ROLE_PERMISSION',
            entityId: role.id,
            performedById: actor?.id || null,
            newValue: { permissionsCount: toCreateRoleLinks.length },
            module: 'ADMIN_RBAC',
          },
        })
        .catch(() => {});

      return {
        success: true,
        message: `Updated permissions for role ${role.name}`,
        count: toCreateRoleLinks.length,
      };
    });
  }
}

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
import { RoleType, AccessScope, PermissionCategory } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { PERMISSION_CATALOG } from '../../../auth/constants/permission-catalog';
import { PlatformPrivilegeResolver } from '../../../../common/services/platform-privilege.resolver';

export interface UpdateRolePermissionsDto {
  permissions: Array<{
    permissionId?: string;
    code?: string;
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
  async getRoles(@CurrentUser() actor?: RequestUser) {
    if (actor && actor.role === RoleType.AGENT) {
      throw new ForbiddenException('Agents are not authorized to view role definitions');
    }

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
  async getRolePermissions(
    @Param('roleId') roleId: string,
    @CurrentUser() actor?: RequestUser,
  ) {
    if (actor && actor.role === RoleType.AGENT) {
      throw new ForbiddenException('Agents are not authorized to view role definitions');
    }

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
    // SEC-010 & Phase 2 Enforce Authoritative Platform Privilege
    // Role definitions are global platform resources. Only verified platform super-administrators
    // (verified via server-controlled PlatformPrivilegeResolver) may mutate them.
    // Tenant Admins, Back Office, and Agents are strictly denied.
    PlatformPrivilegeResolver.assertPlatformAdmin(actor);

    if (!dto || !Array.isArray(dto.permissions)) {
      throw new BadRequestException('Permissions must be an array');
    }

    const role = await this.prisma.role.findFirst({
      where: {
        OR: [{ id: roleId }, { code: roleId }, { type: roleId as RoleType }],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    // Input-level validation: prevent platform escalation, duplicate keys, and invalid scopes
    const seenRequestKeys = new Set<string>();
    for (const p of dto.permissions) {
      if (!p || (!p.permissionId && !p.code && !(p.category && p.action))) {
        throw new BadRequestException(
          'Each permission item must specify at least a permissionId, code, or action and category.',
        );
      }

      const code = (p.code || '').trim();
      const cat = (p.category || '').trim().toUpperCase();
      const act = (p.action || '').trim().toUpperCase();

      // Prevent self-granting of platform-admin privileges through ordinary role updates
      if (
        code === '*' ||
        code.toUpperCase() === 'PLATFORM_SUPER_ADMIN' ||
        code.toUpperCase() === 'SUPER_ADMIN' ||
        code.toLowerCase().includes('platform') ||
        act === '*' ||
        act === 'PLATFORM_SUPER_ADMIN' ||
        cat === 'PLATFORM_SUPER_ADMIN'
      ) {
        throw new ForbiddenException(
          'Self-granting platform super-admin privileges or wildcard permissions is strictly prohibited.',
        );
      }

      // Validate scope against allowed AccessScope values
      if (p.scope && !Object.values(AccessScope).includes(p.scope)) {
        throw new BadRequestException(
          `Invalid scope '${p.scope}'. Scope must be one of: ${Object.values(AccessScope).join(', ')}`,
        );
      }

      let reqKey = '';
      if (p.permissionId) {
        reqKey = `id:${p.permissionId.trim()}`;
      } else if (p.code) {
        reqKey = `code:${code.toLowerCase()}`;
      } else {
        reqKey = `cat_act:${cat}:${act}`;
      }

      if (seenRequestKeys.has(reqKey)) {
        throw new BadRequestException(
          `Duplicate permission entry detected in request: ${reqKey}`,
        );
      }
      seenRequestKeys.add(reqKey);
    }

    return this.prisma.$transaction(async (tx) => {
      const resolvedIds = new Set<string>();
      const toCreateRoleLinks: Array<{
        roleId: string;
        permissionId: string;
        scope: AccessScope;
      }> = [];

      for (const p of dto.permissions) {
        let perm: { id: string; code: string } | null = null;

        if (p.permissionId) {
          perm = await tx.permission.findUnique({
            where: { id: p.permissionId },
          });
          if (!perm) {
            throw new BadRequestException(
              `Permission with ID '${p.permissionId}' not found. All permissions must belong to the canonical permission catalog.`,
            );
          }
        } else if (p.code) {
          const rawCode = p.code.trim();
          const catalogEntry = PERMISSION_CATALOG.find(
            (c) =>
              c.code.toLowerCase() === rawCode.toLowerCase() ||
              c.code.toUpperCase() === rawCode.toUpperCase(),
          );

          perm = await tx.permission.findFirst({
            where: {
              OR: [
                { code: rawCode },
                { code: rawCode.toLowerCase() },
                { code: rawCode.toUpperCase() },
              ],
            },
          });

          if (!perm && !catalogEntry) {
            throw new BadRequestException(
              `Unknown permission code '${p.code}'. All permissions must belong to the canonical permission catalog.`,
            );
          }

          if (!perm && catalogEntry) {
            perm = await tx.permission.create({
              data: {
                name: catalogEntry.name,
                code: catalogEntry.code,
                category: (catalogEntry.category as PermissionCategory) || PermissionCategory.SYSTEM,
                description: catalogEntry.description,
              },
            });
          }
        } else if (p.category && p.action) {
          const actionCode = p.action.toUpperCase();
          const categorySlug = p.category
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_');
          const codeUpper = `${actionCode}_${categorySlug}`;
          const codeColon = `${p.action.toLowerCase()}:${p.category.toLowerCase()}`;

          const catalogEntry = PERMISSION_CATALOG.find(
            (c) =>
              c.code.toLowerCase() === codeColon ||
              c.code.toUpperCase() === codeUpper,
          );

          perm = await tx.permission.findFirst({
            where: {
              OR: [
                { code: codeUpper },
                { code: codeColon },
              ],
            },
          });

          if (!perm && !catalogEntry) {
            throw new BadRequestException(
              `Unknown permission category '${p.category}' and action '${p.action}'. All permissions must belong to the canonical permission catalog.`,
            );
          }

          if (!perm && catalogEntry) {
            perm = await tx.permission.create({
              data: {
                name: catalogEntry.name,
                code: catalogEntry.code,
                category: (catalogEntry.category as PermissionCategory) || PermissionCategory.SYSTEM,
                description: catalogEntry.description,
              },
            });
          }
        }

        if (!perm) {
          throw new BadRequestException('Unable to resolve permission');
        }

        if (resolvedIds.has(perm.id)) {
          throw new BadRequestException(
            `Duplicate permission detected for permission code '${perm.code}'.`,
          );
        }

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

      // Capture previous permissions before updating for durable audit trail
      const existingRolePerms = await tx.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });
      const oldPermissionCodes = existingRolePerms.map(
        (rp) => rp.permission?.code || rp.permissionId,
      );

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

      // Durable transactional audit logging (no silent catch - if auditLog fails, transaction rolls back)
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'RolePermission',
          entityType: 'ROLE_PERMISSION',
          entityId: role.id,
          performedById: actor?.id || null,
          metadata: { companyId: actor?.companyId || null },
          oldValue: {
            roleCode: role.code || role.type,
            permissionsCount: oldPermissionCodes.length,
            permissions: oldPermissionCodes,
          },
          newValue: {
            roleCode: role.code || role.type,
            permissionsCount: toCreateRoleLinks.length,
            permissions: Array.from(resolvedIds),
          },
          module: 'ADMIN_RBAC',
        },
      });

      return {
        success: true,
        message: `Updated permissions for role ${role.name}`,
        count: toCreateRoleLinks.length,
      };
    });
  }
}

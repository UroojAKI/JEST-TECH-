import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';
import { Prisma, RoleType, UserStatus } from '@prisma/client';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { PlatformPrivilegeResolver } from '../../../../common/services/platform-privilege.resolver';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if the actor is an authoritative platform super-administrator.
   * Broad RoleType.ADMIN check is removed: Tenant Admins are strictly company-scoped.
   */
  private isSuperAdmin(actor?: ActorContext): boolean {
    return PlatformPrivilegeResolver.isPlatformAdmin(actor);
  }

  /**
   * Asserts and returns the actor's company context.
   * Only verified platform super-administrators can bypass the organization constraint.
   */
  private assertActorOrg(actor?: ActorContext): string {
    if (this.isSuperAdmin(actor)) return '';
    const orgId = actor?.companyId || actor?.organizationId;
    if (!orgId) {
      throw new ForbiddenException('Actor organizational context is required');
    }
    return orgId;
  }

  /**
   * Retrieves organization hierarchy.
   * - Platform Super Admin: Can view all companies' hierarchies.
   * - Tenant Admin & Back Office: Strictly restricted to their own company hierarchy.
   * - Agent: Blocked unless separately authorized.
   */
  async getHierarchy(actor?: ActorContext) {
    if (
      actor?.role === RoleType.AGENT &&
      !actor.permissions?.includes('organization:read') &&
      !actor.permissions?.includes('hierarchy:read')
    ) {
      throw new ForbiddenException(
        'Agent is not authorized to access administrative hierarchy',
      );
    }

    const isSuper = this.isSuperAdmin(actor);
    const orgId = actor?.companyId || actor?.organizationId;

    const where: Prisma.CompanyWhereInput = { isActive: true };
    if (!isSuper) {
      if (!orgId) {
        throw new ForbiddenException('Actor organizational context is required');
      }
      where.id = orgId;
    }

    return this.prisma.company.findMany({
      where,
      include: {
        regions: {
          where: { isActive: true },
          include: {
            zones: {
              where: { isActive: true },
              include: {
                branches: {
                  where: { isActive: true },
                  include: {
                    departments: {
                      where: { isActive: true },
                      include: {
                        teams: {
                          where: { isActive: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getBranches(pagination: PaginationDto, actor?: ActorContext) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;
    const orgId = this.assertActorOrg(actor);

    const where: Prisma.BranchWhereInput = { isActive: true };
    if (orgId) {
      where.zone = { region: { companyId: orgId } };
    }
    if (pagination.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: pagination.search, mode: 'insensitive' } },
            { code: { contains: pagination.search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { displayOrder: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          zone: {
            include: {
              region: true,
            },
          },
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getDepartments(
    pagination: PaginationDto,
    branchId: string,
    actor?: ActorContext,
  ) {
    const orgId = this.assertActorOrg(actor);
    if (orgId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: branchId,
          isActive: true,
          zone: { region: { companyId: orgId } },
        },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch ${branchId} not found in your organization`,
        );
      }
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;
    const where: Prisma.DepartmentWhereInput = { branchId, isActive: true };
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { displayOrder: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        skip,
        take: limit,
        where,
        orderBy,
      }),
      this.prisma.department.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getTeams(
    pagination: PaginationDto,
    departmentId: string,
    actor?: ActorContext,
  ) {
    const orgId = this.assertActorOrg(actor);
    if (orgId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          isActive: true,
          branch: { zone: { region: { companyId: orgId } } },
        },
      });
      if (!department) {
        throw new NotFoundException(
          `Department ${departmentId} not found in your organization`,
        );
      }
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 25;
    const skip = (page - 1) * limit;
    const where: Prisma.TeamWhereInput = { departmentId, isActive: true };
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
      : { name: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.team.findMany({
        skip,
        take: limit,
        where,
        orderBy,
      }),
      this.prisma.team.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getZones(actor?: ActorContext) {
    const orgId = this.assertActorOrg(actor);
    const where: Prisma.ZoneWhereInput = { isActive: true };
    if (orgId) {
      where.region = { companyId: orgId };
    }
    return this.prisma.zone.findMany({
      where,
      include: {
        region: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Phase 3: Multi-level hierarchy verification and atomic team assignment.
   *
   * Verifies the full relationship:
   * Company -> Region -> Zone -> Branch -> Department -> Team -> Employee
   */
  async assignUserToTeam(userId: string, teamId: string, actor?: ActorContext) {
    const isSuper = this.isSuperAdmin(actor);
    const actorCompanyId = actor?.companyId || actor?.organizationId;
    if (!isSuper && !actorCompanyId) {
      throw new ForbiddenException('Actor organizational context is required');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify target employee exists
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          branch: true,
          department: true,
          team: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Verify target employee is active
      if (
        user.status !== UserStatus.ACTIVE &&
        (user.status as string) !== 'ACTIVE'
      ) {
        throw new BadRequestException('Target employee is not active');
      }

      // 3. Verify employee belongs to permitted company
      if (!isSuper && user.companyId !== actorCompanyId) {
        throw new ForbiddenException('User belongs to another organization');
      }

      // 4. Verify target team exists with full parent hierarchy
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: {
          department: {
            include: {
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
            },
          },
        },
      });

      if (!team) {
        throw new NotFoundException('Team not found in your organization');
      }

      // 5. Verify target team is active
      if (team.isActive === false) {
        throw new BadRequestException('Target team is inactive');
      }

      // 6. Verify team belongs to an active Department
      if (!team.department) {
        throw new BadRequestException(
          'Target team is not associated with any department',
        );
      }
      if (team.department.isActive === false) {
        throw new BadRequestException('Target department is inactive');
      }

      // 7. Verify Department belongs to an active Branch
      if (!team.department.branch) {
        throw new BadRequestException(
          'Target department is not associated with any branch',
        );
      }
      if (team.department.branch.isActive === false) {
        throw new BadRequestException('Target branch is inactive');
      }

      // 8. Verify Branch belongs to an active Zone
      if (!team.department.branch.zone) {
        throw new BadRequestException(
          'Target branch is not associated with any zone',
        );
      }
      if (team.department.branch.zone.isActive === false) {
        throw new BadRequestException('Target zone is inactive');
      }

      // 9. Verify Region is active
      if (team.department.branch.zone.region?.isActive === false) {
        throw new BadRequestException('Target region is inactive');
      }

      // 10. Verify Zone belongs to the employee's company
      const teamCompanyId = team.department.branch.zone.region?.companyId;
      if (!teamCompanyId || teamCompanyId !== user.companyId) {
        throw new ForbiddenException(
          'Target team belongs to a different company than the employee',
        );
      }

      // If actor is tenant admin, verify team belongs to actor's organization
      if (!isSuper && teamCompanyId !== actorCompanyId) {
        throw new ForbiddenException('Team does not belong to your organization');
      }

      // Check if this assignment constitutes a cross-branch transfer
      const isBranchTransfer = Boolean(
        user.branchId && user.branchId !== team.department.branchId,
      );

      // 11. Atomically update user hierarchy
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          teamId: team.id,
          departmentId: team.departmentId,
          branchId: team.department.branchId,
        },
      });

      // Record before/after state in audit log in the same transaction
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'UserHierarchy',
          entityType: 'USER_HIERARCHY',
          entityId: user.id,
          performedById: actor?.userId || (actor as any)?.id || null,
          metadata: {
            companyId: user.companyId,
            transferType: isBranchTransfer
              ? 'BRANCH_TRANSFER'
              : 'TEAM_ASSIGNMENT',
          },
          oldValue: {
            branchId: user.branchId,
            departmentId: user.departmentId,
            teamId: user.teamId,
          },
          newValue: {
            branchId: team.department.branchId,
            departmentId: team.departmentId,
            teamId: team.id,
            zoneId: team.department.branch.zoneId,
            regionId: team.department.branch.zone.regionId,
            companyId: teamCompanyId,
          },
          module: 'ORGANIZATION',
        },
      });

      return updatedUser;
    });
  }

  /**
   * Phase 3.2: Branch creation with explicit state requirement (no region name fallback).
   */
  async createBranch(
    dto: {
      name: string;
      code: string;
      city: string;
      state?: string;
      address?: string;
      zoneId?: string;
    },
    actor?: ActorContext,
  ) {
    const orgId = this.assertActorOrg(actor);

    if (!dto.name?.trim()) {
      throw new BadRequestException('Branch name is required');
    }
    if (!dto.code?.trim()) {
      throw new BadRequestException('Branch code is required');
    }
    if (!dto.city?.trim()) {
      throw new BadRequestException('City is required');
    }
    if (!dto.zoneId) {
      throw new BadRequestException(
        'Zone ID is required to place branch within the organizational hierarchy',
      );
    }

    // Phase 3.2: State must be explicitly provided. Region display name fallback is removed.
    const state = dto.state?.trim();
    if (!state) {
      throw new BadRequestException(
        'State is required for branch location and must be explicitly specified',
      );
    }

    // Verify Zone -> Region -> Company hierarchy
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: dto.zoneId,
        isActive: true,
        ...(orgId ? { region: { companyId: orgId } } : {}),
      },
      include: {
        region: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!zone) {
      throw new BadRequestException(
        'Specified zone does not exist or does not belong to your organization',
      );
    }

    const branchCode = dto.code.trim().toUpperCase();

    // Check duplicate branch code within the tenant organization
    const existing = await this.prisma.branch.findFirst({
      where: {
        code: branchCode,
        zone: { region: { companyId: zone.region.companyId } },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Branch with code '${branchCode}' already exists in your organization`,
      );
    }

    return this.prisma.branch.create({
      data: {
        name: dto.name.trim(),
        code: branchCode,
        city: dto.city.trim(),
        state,
        address: dto.address?.trim() || null,
        zoneId: zone.id,
        isActive: true,
      },
      include: {
        zone: {
          include: {
            region: true,
          },
        },
      },
    });
  }
}

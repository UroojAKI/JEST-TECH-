import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(actor?: ActorContext): boolean {
    return (
      actor?.roles?.includes(RoleType.ADMIN) ||
      actor?.role === RoleType.ADMIN ||
      false
    );
  }

  private assertActorOrg(actor?: ActorContext): string {
    if (this.isSuperAdmin(actor)) return '';
    if (!actor?.organizationId) {
      throw new ForbiddenException('Actor organizational context is required');
    }
    return actor.organizationId;
  }

  async getHierarchy(actor?: ActorContext) {
    const orgId = this.assertActorOrg(actor);
    const where: Prisma.CompanyWhereInput = { isActive: true };
    if (orgId) {
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

  async assignUserToTeam(userId: string, teamId: string, actor?: ActorContext) {
    const orgId = this.assertActorOrg(actor);
    const teamWhere: Prisma.TeamWhereInput = { id: teamId };
    if (orgId) {
      teamWhere.department = {
        branch: { zone: { region: { companyId: orgId } } },
      };
    }

    const team = await this.prisma.team.findFirst({
      where: teamWhere,
      include: { department: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found in your organization');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        teamId: team.id,
        departmentId: team.departmentId,
        branchId: team.department.branchId,
      },
    });
  }

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
    let zoneId = dto.zoneId;
    if (!zoneId) {
      const zoneWhere: Prisma.ZoneWhereInput = { isActive: true };
      if (orgId) {
        zoneWhere.region = { companyId: orgId };
      }
      const zone = await this.prisma.zone.findFirst({
        where: zoneWhere,
      });
      if (!zone) {
        throw new BadRequestException(
          'No active zone configured to attach branch in your organization',
        );
      }
      zoneId = zone.id;
    } else if (orgId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: zoneId, isActive: true, region: { companyId: orgId } },
      });
      if (!zone) {
        throw new BadRequestException(
          'Specified zone does not belong to your organization',
        );
      }
    }

    return this.prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        city: dto.city,
        state: dto.state || 'Maharashtra',
        address: dto.address || null,
        zoneId,
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

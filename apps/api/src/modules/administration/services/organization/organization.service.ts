import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getHierarchy() {
    return this.prisma.company.findMany({
      where: { isActive: true },
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

  async getBranches(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.BranchWhereInput = { isActive: true };
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

  async getDepartments(pagination: PaginationDto, branchId: string) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
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

  async getTeams(pagination: PaginationDto, departmentId: string) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
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

  async assignUserToTeam(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { department: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
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

  async createBranch(dto: {
    name: string;
    code: string;
    city: string;
    state?: string;
    address?: string;
    zoneId?: string;
  }) {
    let zoneId = dto.zoneId;
    if (!zoneId) {
      const zone = await this.prisma.zone.findFirst({ where: { isActive: true } });
      if (!zone) {
        throw new BadRequestException('No active zone configured to attach branch');
      }
      zoneId = zone.id;
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

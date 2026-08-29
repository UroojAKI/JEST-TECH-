import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateDashboardRegistryDto,
  UpdateDashboardRegistryDto,
} from '../dto/dashboard-registry.dto';

@Injectable()
export class DashboardRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: import('../../../common/pagination/pagination.dto').PaginationDto,
  ) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (pagination.search) {
      where['dashboardCode'] = {
        contains: pagination.search,
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.dashboardRegistry.findMany({
        skip,
        take: limit,
        where,
        orderBy: pagination.sortBy
          ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any)
          : undefined,
        include: { jobRole: { include: { department: true } } },
      }),
      this.prisma.dashboardRegistry.count({ where }),
    ]);

    return { data, total };
  }

  async findByDashboardCode(dashboardCode: string) {
    return this.prisma.dashboardRegistry.findUnique({
      where: { dashboardCode },
      include: { jobRole: { include: { department: true } } },
    });
  }

  async findByJobRoleId(jobRoleId: string) {
    return this.prisma.dashboardRegistry.findFirst({
      where: { jobRoleId },
      include: { jobRole: { include: { department: true } } },
    });
  }

  async create(dto: CreateDashboardRegistryDto) {
    return this.prisma.dashboardRegistry.create({
      data: dto,
      include: { jobRole: true },
    });
  }

  async update(dashboardCode: string, dto: UpdateDashboardRegistryDto) {
    return this.prisma.dashboardRegistry.update({
      where: { dashboardCode },
      data: dto,
      include: { jobRole: true },
    });
  }
}

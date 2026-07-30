import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateDashboardRegistryDto, UpdateDashboardRegistryDto } from '../dto/dashboard-registry.dto';

@Injectable()
export class DashboardRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.dashboardRegistry.findMany({
      include: { jobRole: { include: { department: true } } },
    });
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

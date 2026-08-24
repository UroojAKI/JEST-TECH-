import { Injectable, NotFoundException } from '@nestjs/common';
import { DashboardRegistryRepository } from '../repositories/dashboard-registry.repository';
import { CreateDashboardRegistryDto, UpdateDashboardRegistryDto } from '../dto/dashboard-registry.dto';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';

@Injectable()
export class DashboardRegistryService {
  constructor(private readonly repository: DashboardRegistryRepository) {}

  async getAll(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const { data, total } = await this.repository.findAll({ ...pagination, page, limit });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getByCode(dashboardCode: string) {
    const registry = await this.repository.findByDashboardCode(dashboardCode);
    if (!registry) {
      throw new NotFoundException(`Dashboard Registry '${dashboardCode}' not found`);
    }
    return registry;
  }

  async getByJobRoleId(jobRoleId: string) {
    const registry = await this.repository.findByJobRoleId(jobRoleId);
    if (!registry) {
      throw new NotFoundException(`No Dashboard Registry configured for Job Role ID '${jobRoleId}'`);
    }
    return registry;
  }

  async create(dto: CreateDashboardRegistryDto) {
    return this.repository.create(dto);
  }

  async update(dashboardCode: string, dto: UpdateDashboardRegistryDto) {
    await this.getByCode(dashboardCode);
    return this.repository.update(dashboardCode, dto);
  }
}

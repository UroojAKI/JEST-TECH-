import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { OrganizationRepository } from '../repositories/organization.repository';
import { CreateDepartmentDto, UpdateDepartmentDto, CreateJobRoleDto, UpdateJobRoleDto } from '../dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getDepartments(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.DepartmentWhereInput = {};
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder || 'asc' } as any
      : { displayOrder: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          jobRoles: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getDepartmentById(id: string) {
    const dep = await this.repository.findDepartmentById(id);
    if (!dep) throw new NotFoundException(`Department with ID '${id}' not found`);
    return dep;
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const existing = await this.repository.findDepartmentByCode(dto.code);
    if (existing) throw new BadRequestException(`Department code '${dto.code}' already exists`);
    return this.repository.createDepartment(dto);
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.getDepartmentById(id);
    return this.repository.updateDepartment(id, dto);
  }

  async deleteDepartment(id: string) {
    await this.getDepartmentById(id);
    return this.repository.deleteDepartment(id);
  }

  async getJobRoles(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.JobRoleWhereInput = {};
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const orderBy = pagination.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder || 'asc' } as any
      : { displayOrder: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.jobRole.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          department: true,
          parentRole: true,
          dashboards: true,
        },
      }),
      this.prisma.jobRole.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getJobRoleById(id: string) {
    const role = await this.repository.findJobRoleById(id);
    if (!role) throw new NotFoundException(`Job Role with ID '${id}' not found`);
    return role;
  }

  async createJobRole(dto: CreateJobRoleDto) {
    const existing = await this.repository.findJobRoleByCode(dto.code);
    if (existing) throw new BadRequestException(`Job Role code '${dto.code}' already exists`);
    return this.repository.createJobRole(dto);
  }

  async updateJobRole(id: string, dto: UpdateJobRoleDto) {
    await this.getJobRoleById(id);
    return this.repository.updateJobRole(id, dto);
  }

  async deleteJobRole(id: string) {
    await this.getJobRoleById(id);
    return this.repository.deleteJobRole(id);
  }

  async getHierarchy() {
    return this.repository.getHierarchy();
  }
}

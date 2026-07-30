import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto, CreateJobRoleDto, UpdateJobRoleDto } from '../dto/organization.dto';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Departments
  async findAllDepartments() {
    return this.prisma.department.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        jobRoles: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async findDepartmentById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      include: { jobRoles: true, users: true },
    });
  }

  async findDepartmentByCode(code: string) {
    return this.prisma.department.findUnique({
      where: { code },
    });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        branchId: dto.branchId,
        displayOrder: dto.displayOrder || 0,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    return this.prisma.department.update({
      where: { id },
      data: dto,
    });
  }

  async deleteDepartment(id: string) {
    return this.prisma.department.delete({
      where: { id },
    });
  }

  // Job Roles
  async findAllJobRoles() {
    return this.prisma.jobRole.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        department: true,
        parentRole: true,
        dashboards: true,
      },
    });
  }

  async findJobRoleById(id: string) {
    return this.prisma.jobRole.findUnique({
      where: { id },
      include: {
        department: true,
        parentRole: true,
        subRoles: true,
        dashboards: true,
      },
    });
  }

  async findJobRoleByCode(code: string) {
    return this.prisma.jobRole.findUnique({
      where: { code },
      include: {
        department: true,
        dashboards: true,
      },
    });
  }

  async createJobRole(dto: CreateJobRoleDto) {
    return this.prisma.jobRole.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        departmentId: dto.departmentId,
        defaultRoleType: dto.defaultRoleType,
        parentRoleId: dto.parentRoleId,
        displayOrder: dto.displayOrder || 0,
        status: dto.status || 'ACTIVE',
      },
      include: { department: true },
    });
  }

  async updateJobRole(id: string, dto: UpdateJobRoleDto) {
    return this.prisma.jobRole.update({
      where: { id },
      data: dto,
      include: { department: true },
    });
  }

  async deleteJobRole(id: string) {
    return this.prisma.jobRole.delete({
      where: { id },
    });
  }

  async getHierarchy() {
    const departments = await this.prisma.department.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        jobRoles: {
          orderBy: { displayOrder: 'asc' },
          include: {
            parentRole: true,
            subRoles: true,
            users: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                designation: true,
                managerId: true,
              },
            },
          },
        },
      },
    });
    return departments;
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationRepository } from '../repositories/organization.repository';
import { CreateDepartmentDto, UpdateDepartmentDto, CreateJobRoleDto, UpdateJobRoleDto } from '../dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  async getDepartments() {
    return this.repository.findAllDepartments();
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

  async getJobRoles() {
    return this.repository.findAllJobRoles();
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

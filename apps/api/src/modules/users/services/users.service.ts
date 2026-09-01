import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuditAction, RoleType, UserStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../common/pagination/paginated-response.dto';
import { UserMapper } from '../mappers/user.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository, private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    let role = await this.userRepository.findRoleByType(dto.role);
    if (!role) {
      role = await this.prisma.role.findFirst({ where: { type: dto.role } });
      if (!role) throw new BadRequestException(`Unknown role ${dto.role}. Provisioning must use the canonical role registry.`);
    }
    const initialPassword = dto.password || `Jp$${crypto.randomBytes(12).toString('hex')}!`;
    const passwordHash = await argon2.hash(initialPassword);
    const empCode = dto.employeeCode || `EMP-${Date.now().toString().slice(-6)}`;
    const targetBranchId = dto.branchId || dto.branch;
    const targetDepartmentId = (dto as any).departmentId || dto.department;
    const branchConnect = targetBranchId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetBranchId) ? { connect: { id: targetBranchId } } : undefined;
    const departmentConnect = targetDepartmentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetDepartmentId) ? { connect: { id: targetDepartmentId } } : undefined;
    if (targetBranchId && !branchConnect) throw new BadRequestException('branchId must be a valid branch UUID');
    const user = await this.userRepository.create({
      email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone,
      employeeCode: empCode, designation: (dto as any).designation, role: { connect: { id: role.id } },
      status: (dto as any).status || UserStatus.ACTIVE, branch: branchConnect, department: departmentConnect,
    });
    const response: any = UserMapper.toResponse(user);
    response.initialPassword = initialPassword;
    return response;
  }

  async adminResetPassword(userId: string, newPassword?: string) {
    await this.findById(userId);
    const password = newPassword || `Jp$${crypto.randomBytes(12).toString('hex')}!`;
    const passwordHash = await argon2.hash(password);
    await this.userRepository.update(userId, { passwordHash });
    return { success: true, message: 'Password reset successfully', newPassword: password };
  }

  async changePassword(userId: string, currentPassword?: string, newPassword?: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!newPassword || newPassword.length < 6) throw new BadRequestException('New password must be at least 6 characters long');
    if (currentPassword && !(await argon2.verify(user.passwordHash, currentPassword))) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await argon2.hash(newPassword);
    await this.userRepository.update(userId, { passwordHash });
    return { success: true, message: 'Password changed successfully' };
  }

  async findAll(pagination: PaginationDto) {
    const page = pagination.page || 1; const limit = pagination.limit || 10; const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = pagination.search ? { OR: [
      { firstName: { contains: pagination.search, mode: 'insensitive' } }, { lastName: { contains: pagination.search, mode: 'insensitive' } }, { email: { contains: pagination.search, mode: 'insensitive' } },
    ] } : {};
    const orderBy = pagination.sortBy ? ({ [pagination.sortBy]: pagination.sortOrder || 'asc' } as any) : { createdAt: 'desc' };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy, include: { role: true, branch: true, team: true, department: true } }),
      this.prisma.user.count({ where }),
    ]);
    return new PaginatedResponseDto(UserMapper.toResponseList(users), total, page, limit);
  }

  async findById(id: string) { const user = await this.userRepository.findById(id); if (!user) throw new NotFoundException('User not found'); return UserMapper.toResponse(user); }
  async lockUser(id: string) { await this.findById(id); return UserMapper.toResponse(await this.userRepository.updateStatus(id, UserStatus.SUSPENDED)); }
  async unlockUser(id: string) { await this.findById(id); return UserMapper.toResponse(await this.userRepository.updateStatus(id, UserStatus.ACTIVE)); }

  async update(id: string, dto: any) {
    await this.findById(id);
    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.email) updateData.email = dto.email;
    if (dto.status) updateData.status = dto.status;
    if (dto.branchId) updateData.branch = { connect: { id: dto.branchId } };
    if (dto.teamId) updateData.team = { connect: { id: dto.teamId } };
    if (dto.role) {
      const role = await this.userRepository.findRoleByType(dto.role);
      if (!role) throw new BadRequestException(`Unknown role ${dto.role}. Use the canonical role registry.`);
      updateData.role = { connect: { id: role.id } };
    }
    return UserMapper.toResponse(await this.userRepository.update(id, updateData));
  }

  async delete(id: string) { await this.findById(id); return UserMapper.toResponse(await this.userRepository.softDelete(id)); }
}

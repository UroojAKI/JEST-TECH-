import { IsString, IsOptional, IsEnum, IsInt, IsBoolean } from 'class-validator';
import { RoleType } from '@prisma/client';

export class CreateDepartmentDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateJobRoleDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  departmentId: string;

  @IsEnum(RoleType)
  defaultRoleType: RoleType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentRoleId?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateJobRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(RoleType)
  defaultRoleType?: RoleType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentRoleId?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

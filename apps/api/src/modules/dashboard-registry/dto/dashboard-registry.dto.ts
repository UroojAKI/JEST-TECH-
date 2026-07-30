import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateDashboardRegistryDto {
  @IsString()
  jobRoleId: string;

  @IsString()
  dashboardCode: string;

  @IsString()
  workspaceCode: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsObject()
  layout: Record<string, any>;

  @IsObject()
  navigation: Record<string, any>;

  @IsObject()
  widgets: Record<string, any>;

  @IsObject()
  quickActions: Record<string, any>;

  @IsObject()
  permissions: Record<string, any>;
}

export class UpdateDashboardRegistryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  workspaceCode?: string;

  @IsOptional()
  @IsObject()
  layout?: Record<string, any>;

  @IsOptional()
  @IsObject()
  navigation?: Record<string, any>;

  @IsOptional()
  @IsObject()
  widgets?: Record<string, any>;

  @IsOptional()
  @IsObject()
  quickActions?: Record<string, any>;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, any>;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  ReportCategory,
  ReportModule,
  ReportType,
  ReportStatus,
  ReportFilterOperator,
  ReportScheduleFrequency,
} from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReportColumnDto {
  @ApiProperty({ example: 'contact.firstName' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ example: 'First Name' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'STRING' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  sortable?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  filterable?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  visible?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsInt()
  @IsOptional()
  order?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  configuration?: any;
}

export class CreateReportFilterDto {
  @ApiProperty({ example: 'status' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ enum: ReportFilterOperator })
  @IsEnum(ReportFilterOperator)
  operator: ReportFilterOperator;

  @ApiProperty({ required: false })
  @IsOptional()
  defaultValue?: any;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class CreateReportDto {
  @ApiProperty({ example: 'Active Lead Report' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ACTIVE_LEADS' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ required: false, example: 'Report of all active leads' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ReportCategory })
  @IsEnum(ReportCategory)
  category: ReportCategory;

  @ApiProperty({ enum: ReportModule })
  @IsEnum(ReportModule)
  module: ReportModule;

  @ApiProperty({
    enum: ReportType,
    required: false,
    default: ReportType.TABULAR,
  })
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @ApiProperty({
    enum: ReportStatus,
    required: false,
    default: ReportStatus.ACTIVE,
  })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  shared?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ type: [CreateReportColumnDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportColumnDto)
  columns: CreateReportColumnDto[];

  @ApiProperty({ type: [CreateReportFilterDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateReportFilterDto)
  filters?: CreateReportFilterDto[];
}

export class UpdateReportDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ReportCategory, required: false })
  @IsEnum(ReportCategory)
  @IsOptional()
  category?: ReportCategory;

  @ApiProperty({ enum: ReportModule, required: false })
  @IsEnum(ReportModule)
  @IsOptional()
  module?: ReportModule;

  @ApiProperty({ enum: ReportType, required: false })
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @ApiProperty({ enum: ReportStatus, required: false })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  shared?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ type: [CreateReportColumnDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateReportColumnDto)
  columns?: CreateReportColumnDto[];

  @ApiProperty({ type: [CreateReportFilterDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateReportFilterDto)
  filters?: CreateReportFilterDto[];
}

export class ExecuteReportDto {
  @ApiProperty({ required: false, example: { status: 'ACTIVE' } })
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiProperty({
    required: false,
    example: 'excel',
    enum: ['csv', 'excel', 'pdf'],
  })
  @IsString()
  @IsOptional()
  format?: 'csv' | 'excel' | 'pdf';

  @ApiProperty({ required: false, example: 'John' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, example: false })
  @IsBoolean()
  @IsOptional()
  stream?: boolean;
}

export class CreateScheduleDto {
  @ApiProperty({ example: '0 9 * * 1-5' })
  @IsString()
  @IsNotEmpty()
  cronExpression: string;

  @ApiProperty({ enum: ReportScheduleFrequency })
  @IsEnum(ReportScheduleFrequency)
  frequency: ReportScheduleFrequency;

  @ApiProperty({ required: false, default: 'UTC', example: 'Asia/Kolkata' })
  @IsString()
  @IsOptional()
  timezone?: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiProperty({ enum: ReportScheduleFrequency, required: false })
  @IsEnum(ReportScheduleFrequency)
  @IsOptional()
  frequency?: ReportScheduleFrequency;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

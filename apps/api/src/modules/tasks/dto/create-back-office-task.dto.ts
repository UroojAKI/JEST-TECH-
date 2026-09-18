import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskPriority } from '@prisma/client';

export class CreateBackOfficeTaskDto {
  @ApiProperty({ description: 'Task Type (e.g. POLICY_ISSUANCE, DOC_VERIFICATION, INSPECTION_REVIEW)' })
  @IsNotEmpty()
  @IsString()
  taskType: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({ description: 'Associated Lead ID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Associated Motor Quotation ID' })
  @IsOptional()
  @IsUUID()
  motorQuotationId?: string;

  @ApiPropertyOptional({ description: 'Assignee Back Office User ID' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Initial verification notes or instructions' })
  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @ApiPropertyOptional({ description: 'Missing items payload from CompletionService' })
  @IsOptional()
  missingItems?: any;

  @ApiPropertyOptional({ description: 'Checklist statuses' })
  @IsOptional()
  checklistStatus?: any;
}

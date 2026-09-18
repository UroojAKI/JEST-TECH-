import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskPriority, TaskType } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title / subject' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.FOLLOW_UP })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType = TaskType.FOLLOW_UP;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({ description: 'Due date (ISO string)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Assignee User ID' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Associated Customer ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Associated Lead ID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Associated Vehicle ID' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Associated Policy ID' })
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @ApiPropertyOptional({ description: 'Associated Claim ID' })
  @IsOptional()
  @IsUUID()
  claimId?: string;
}

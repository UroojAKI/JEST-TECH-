import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowModule } from '@prisma/client';

export class CreateWorkflowDefinitionDto {
  @ApiProperty({ example: 'Motor Policy Issuance Workflow' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MOTOR_POLICY_ISSUANCE' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: WorkflowModule, example: WorkflowModule.POLICIES })
  @IsEnum(WorkflowModule)
  module: WorkflowModule;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @IsOptional()
  version?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}

export class UpdateWorkflowDefinitionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ enum: WorkflowModule })
  @IsEnum(WorkflowModule)
  @IsOptional()
  module?: WorkflowModule;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  version?: number;
}

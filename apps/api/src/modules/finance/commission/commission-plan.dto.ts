import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CommissionPlanOverrideDto {
  @ApiProperty({ example: 'BRANCH_MANAGER' })
  @IsString()
  @IsNotEmpty()
  roleTier: string;

  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 2.5, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  percent: number;
}

export class UpsertCommissionPlanDto {
  @ApiProperty({ example: 'Motor Retail Commission Plan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Approved agreement reference and effective terms' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 10, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  agentPercent: number;

  @ApiProperty({ example: 15, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAgentPercent: number;

  @ApiProperty({ example: 20, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxTotalPercent: number;

  @ApiPropertyOptional({ type: [CommissionPlanOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionPlanOverrideDto)
  overrides?: CommissionPlanOverrideDto[];
}

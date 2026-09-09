import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class ReportClaimDto {
  @ApiPropertyOptional({ example: 'policy-id-uuid' })
  @IsOptional()
  @IsString()
  policyId?: string;

  @ApiPropertyOptional({ example: 'POL-001049' })
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiPropertyOptional({ example: 'Ramesh Patel' })
  @IsOptional()
  @IsString()
  claimantName?: string;

  @ApiPropertyOptional({ example: '2026-07-15T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  incidentDate?: string;

  @ApiProperty({ example: 'Accident on highway, minor damage to bumper.' })
  @IsString()
  @MinLength(5)
  description: string;

  @ApiPropertyOptional({ example: 25000.0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  claimAmount?: number;

  @ApiPropertyOptional({ example: 25000.0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimatedAmount?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class ReportClaimDto {
  @ApiProperty({ example: 'policy-id-uuid' })
  @IsNotEmpty()
  @IsString()
  policyId: string;

  @ApiProperty({ example: '2026-07-15T12:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  incidentDate: string;

  @ApiProperty({ example: 'Accident on highway, minor damage to bumper.' })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ example: 25000.0 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  claimAmount: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAgentDto {
  @ApiPropertyOptional({ description: 'Agency name' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  @ApiPropertyOptional({ description: 'IRDAI or brokerage license number' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Commission tier' })
  @IsOptional()
  @IsString()
  commissionTier?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAgentDto {
  @ApiPropertyOptional({
    description:
      'User ID to associate with the Agent profile (if Admin creating)',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Agency name' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  @ApiPropertyOptional({ description: 'IRDAI or brokerage license number' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Commission tier', default: 'STANDARD' })
  @IsOptional()
  @IsString()
  commissionTier?: string;
}

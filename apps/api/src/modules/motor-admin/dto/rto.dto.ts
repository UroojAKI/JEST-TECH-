import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRtoDto {
  @ApiProperty({ example: 'MH-02' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: 'Mumbai Suburban' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Andheri RTO' })
  @IsString()
  @IsNotEmpty()
  rtoOfficeName: string;

  @ApiPropertyOptional({ example: 'ZONE_A' })
  @IsString()
  @IsOptional()
  rtoZone?: string;
}

export class UpdateRtoDto {
  @ApiPropertyOptional({ example: 'MH-02' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'Mumbai Suburban' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ example: 'Andheri RTO' })
  @IsString()
  @IsOptional()
  rtoOfficeName?: string;

  @ApiPropertyOptional({ example: 'ZONE_A' })
  @IsString()
  @IsOptional()
  rtoZone?: string;
}

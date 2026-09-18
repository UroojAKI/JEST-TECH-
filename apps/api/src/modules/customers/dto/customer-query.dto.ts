import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

export class CustomerQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by VIP status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ description: 'Filter by phone / mobile' })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Filter by email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

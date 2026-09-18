import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MotorQuotationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

export class MotorQuotationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by Vehicle ID' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Filter by Lead ID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Filter by Customer ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: MotorQuotationStatus })
  @IsOptional()
  @IsEnum(MotorQuotationStatus)
  status?: MotorQuotationStatus;

  @ApiPropertyOptional({ description: 'Filter by Insurer Name' })
  @IsOptional()
  @IsString()
  insurerName?: string;
}

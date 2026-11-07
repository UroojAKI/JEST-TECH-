import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PosPartnerStatus, PosPartnerType, PosVerificationStatus } from '@prisma/client';

export class PosPartnerQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PosPartnerStatus)
  status?: PosPartnerStatus;

  @IsOptional()
  @IsEnum(PosVerificationStatus)
  verificationStatus?: PosVerificationStatus;

  @IsOptional()
  @IsEnum(PosPartnerType)
  partnerType?: PosPartnerType;

  @IsOptional()
  @IsString()
  insurerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

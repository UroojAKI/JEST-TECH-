import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PosPartnerStatus, PosVerificationStatus } from '@prisma/client';

export class UpdatePosStatusDto {
  @IsOptional()
  @IsEnum(PosPartnerStatus)
  status?: PosPartnerStatus;

  @IsOptional()
  @IsEnum(PosVerificationStatus)
  verificationStatus?: PosVerificationStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

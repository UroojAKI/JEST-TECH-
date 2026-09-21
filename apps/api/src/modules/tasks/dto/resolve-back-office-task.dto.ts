import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BackOfficeTaskStatus } from '@prisma/client';

export class ResolveBackOfficeTaskDto {
  @ApiProperty({ enum: BackOfficeTaskStatus })
  @IsNotEmpty()
  @IsEnum(BackOfficeTaskStatus)
  status: BackOfficeTaskStatus;

  @ApiPropertyOptional({ description: 'Verification notes or outcome remarks' })
  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @ApiPropertyOptional({
    description: 'Rejection reason if status is REJECTED',
  })
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}

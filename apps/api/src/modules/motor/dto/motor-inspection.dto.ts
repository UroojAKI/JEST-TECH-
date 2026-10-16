import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitInspectionForReviewDto {
  @ApiPropertyOptional({
    description: 'Optional inspector or submission remarks',
    example: 'All 7 mandatory photos captured and verified against RC',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApproveInspectionDto {
  @ApiPropertyOptional({
    description: 'S3/storage key for generated inspection report PDF',
    example: 'inspections/2026/report-123.pdf',
  })
  @IsOptional()
  @IsString()
  reportPdfKey?: string;

  @ApiPropertyOptional({
    description: 'Downloadable signed URL for inspection report PDF',
    example: 'https://s3.amazonaws.com/...',
  })
  @IsOptional()
  @IsString()
  reportPdfUrl?: string;
}

export enum InspectionRejectionCode {
  BLURRY_PHOTO = 'BLURRY_PHOTO',
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
  VEHICLE_MISMATCH = 'VEHICLE_MISMATCH',
  OTHER = 'OTHER',
}

export class RejectInspectionDto {
  @ApiPropertyOptional({
    enum: InspectionRejectionCode,
    description: 'Standardized rejection reason code',
    default: InspectionRejectionCode.OTHER,
  })
  @IsOptional()
  @IsEnum(InspectionRejectionCode)
  reasonCode?: InspectionRejectionCode;

  @ApiProperty({
    description: 'Detailed explanation for inspection rejection',
    example: 'Chassis number photograph is blurry and illegible',
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason text is required' })
  reasonText: string;

  @ApiPropertyOptional({
    description: 'Alternative alias for reasonText for backward compatibility',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class WaiveInspectionDto {
  @ApiProperty({
    description: 'Mandatory underwriting rationale for waiving inspection',
    example:
      'Policy break-in under 30 days and valid prior inspection certificate on file',
  })
  @IsString()
  @IsNotEmpty({ message: 'Waiver reason is required' })
  reason: string;
}

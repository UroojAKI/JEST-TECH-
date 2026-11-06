import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, SmokerStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Secondary Life Assured Underwriting Details
 * Used primarily for Category 1.7 (Annuity — Joint Life Option)
 */
export class SecondaryLifeAssuredDto {
  @ApiProperty({ description: 'Full legal name of the secondary life assured', example: 'Pooja Sharma' })
  @Transform(({ value, obj }) => value || obj?.fullName || '')
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Date of birth of the secondary life assured (ISO-8601)', example: '1988-06-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender, description: 'Gender of the secondary life assured', example: Gender.FEMALE })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ description: 'Relationship to Primary Life Assured', example: 'SPOUSE' })
  @Transform(({ value, obj }) => value || obj?.relationToPrimary || 'SPOUSE')
  @IsString()
  @IsNotEmpty()
  relationship: string;

  @ApiProperty({
    enum: SmokerStatus,
    description: 'Tobacco/smoking risk status',
    default: SmokerStatus.UNKNOWN,
  })
  @Transform(({ value }) => value || SmokerStatus.NON_SMOKER)
  @IsEnum(SmokerStatus)
  smokerStatus: SmokerStatus;

  @ApiPropertyOptional({ description: 'Height in cm', example: 165 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Weight in kg', example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Whether the secondary life assured has pre-existing conditions', default: false })
  @IsOptional()
  @IsBoolean()
  hasPreExistingIllness?: boolean;

  @ApiPropertyOptional({ description: 'Medical notes regarding pre-existing conditions' })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

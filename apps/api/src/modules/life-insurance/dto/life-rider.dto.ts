import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LifeRiderType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class LifeRiderInputDto {
  @ApiProperty({
    enum: LifeRiderType,
    description: 'Category/type of life rider add-on',
    example: LifeRiderType.ACCIDENTAL_DEATH_BENEFIT,
  })
  @IsEnum(LifeRiderType)
  riderType: LifeRiderType;

  @ApiProperty({
    description: 'Commercial rider name displayed on quotation',
    example: 'Comprehensive Accidental Death Benefit Rider',
  })
  @IsString()
  @IsNotEmpty()
  riderName: string;

  @ApiProperty({ description: 'Rider sum assured in INR', example: 5000000 })
  @IsNumber()
  @Min(10000)
  sumAssured: number;

  @ApiPropertyOptional({ description: 'Rider coverage term in years', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  termYears?: number;

  @ApiPropertyOptional({ description: 'Rider premium paying term in years', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pptYears?: number;

  @ApiProperty({ description: 'Rider base premium before tax and discount', example: 4500 })
  @IsNumber()
  @Min(0)
  basePremium: number;

  @ApiPropertyOptional({
    description: 'Statutory GST percentage for rider (defaults to 18.0)',
    example: 18.0,
    default: 18.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @ApiPropertyOptional({
    description: 'Brokerage commission percentage paid by insurer (internal broker revenue, not customer deduction)',
    example: 15.0,
    default: 0.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  brokeragePercent?: number;

  @ApiPropertyOptional({
    description: 'Customer discount applied to rider payable premium',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Optional computation snapshot or insurer tariff breakdown',
  })
  @IsOptional()
  calculationSnapshot?: Record<string, any>;
}


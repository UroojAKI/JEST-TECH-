import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SelectedAddonsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  zeroDepreciation?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  roadsideAssistance?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  engineProtection?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  ncbProtection?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  consumables?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  keyReplacement?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  returnToInvoice?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  tyreProtection?: boolean;
}

export class CalculateComparativeQuotesDto {
  @ApiPropertyOptional({ enum: ProductType })
  @IsEnum(ProductType)
  @IsOptional()
  coverType?: ProductType;

  @ApiPropertyOptional({ example: 1000000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  exShowroomPrice?: number;

  @ApiPropertyOptional({ example: 2022 })
  @IsInt()
  @IsOptional()
  registrationYear?: number;

  @ApiPropertyOptional({ example: 1197 })
  @IsInt()
  @Min(0)
  @IsOptional()
  engineCc?: number;

  @ApiPropertyOptional({ example: 750000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  manualOverrideIdv?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  ncbPercentage?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  hadClaimInPreviousYear?: boolean;

  @ApiPropertyOptional({ type: () => SelectedAddonsDto })
  @ValidateNested()
  @Type(() => SelectedAddonsDto)
  @IsOptional()
  selectedAddons?: SelectedAddonsDto;

  @ApiPropertyOptional({ example: 'ZONE_A' })
  @IsString()
  @IsOptional()
  rtoZone?: 'ZONE_A' | 'ZONE_B';

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includePaCover?: boolean;

  @ApiPropertyOptional({ example: 'PRIVATE_CAR' })
  @IsString()
  @IsOptional()
  vehicleType?: string;
}

export class EnterpriseCompareDto extends CalculateComparativeQuotesDto {
  @ApiPropertyOptional({ example: 'ALL' })
  @IsString()
  @IsOptional()
  carrierSelectionMode?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedCarrierIds?: string[];
}

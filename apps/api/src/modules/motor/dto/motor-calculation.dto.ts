import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleCategory } from '@prisma/client';

export class MotorAddonInputDto {
  @IsString()
  addonCode: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualPrice?: number;
}

export class MotorCalculationInputDto {
  @IsEnum(VehicleCategory)
  vehicleCategory: VehicleCategory;

  @IsOptional()
  @IsString()
  vehicleSubType?: string;

  @IsString()
  vehicleStatus: 'NEW' | 'EXISTING';

  @IsString()
  policyType: 'THIRD_PARTY_ONLY' | 'STANDALONE_OD' | 'PACKAGE_COMPREHENSIVE';

  @IsOptional()
  @IsNumber()
  policyTenure?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  idv?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  ncbPercent?: number;

  @IsOptional()
  @IsBoolean()
  claimInExpiringPolicy?: boolean;

  @IsOptional()
  @IsBoolean()
  paCover?: boolean;

  @IsOptional()
  @IsBoolean()
  paidDriverLiability?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MotorAddonInputDto)
  addons?: MotorAddonInputDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  activeTpPolicyNumber?: string;
  
  @IsOptional()
  @IsString()
  activeTpExpiryDate?: string;
}

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
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

  /** Engine cubic capacity in cc — used for TP tariff band lookup. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  engineCc?: number;

  /** Seating capacity (for PCV tariff band lookup). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  seatingCapacity?: number;

  /** Gross vehicle weight in kg (for GCV tariff band lookup). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  gvwKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  ncbPercent?: number;

  @IsOptional()
  @IsBoolean()
  claimInExpiringPolicy?: boolean;

  /** Compulsory PA for Owner-Driver cover (₹15L). Defaults to true. Set false only with valid waiver. */
  @IsOptional()
  @IsBoolean()
  paCover?: boolean;

  /** Legal Liability to Paid Driver (LL). */
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

  /** Required when discountPercent exceeds the configured standard authority limit. */
  @IsOptional()
  @IsString()
  approvalReference?: string;
}


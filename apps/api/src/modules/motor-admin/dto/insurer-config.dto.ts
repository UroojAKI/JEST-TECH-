import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType, ProductType } from '@prisma/client';

export class CreateInsurerDto {
  @ApiProperty({ example: 'HDFC ERGO General Insurance' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'HDFC_ERGO' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  irdaiRegistrationNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ enum: VehicleType, isArray: true })
  @IsArray()
  @IsOptional()
  supportedVehicleTypes?: VehicleType[];

  @ApiPropertyOptional({ enum: ProductType, isArray: true })
  @IsArray()
  @IsOptional()
  supportedPolicyTypes?: ProductType[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsZeroDep?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsRTI?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsEngineProtect?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsRSA?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsNCBProtection?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsConsumables?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsKeyProtect?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  supportsTyreProtect?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateInsurerDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  irdaiRegistrationNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateInsuranceProductDto {
  @ApiProperty({ example: 'ins-123' })
  @IsString()
  @IsNotEmpty()
  insurerId: string;

  @ApiProperty({ example: 'Comprehensive Motor Private Car' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ example: 'COMP_PVT_CAR' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'FOUR_WHEELER' })
  @IsString()
  @IsOptional()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'PACKAGE_COMPREHENSIVE' })
  @IsString()
  @IsOptional()
  policyType?: string;
}

export class CreateDiscountRuleDto {
  @ApiProperty({ example: 'ins-123' })
  @IsString()
  @IsNotEmpty()
  insurerId: string;

  @ApiPropertyOptional({ example: 'FOUR_WHEELER' })
  @IsString()
  @IsOptional()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'PACKAGE_COMPREHENSIVE' })
  @IsString()
  @IsOptional()
  policyType?: string;

  @ApiProperty({ example: 65 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPercent: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minDiscountPercent?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  managerApprovalThresholdPercent?: number;
}

export class CreateCommissionMatrixDto {
  @ApiProperty({ example: 'ins-123' })
  @IsString()
  @IsNotEmpty()
  insurerId: string;

  @ApiPropertyOptional({ example: 'MOTOR' })
  @IsString()
  @IsOptional()
  productType?: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  @Max(100)
  odCommissionPercent: number;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  tpCommissionPercent: number;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @IsOptional()
  brokeragePercent?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  tdsPercent?: number;
}

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsDateString,
  IsObject,
} from 'class-validator';
import { VehicleCategory } from '@prisma/client';

export enum CommissionConfigStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

export enum ConfigurationMissingEntity {
  TP_TARIFF = 'TP_TARIFF',
  OD_RATE = 'OD_RATE',
  TAX_RULE = 'TAX_RULE',
  COMMISSION_CONFIG = 'COMMISSION_CONFIG',
}

/**
 * Insurer Commission Configuration Contract (D-02, PR-02)
 * Defines the rate card per insurer × vehicle category × product type.
 */
export class InsurerCommissionConfigDto {
  @IsString()
  insurerId: string;

  @IsEnum(VehicleCategory)
  vehicleCategory: VehicleCategory;

  @IsString()
  productType: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  odRatePercent: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  tpRatePercent: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  netRatePercent: number;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsEnum(CommissionConfigStatus)
  status: CommissionConfigStatus;
}

/**
 * Breakdown of commission earnings.
 * Commissions are strictly calculated on net pre-tax base, NEVER on GST and NEVER confused with discounts.
 */
export class CommissionBreakdownDto {
  @IsNumber()
  @Min(0)
  odCommissionAmount: number;

  @IsNumber()
  @Min(0)
  tpCommissionAmount: number;

  @IsNumber()
  @Min(0)
  totalCommissionAmount: number;

  @IsNumber()
  @Min(0)
  commissionableOdBase: number;

  @IsNumber()
  @Min(0)
  commissionableTpBase: number;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  planId?: string;
}

/**
 * Customer Discount Contract (D-02, PR-02)
 * Discounts reduce the customer's payable gross base prior to tax calculation.
 */
export class CustomerDiscountBreakdownDto {
  @IsNumber()
  @Min(0)
  odDiscountAmount: number;

  @IsNumber()
  @Min(0)
  tpDiscountAmount: number;

  @IsNumber()
  @Min(0)
  ncbDiscountAmount: number;

  @IsNumber()
  @Min(0)
  totalDiscountAmount: number;
}

/**
 * Typed Fail-Closed Configuration Error Response (D-04, PR-02, T-06)
 * Thrown when an approved tariff or rate is missing. Replaces silent fallbacks.
 */
export class ConfigurationErrorResponseDto {
  @IsString()
  errorCode: 'CONFIGURATION_ERROR';

  @IsString()
  message: string;

  @IsEnum(ConfigurationMissingEntity)
  missingEntity: ConfigurationMissingEntity;

  @IsString()
  vehicleCategory: string;

  @IsString()
  policyType: string;

  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

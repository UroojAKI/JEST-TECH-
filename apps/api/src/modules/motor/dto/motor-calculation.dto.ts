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

export class MotorPricingOverrideItemDto {
  @IsString()
  field: string;

  @IsNumber()
  overrideValue: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  approvalReference?: string;

  @IsOptional()
  @IsString()
  approvedById?: string;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}

export class MotorAddonInputDto {
  @IsString()
  addonCode: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  editedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  gstRate?: number;

  @IsOptional()
  @IsString()
  approvalReference?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;
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

  /** Own Damage discount percentage applied to base OD premium. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  odDiscountPercent?: number;

  /** Commercial payable discount percentage applied on Payable Base (Gross Premium + Component GST). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commercialDiscountPercent?: number;

  /**
   * Commercial adjustment in fixed ₹ (Phase 3 canonical path).
   * When provided, replaces percentage-based commercial discount calculation.
   * Applied to the payable base after GST; the full rupee amount is deducted exactly once.
   * Rejected if it would make finalPayable < 0.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  commercialAdjustment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commercialAdjustmentAmount?: number;

  /**
   * Commercial adjustment direction: 'ADD' increases payable; 'SUBTRACT' decreases payable.
   * Defaults to 'SUBTRACT' if omitted.
   */
  @IsOptional()
  @IsString()
  commercialAdjustmentDirection?: 'ADD' | 'SUBTRACT';

  @IsOptional()
  @IsString()
  commercialAdjustmentType?: 'ADD' | 'SUBTRACT';

  @IsOptional()
  @IsString()
  discountReason?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tpDiscountPercent?: number;

  @IsOptional()
  @IsString()
  activeTpPolicyNumber?: string;

  @IsOptional()
  @IsString()
  activeTpExpiryDate?: string;

  /** Evidence that the active TP policy details were reviewed by the quoting user. */
  @IsOptional()
  @IsString()
  activeTpInsurer?: string;

  @IsOptional()
  @IsString()
  activeTpStartDate?: string;

  @IsOptional()
  @IsString()
  activeTpVerificationMethod?: string;

  @IsOptional()
  @IsString()
  activeTpVerificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsBoolean()
  activeTpVerifiedByUserConfirmed?: boolean;

  /** Required when discountPercent exceeds the configured standard authority limit. */
  @IsOptional()
  @IsString()
  approvalReference?: string;

  @IsOptional()
  @IsString()
  previousPolicyExpiryDate?: string;

  @IsOptional()
  @IsString()
  policyStartDate?: string;

  /** GST Rate selector: supports exactly 5% or 18% per IRDAI/GST matrix specifications. */
  @IsOptional()
  @IsNumber()
  gstRate?: number;

  /** Agent edited OD rate % (subject to rate bounds / approval) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  /** Agent edited OD rate % (deprecated legacy path) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  editedOdRate?: number;

  /**
   * Direct OD premium in ₹ (Phase 1 & 3 canonical path).
   * When provided, bypasses IDV × rate multiplication entirely.
   * The entered value IS the gross OD premium. Supersedes editedOdRate.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  odPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odPremiumAmount?: number;

  /** Canonical alias for Direct OD Base Premium ₹ */
  @IsOptional()
  @IsNumber()
  @Min(0)
  odBasePremium?: number;

  /** NCB Discount in ₹ (manual override) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  ncbDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ncbDiscountAmount?: number;

  /** Add-ons Premium Total in ₹ (manual override) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  addonPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  addOnsPremium?: number;

  /** Net OD Premium / Field 10 in ₹ (manual override) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  netOdPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odPremiumNet?: number;

  /** Statutory GST in ₹ (manual override) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odGstAmount?: number;

  /** Total Premium incl. GST / Field 11 in ₹ (explicit manual override) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPremiumOverride?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPremium?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPremiumInclGST?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPayableAmount?: number;

  /** Applicable TP policy tenure */
  @IsOptional()
  @IsNumber()
  tenure?: number;

  /** Annual TP premium in ₹ (canonical naming) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualTpPremium?: number;

  /** Agent edited TP premium ₹ (subject to tariff bounds / approval) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  editedTpPremium?: number;

  /** Agent edited Annual TP premium ₹ (canonical naming) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  editedTpAnnualPremium?: number;

  /** Agent edited PA premium ₹ */
  @IsOptional()
  @IsNumber()
  @Min(0)
  editedPaPremium?: number;

  /** Agent edited Paid Driver premium ₹ */
  @IsOptional()
  @IsNumber()
  @Min(0)
  editedPaidDriverPremium?: number;

  /** Component-level OD GST rate */
  @IsOptional()
  @IsNumber()
  odGstRate?: number;

  /** Component-level TP GST rate */
  @IsOptional()
  @IsNumber()
  tpGstRate?: number;

  /** Component-level PA GST rate */
  @IsOptional()
  @IsNumber()
  paGstRate?: number;

  /** Component-level Paid Driver GST rate */
  @IsOptional()
  @IsNumber()
  paidDriverGstRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MotorPricingOverrideItemDto)
  overrides?: MotorPricingOverrideItemDto[];
}

export interface PayableDiscount {
  percentage: number;
  baseAmount: number;
  amount: number;
  reason?: string;
  fixedRupeeAmount?: number;
}

export interface ItemizedDiscounts {
  od: {
    percent: number;
    base: number;
    amount: number;
  };
  tp: {
    percent: number;
    base: number;
    amount: number;
  };
  commercial: {
    /** Percentage (legacy / backwards-compat) */
    percent: number;
    base: number;
    amount: number;
    /** Fixed ₹ amount (canonical Phase 3 path) */
    fixedRupeeAmount?: number;
  };
  total: number;
}

export interface PayableSummary {
  odGrossPremium?: number;
  odPremium?: number;
  tpGrossPremium?: number;
  annualTpPremium?: number;
  tenure?: number;
  paGrossPremium?: number;
  paCoverPremium?: number;
  paidDriverGrossPremium?: number;
  addonGrossPremium?: number;
  grossPremium?: number;
  premiumBeforeDiscount: number;
  componentGstTotal: number;
  gstTotal?: number;
  payableBase: number;
  odDiscountAmount?: number;
  odDiscount?: number;
  tpDiscountAmount?: number;
  tpDiscount?: number;
  commercialDiscountAmount?: number;
  commercialAdjustment?: number;
  /** Fixed ₹ commercial adjustment (Phase 3 canonical path). Mirrors commercialDiscountAmount when set. */
  commercialAdjustmentAmount?: number;
  commercialAdjustmentDirection?: 'ADD' | 'SUBTRACT';
  addonDiscountAmount?: number;
  addonDiscount?: number;
  addonGstTotal?: number;
  addonGst?: number;
  commercialDiscount: PayableDiscount;
  totalDiscount?: number;
  totalDiscounts?: number;
  finalPayableAmount: number;
  finalPayable?: number;
  gstBreakdown: any;
}

export interface UnderwritingMetadata {
  ncbPercentage: number;
  ncbEligible: boolean;
  claimReported: boolean;
}



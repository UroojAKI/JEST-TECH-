import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IMTEndorsement } from '../../motor-admin/enums/imt-endorsement.enum';

export class CreateQuotationAddonDto {
  @IsString()
  @IsNotEmpty()
  addonCode: string;

  @IsString()
  @IsNotEmpty()
  addonName: string;

  @IsNumber()
  @Min(0)
  premium: number;
}

export class CreateQuotationDiscountDto {
  @IsString()
  @IsNotEmpty()
  discountType: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateQuotationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  @IsNotEmpty()
  insurerName: string;

  @IsString()
  @IsNotEmpty()
  productType: string;

  @IsNumber()
  @Min(0)
  sumInsured: number;

  @IsOptional()
  @IsInt()
  @IsIn([0, 20, 25, 35, 45, 50])
  ncbPercentage?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationAddonDto)
  addons?: CreateQuotationAddonDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationDiscountDto)
  discounts?: CreateQuotationDiscountDto[];

  @IsDateString()
  expiryDate: string;

  // Vehicle Reference & Details
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  vehicleCategory?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  idv?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  policyTenure?: number;

  // Vehicle RC Book mandatory fields
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @IsOptional()
  @IsString()
  engineNumber?: string;

  // SAOD Eligibility Verification Fields
  @IsOptional()
  @IsString()
  activeTpInsurer?: string;

  @IsOptional()
  @IsString()
  activeTpPolicyNumber?: string;

  @IsOptional()
  @IsDateString()
  activeTpExpiryDate?: string;

  // Hypothecation (loan on vehicle)
  @IsOptional()
  @IsBoolean()
  isHypothecated?: boolean;

  @IsOptional()
  @IsString()
  hypothecationFinancier?: string;

  @IsOptional()
  @IsString()
  hypothecationBranch?: string;

  // KYC
  @IsOptional()
  @IsEnum(['PAN', 'AADHAAR', 'CKYC', 'FORM60'])
  kycType?: string;

  @IsOptional()
  @IsString()
  kycNumber?: string;

  // Co-passenger PA
  @IsOptional()
  @IsBoolean()
  coPassengerPACover?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  coPassengerCount?: number;

  // IMT Endorsements
  @IsOptional()
  @IsArray()
  @IsEnum(IMTEndorsement, { each: true })
  imtEndorsements?: IMTEndorsement[];

  // CPA Cover
  @IsOptional()
  @IsBoolean()
  cpaWaiver?: boolean;
}

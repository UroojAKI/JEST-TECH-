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
  ValidateIf,
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

  @ValidateIf((dto) => dto.amount === undefined)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ValidateIf((dto) => dto.percentage === undefined)
  @IsNumber()
  @Min(0)
  amount?: number;
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

  @IsString()
  @IsNotEmpty()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  vehicleCategory?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  idv?: number;

  @IsInt()
  @Min(1)
  policyTenure: number;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @IsOptional()
  @IsString()
  engineNumber?: string;

  @IsOptional()
  @IsString()
  activeTpInsurer?: string;

  @IsOptional()
  @IsString()
  activeTpPolicyNumber?: string;

  @IsOptional()
  @IsDateString()
  activeTpExpiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isHypothecated?: boolean;

  @IsOptional()
  @IsString()
  hypothecationFinancier?: string;

  @IsOptional()
  @IsString()
  hypothecationBranch?: string;

  @IsOptional()
  @IsEnum(['PAN', 'AADHAAR', 'CKYC', 'FORM60'])
  kycType?: string;

  @IsOptional()
  @IsString()
  kycNumber?: string;

  @IsOptional()
  @IsBoolean()
  coPassengerPACover?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  coPassengerCount?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(IMTEndorsement, { each: true })
  imtEndorsements?: IMTEndorsement[];

  @IsOptional()
  @IsBoolean()
  cpaWaiver?: boolean;
}

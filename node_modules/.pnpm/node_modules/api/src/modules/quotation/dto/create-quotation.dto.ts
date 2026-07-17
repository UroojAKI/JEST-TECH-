import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @Min(0)
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
}

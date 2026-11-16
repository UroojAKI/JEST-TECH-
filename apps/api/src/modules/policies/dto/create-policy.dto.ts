import { PolicyAddressDto } from './policy-address.dto';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePolicyMemberDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  relation: string;

  @IsDateString()
  dateOfBirth: string;
}

export class CreatePolicyNomineeDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  relation: string;

  @IsNumber()
  @Min(0)
  percentage: number;
}

export class CreatePolicyPaymentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreatePolicyDto {
  @IsOptional()
  @IsString()
  quotationId?: string;

  @IsOptional()
  @IsString()
  policyType?: string;

  @IsOptional()
  @IsString()
  proposalId?: string;

  @IsOptional()
  @IsString()
  issueSource?: string;

  @IsOptional()
  @IsString()
  insurerPolicyNumber?: string;

  @IsOptional()
  @IsString()
  insurerQuoteId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  productLine?: string;

  @IsOptional()
  @IsNumber()
  totalPremium?: number;

  @IsOptional()
  @IsNumber()
  idvValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyMemberDto)
  members?: CreatePolicyMemberDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyNomineeDto)
  nominees?: CreatePolicyNomineeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePolicyPaymentDto)
  payment?: CreatePolicyPaymentDto;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  customerPan?: string;

  @IsOptional()
  @IsString()
  customerAadhaar?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsString()
  customerPincode?: string;

  @IsOptional()
  @IsString()
  posPartnerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyAddressDto)
  address?: PolicyAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyAddressDto)
  structuredAddress?: PolicyAddressDto;

  @IsOptional()
  @IsString()
  actualPolicyNumber?: string;

  @IsOptional()
  @IsNumber()
  actualPremium?: number;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsBoolean()
  confirmPaymentReceived?: boolean;

  @IsOptional()
  @IsString()
  documentFileKey?: string;

  @IsOptional()
  @IsString()
  documentFileName?: string;

  @IsOptional()
  @IsNumber()
  documentFileSize?: number;
}

import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PosPartnerType } from '@prisma/client';
import { PolicyAddressDto } from '../../policies/dto/policy-address.dto';

export class PosInitialAgreementDto {
  @IsOptional()
  @IsString()
  insurerId?: string;

  @IsString()
  @IsNotEmpty({ message: 'productType is mandatory (e.g. MOTOR, HEALTH)' })
  productType: string;

  @IsOptional()
  @IsString()
  insuranceProductId?: string;

  @IsString()
  @IsIn(['PERCENTAGE', 'FIXED'], { message: 'commissionType must be PERCENTAGE or FIXED' })
  commissionType: 'PERCENTAGE' | 'FIXED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveUntil?: string;
}

export class CreatePosPartnerDto {
  @IsOptional()
  @IsString()
  posCode?: string;

  @IsEnum(PosPartnerType, {
    message: 'partnerType must be either INDIVIDUAL or CORPORATE',
  })
  partnerType: PosPartnerType;

  @IsString()
  @IsNotEmpty({ message: 'POS Partner Name is mandatory' })
  @Length(2, 150)
  name: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Mobile number is mandatory' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Invalid PAN format. Must match standard 10-character PAN format (e.g. ABCDE1234F)',
  })
  panNumber?: string;

  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  authorizedPersonName?: string;

  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @IsOptional()
  @IsString()
  contactPersonPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyAddressDto)
  address?: PolicyAddressDto;

  // Optional insurer-specific Agent POS mapping; one partner may map to multiple insurers.
  @IsOptional()
  @IsString()
  insurerId?: string;

  @IsOptional()
  @IsString()
  insurerPartnerCode?: string;

  @IsOptional()
  @IsString()
  insurerPospId?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveUntil?: string;

  // ── Initial Commercial Agreement (DEC-05) ──
  @IsOptional()
  @ValidateNested()
  @Type(() => PosInitialAgreementDto)
  initialAgreement?: PosInitialAgreementDto;
}

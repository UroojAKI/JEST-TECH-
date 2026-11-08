import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PosPartnerType } from '@prisma/client';
import { PolicyAddressDto } from '../../policies/dto/policy-address.dto';

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
  authorizedPersonName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PolicyAddressDto)
  address?: PolicyAddressDto;

  // ── Mandatory Single Insurer Mapping (DEC-03) ──
  @IsString()
  @IsNotEmpty({ message: 'Mapping to an existing Insurer is mandatory for POS Partner registration' })
  insurerId: string;

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
}

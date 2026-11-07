import {
  IsOptional,
  IsString,
  Matches,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyAddressDto } from '../../policies/dto/policy-address.dto';

export class UpdatePosPartnerDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number',
  })
  mobile?: string;

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

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveUntil?: string;
}

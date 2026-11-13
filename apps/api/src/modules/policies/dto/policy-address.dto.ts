import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class PolicyAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Address Line 1 is mandatory for policy issuance' })
  @Length(3, 200, { message: 'Address Line 1 must be between 3 and 200 characters' })
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsString()
  @IsNotEmpty({ message: 'City is mandatory for policy issuance' })
  @Length(2, 100, { message: 'City must be between 2 and 100 characters' })
  city: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsString()
  @IsNotEmpty({ message: 'State is mandatory for policy issuance' })
  @Length(2, 100, { message: 'State must be between 2 and 100 characters' })
  state: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'PIN code is mandatory for policy issuance' })
  @Matches(/^[1-9][0-9]{5}$/, {
    message: 'PIN code must be a valid 6-digit Indian postal code',
  })
  pincode: string;

  @IsOptional()
  @IsString()
  country?: string;
}

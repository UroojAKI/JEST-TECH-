import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: '10-digit primary mobile number' })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile must be a valid 10-digit Indian number starting with 6-9',
  })
  mobile?: string;

  @ApiPropertyOptional({ description: 'Customer email' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address format' })
  email?: string;

  @ApiPropertyOptional({ description: 'PAN card number' })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional({ description: '12-digit Aadhaar number' })
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @ApiPropertyOptional({ description: 'Street address line 1' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Street address line 2' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'PIN code' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ description: 'VIP client status' })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;
}

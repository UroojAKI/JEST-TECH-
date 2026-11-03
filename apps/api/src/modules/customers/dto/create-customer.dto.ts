import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer first name' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: '10-digit primary mobile number' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Mobile must be a valid 10-digit Indian number starting with 6-9',
  })
  mobile: string;

  @ApiPropertyOptional({ description: 'Customer email' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
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

  @ApiProperty({ description: 'Street address line 1' })
  @IsNotEmpty({ message: 'Customer address is mandatory' })
  @IsString()
  addressLine1: string;

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

  @ApiProperty({ description: '6-digit Indian PIN code' })
  @IsNotEmpty({ message: 'Customer PIN code is mandatory' })
  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, {
    message: 'PIN code must be a valid 6-digit Indian postal code',
  })
  pincode: string;

  @ApiPropertyOptional({ description: 'VIP client status' })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ description: 'Legacy Contact ID if migrating' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Assigned Agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Namespaced external Agent code' })
  @IsOptional()
  @IsString()
  externalAgentCode?: string;

  @ApiPropertyOptional({ description: 'Required with externalAgentCode, for example CLIENT_A' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  agentCodeSystem?: string;

  @ApiPropertyOptional({
    description: 'Acknowledge soft duplicate warning and proceed',
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDuplicate?: boolean;
}

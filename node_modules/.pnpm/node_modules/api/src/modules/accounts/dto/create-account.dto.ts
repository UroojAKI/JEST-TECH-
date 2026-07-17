import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsEmail,
  Length,
  Min,
  IsDateString,
} from 'class-validator';
import { AccountType, CommunicationChannel, KycStatus } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(15, 15, { message: 'GST Number must be exactly 15 characters' })
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @Length(10, 10, { message: 'PAN Number must be exactly 10 characters' })
  panNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  employeeCount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CommunicationChannel)
  preferredCommunication?: CommunicationChannel;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @IsOptional()
  @IsDateString()
  kycCompletedAt?: string;
}

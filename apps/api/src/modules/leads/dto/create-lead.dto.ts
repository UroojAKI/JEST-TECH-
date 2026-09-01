import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @ValidateIf((dto) => !dto.contactId)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ValidateIf((dto) => !dto.contactId)
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @ValidateIf((dto) => !dto.contactId)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/)
  phone?: string;

  @IsOptional()
  @IsString()
  productInterest?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  expectedPremium?: number;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

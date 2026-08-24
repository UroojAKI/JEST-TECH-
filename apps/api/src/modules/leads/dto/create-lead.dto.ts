import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';

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

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
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

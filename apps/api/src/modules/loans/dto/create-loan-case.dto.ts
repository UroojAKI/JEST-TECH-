import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LoanCategory } from '@prisma/client';
import { CreateLoanPartyDto } from './loan-party.dto';
import { CreateLoanFacilityDto } from './loan-facility.dto';

export class ApplicantProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  aadhaarNumber?: string;
}

export class CreateLoanCaseDto {
  @IsEnum(LoanCategory)
  category: LoanCategory;

  @IsUUID()
  @IsOptional()
  contactId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicantProfileDto)
  applicant?: ApplicantProfileDto;

  @IsUUID()
  @IsOptional()
  leadId?: string;

  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  leadSource?: string;

  // Primary Applicant Profile (PDF Common Fields)
  @IsString()
  @IsOptional()
  occupationType?: string;

  @IsString()
  @IsOptional()
  employerBusinessName?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  monthlyIncome?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  annualIncome?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  existingEmiObligations?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseInt(value.replace(/,/g, '').trim(), 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  cibilScore?: number;

  @IsOptional()
  bankAccountDetails?: Record<string, any>;

  @IsOptional()
  residentialAddress?: Record<string, any>;

  @IsOptional()
  permanentAddress?: Record<string, any>;

  // Category-Specific Details (Home Loan, LAP, etc.)
  @IsOptional()
  categoryData?: Record<string, any>;

  // Optional nested facility on creation
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateLoanFacilityDto)
  facility?: CreateLoanFacilityDto;

  // Optional co-applicants / guarantors
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLoanPartyDto)
  parties?: CreateLoanPartyDto[];
}

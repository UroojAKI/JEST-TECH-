import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LoanCategory, LoanEnquiryStatus } from '@prisma/client';

export class UpdateLoanCaseDto {
  @IsEnum(LoanCategory)
  @IsOptional()
  category?: LoanCategory;

  @IsEnum(LoanEnquiryStatus)
  @IsOptional()
  status?: LoanEnquiryStatus;

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

  @IsOptional()
  categoryData?: Record<string, any>;

  @IsOptional()
  disbursementDetails?: Record<string, any>;
}

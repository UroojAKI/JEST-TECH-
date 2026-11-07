import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LoanEnquiryStatus } from '@prisma/client';

export class IssueLoanSanctionDto {
  @IsString()
  @IsOptional()
  sanctionLetterDocId?: string;

  @IsString()
  @IsOptional()
  sanctionDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  sanctionedAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class IssueLoanDisbursementDto {
  @IsString()
  @IsOptional()
  loanAccountNumber?: string;

  @IsString()
  @IsOptional()
  disbursementDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  disbursedAmount?: number;

  @IsString()
  @IsOptional()
  utrNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateLoanStatusDto {
  @IsEnum(LoanEnquiryStatus)
  status: LoanEnquiryStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}


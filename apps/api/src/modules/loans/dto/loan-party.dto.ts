import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LoanPartyRole } from '@prisma/client';

export class CreateLoanPartyDto {
  @IsEnum(LoanPartyRole)
  role: LoanPartyRole;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  relationship?: string;

  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  aadhaarNumber?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

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
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseInt(value.replace(/,/g, '').trim(), 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  cibilScore?: number;

  @IsOptional()
  address?: Record<string, any>;
}

export class UpdateLoanPartyDto extends CreateLoanPartyDto {}

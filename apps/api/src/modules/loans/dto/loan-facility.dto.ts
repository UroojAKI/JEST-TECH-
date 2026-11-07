import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  LoanFacilityType,
  LoanInterestRateType,
  LoanDisbursementMode,
} from '@prisma/client';

export class CreateLoanFacilityDto {
  @Transform(({ value }) => {
    if (value === 'OVERDRAFT' || value === 'DROP_LINE_OD') {
      return LoanFacilityType.OVERDRAFT_CASH_CREDIT;
    }
    return value;
  })
  @IsEnum(LoanFacilityType)
  facilityType: LoanFacilityType;

  @IsNumber()
  @Min(1000)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  requestedAmount: number;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseInt(value.replace(/,/g, '').trim(), 10);
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  tenureMonths: number;

  @IsEnum(LoanInterestRateType)
  @IsOptional()
  interestRateType?: LoanInterestRateType;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  targetRoiPercentage?: number;

  @IsEnum(LoanDisbursementMode)
  @IsOptional()
  disbursementMode?: LoanDisbursementMode;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  marginPercentage?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  ltvRatioPercentage?: number;

  // Balance Transfer Specifics
  @IsString()
  @IsOptional()
  existingLenderName?: string;

  @IsString()
  @IsOptional()
  existingLoanAccountNo?: string;

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
  outstandingAmount?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? undefined : parsed;
    }
    return value;
  })
  existingRoiPercentage?: number;

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
  topUpAmountRequested?: number;

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
  foreclosureCharges?: number;
}

export class UpdateLoanFacilityDto extends CreateLoanFacilityDto {}

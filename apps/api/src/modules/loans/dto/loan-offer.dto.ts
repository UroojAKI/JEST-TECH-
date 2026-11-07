import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LoanInterestRateType } from '@prisma/client';

export class CreateLoanOfferDto {
  @IsString()
  @IsNotEmpty()
  lenderName: string;

  @IsNumber()
  @Min(1000)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  offeredAmount: number;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseInt(value.replace(/,/g, '').trim(), 10);
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  offeredTenureMonths: number;

  @IsEnum(LoanInterestRateType)
  @IsOptional()
  interestRateType?: LoanInterestRateType;

  @IsNumber()
  @Min(0.01)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  rateOfInterest: number;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '').trim());
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  processingFee: number;

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
  otherCharges?: number;

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
  commissionRatePercentage?: number;

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
  customerDiscountAmount?: number;

  @IsOptional()
  sanctionDate?: string;

  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class SelectLoanOfferDto {
  @IsString()
  @IsNotEmpty()
  offerId: string;
}

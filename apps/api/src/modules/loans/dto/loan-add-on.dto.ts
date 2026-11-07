import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class ConfigureLoanAddOnDto {
  @IsBoolean()
  @IsOptional()
  creditLifeOpted?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLifeSumAssured?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLifePremium?: number;

  @IsBoolean()
  @IsOptional()
  assetInsuranceOpted?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  assetSumAssured?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  assetPremium?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  brokerageAmount?: number;
}


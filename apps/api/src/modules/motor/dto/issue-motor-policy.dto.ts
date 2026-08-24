import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IssueMotorPolicyDto {
  @IsString()
  actualPolicyNumber!: string;

  @IsNumber()
  @Min(0)
  actualPremium!: number;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsString()
  odStartDate?: string;

  @IsOptional()
  @IsString()
  odExpiryDate?: string;

  @IsOptional()
  @IsString()
  tpStartDate?: string;

  @IsOptional()
  @IsString()
  tpExpiryDate?: string;

  @IsOptional()
  @IsString()
  documentFileKey?: string;

  @IsOptional()
  @IsString()
  documentFileName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  documentFileSize?: number;
}

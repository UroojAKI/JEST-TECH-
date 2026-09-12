import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IssueMotorPolicyDto {
  @IsOptional()
  @IsString()
  actualPolicyNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualPremium?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

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

  // ── Missing Information / Completion Details ──
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @IsOptional()
  @IsString()
  engineNumber?: string;

  @IsOptional()
  @IsString()
  makeModel?: string;

  @IsOptional()
  @IsString()
  manufactureYearMonth?: string;

  @IsOptional()
  @IsString()
  nomineeName?: string;

  @IsOptional()
  @IsString()
  nomineeRelation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nomineeAge?: number;

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

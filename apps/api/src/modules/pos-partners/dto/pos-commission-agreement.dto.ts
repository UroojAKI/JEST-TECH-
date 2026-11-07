import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePosCommissionAgreementDto {
  @IsString()
  @IsNotEmpty({ message: 'insurerId is mandatory' })
  insurerId: string;

  @IsString()
  @IsNotEmpty({ message: 'productType is mandatory (e.g. MOTOR, HEALTH)' })
  productType: string;

  @IsOptional()
  @IsString()
  insuranceProductId?: string;

  @IsString()
  @IsIn(['PERCENTAGE', 'FIXED'], { message: 'commissionType must be PERCENTAGE or FIXED' })
  commissionType: 'PERCENTAGE' | 'FIXED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveUntil?: string;
}

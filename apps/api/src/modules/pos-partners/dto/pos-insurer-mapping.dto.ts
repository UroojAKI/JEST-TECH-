import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PosInsurerMappingDto {
  @IsString()
  @IsNotEmpty({ message: 'insurerId is mandatory' })
  insurerId: string;

  @IsOptional()
  @IsString()
  insurerPartnerCode?: string;

  @IsOptional()
  @IsString()
  insurerPospId?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveUntil?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

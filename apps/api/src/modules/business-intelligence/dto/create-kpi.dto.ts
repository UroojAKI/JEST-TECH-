import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  Matches,
  IsNumber,
} from 'class-validator';

export class CreateKpiDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_\s+\-*/().^%]+$/i, {
    message: 'Formula contains invalid characters',
  })
  formula: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsIn(['PERCENTAGE', 'CURRENCY', 'COUNT', 'RATIO', 'DAYS'])
  unit: string;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

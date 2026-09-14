import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  inApp?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  sms?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  whatsapp?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  renewals?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  claims?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  policies?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  leads?: boolean;
}

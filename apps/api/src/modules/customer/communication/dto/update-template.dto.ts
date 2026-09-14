import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({ example: 'POLICY_ISSUED_EMAIL' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'EMAIL' })
  @IsString()
  @IsOptional()
  channel?: string;

  @ApiPropertyOptional({ example: 'Policy Document Enclosed' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    example: 'Dear {{customerName}}, thank you for choosing JEST Policy.',
  })
  @IsString()
  @IsOptional()
  bodyTemplate?: string;
}

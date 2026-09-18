import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomerAlertDto {
  @ApiProperty({ description: 'Type of alert (e.g. RENEWAL_DUE, PAYMENT_REMINDER, MISSING_DOC)' })
  @IsNotEmpty()
  @IsString()
  alertType: string;

  @ApiProperty({ description: 'Alert message body' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Action target URL' })
  @IsOptional()
  @IsString()
  actionUrl?: string;
}

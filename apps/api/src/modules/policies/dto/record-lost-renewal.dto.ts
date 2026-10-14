import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecordLostRenewalDto {
  @ApiProperty({
    description: 'Mandatory reason why renewal was lost',
    example: 'Switched to competitor for lower rate',
  })
  @IsString()
  @IsNotEmpty({ message: 'Lost renewal reason is mandatory' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Name of the competitor insurer/broker if known',
    example: 'HDFC ERGO',
  })
  @IsOptional()
  @IsString()
  competitorName?: string;

  @ApiPropertyOptional({
    description: 'Additional notes or context on the loss',
    example: 'Offered 20% lower premium on comprehensive plan',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

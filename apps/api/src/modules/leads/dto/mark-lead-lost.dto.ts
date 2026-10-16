import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MarkLeadLostDto {
  @ApiProperty({
    description: 'Mandatory reason why lead was marked lost',
    example:
      'Price too high; customer opted for third-party aggregator discount',
  })
  @IsString()
  @IsNotEmpty({
    message: 'lossReason is required and must be a non-empty string',
  })
  lossReason: string;
}

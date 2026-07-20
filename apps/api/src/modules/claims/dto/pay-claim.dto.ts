import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class PayClaimDto {
  @ApiProperty({ example: 22000.0 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'TXN-9876543210' })
  @IsNotEmpty()
  @IsString()
  transactionId: string;

  @ApiProperty({ example: 'BANK_TRANSFER' })
  @IsNotEmpty()
  @IsString()
  paymentMethod: string;

  @ApiProperty({ example: 'John Doe - Bank of India, A/C #123456789' })
  @IsNotEmpty()
  @IsString()
  recipientDetails: string;
}

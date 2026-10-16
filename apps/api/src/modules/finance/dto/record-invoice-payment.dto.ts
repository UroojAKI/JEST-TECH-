import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RecordInvoicePaymentDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
  amount: string;

  @IsIn(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'])
  mode: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

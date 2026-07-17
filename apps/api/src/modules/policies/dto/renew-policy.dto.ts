import { IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class RenewPolicyDto {
  @IsInt()
  @Min(1)
  renewalNumber: number;

  @IsNumber()
  @Min(0)
  premiumAmount: number;

  @IsDateString()
  newExpiry: string;
}

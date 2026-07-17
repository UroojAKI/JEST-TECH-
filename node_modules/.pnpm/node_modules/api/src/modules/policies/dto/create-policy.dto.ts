import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePolicyMemberDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  relation: string;

  @IsDateString()
  dateOfBirth: string;
}

export class CreatePolicyNomineeDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  relation: string;

  @IsNumber()
  @Min(0)
  percentage: number;
}

export class CreatePolicyPaymentDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  quotationId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyMemberDto)
  members?: CreatePolicyMemberDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyNomineeDto)
  nominees: CreatePolicyNomineeDto[];

  @ValidateNested()
  @Type(() => CreatePolicyPaymentDto)
  payment: CreatePolicyPaymentDto;
}

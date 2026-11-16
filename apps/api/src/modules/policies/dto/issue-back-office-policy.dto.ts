import { IssueMotorPolicyDto } from '../../motor/dto/issue-motor-policy.dto';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreatePolicyMemberDto,
  CreatePolicyNomineeDto,
  CreatePolicyPaymentDto,
} from './create-policy.dto';

export class IssueBackOfficePolicyDto extends IssueMotorPolicyDto {
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyNomineeDto)
  nominees?: CreatePolicyNomineeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyMemberDto)
  members?: CreatePolicyMemberDto[];

  @IsOptional()
  @IsString()
  customerAadhaar?: string;

  @IsOptional()
  @IsString()
  issueSource?: string;

  @IsOptional()
  @IsString()
  policyType?: string;

  @IsOptional()
  @IsString()
  productLine?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePolicyPaymentDto)
  payment?: CreatePolicyPaymentDto;

  @IsOptional()
  @IsString()
  insurerPolicyNumber?: string;
}

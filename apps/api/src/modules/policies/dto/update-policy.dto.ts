import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { CreatePolicyDto } from './create-policy.dto';

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {
  @IsOptional()
  @IsInt()
  version?: number;
}

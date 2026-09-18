import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckDuplicateDto {
  @ApiPropertyOptional({ description: 'Mobile number to test for soft duplication' })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Email address to test for soft duplication' })
  @IsOptional()
  @IsString()
  email?: string;
}

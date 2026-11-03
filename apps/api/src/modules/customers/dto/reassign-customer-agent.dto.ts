import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, Min } from 'class-validator';

export class ReassignCustomerAgentDto {
  @ApiPropertyOptional({ description: 'Canonical Agent.id' })
  @IsOptional()
  @IsUUID()
  newAgentId?: string;

  @ApiPropertyOptional({ description: 'External Agent code; use with agentCodeSystem' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().normalize('NFC') : value))
  @IsString()
  @Length(1, 100)
  externalAgentCode?: string;

  @ApiPropertyOptional({ description: 'Identifier namespace for externalAgentCode' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  agentCodeSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

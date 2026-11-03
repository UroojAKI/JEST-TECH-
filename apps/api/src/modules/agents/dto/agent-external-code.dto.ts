import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentExternalCodeStatus, AgentIdentifierVerificationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

const normalizeCodeSystem = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().normalize('NFC').toUpperCase() : value;

export class CreateAgentExternalCodeDto {
  @ApiProperty({ example: 'IGSK001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().normalize('NFC') : value))
  @IsString()
  @Length(1, 100)
  externalCode: string;

  @ApiProperty({ example: 'CLIENT_A' })
  @Transform(normalizeCodeSystem)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,49}$/)
  codeSystem: string;

  @ApiPropertyOptional({ example: 'Client Agent Master' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Context for the initial verification state.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationNotes?: string;
}

export class UpdateAgentExternalCodeDto {
  @ApiPropertyOptional({ example: 'IGSK001' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().normalize('NFC') : value))
  @IsString()
  @Length(1, 100)
  externalCode?: string;

  @ApiPropertyOptional({ example: 'CLIENT_A' })
  @IsOptional()
  @Transform(normalizeCodeSystem)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,49}$/)
  codeSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ enum: AgentIdentifierVerificationStatus })
  @IsOptional()
  @IsEnum(AgentIdentifierVerificationStatus)
  verificationStatus?: AgentIdentifierVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AgentExternalCodeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AgentExternalCodeStatus })
  @IsOptional()
  @IsEnum(AgentExternalCodeStatus)
  status?: AgentExternalCodeStatus;

  @ApiPropertyOptional({ enum: AgentIdentifierVerificationStatus })
  @IsOptional()
  @IsEnum(AgentIdentifierVerificationStatus)
  verificationStatus?: AgentIdentifierVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(normalizeCodeSystem)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,49}$/)
  codeSystem?: string;
}

export enum AgentIdentifierType {
  EXTERNAL_CODE = 'EXTERNAL_CODE',
  AGENT_CODE = 'AGENT_CODE',
  EMPLOYEE_CODE = 'EMPLOYEE_CODE',
  AGENT_ID = 'AGENT_ID',
  USER_ID = 'USER_ID',
}

export class ResolveAgentIdentifierDto {
  @ApiProperty({ example: 'IGSK001' })
  @IsString()
  @Length(1, 100)
  identifier: string;

  @ApiProperty({ enum: AgentIdentifierType })
  @IsEnum(AgentIdentifierType)
  identifierType: AgentIdentifierType;

  @ApiPropertyOptional({ example: 'CLIENT_A' })
  @IsOptional()
  @Transform(normalizeCodeSystem)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,49}$/)
  codeSystem?: string;
}

export class AgentExternalCodeActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AgentExternalCodeHistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class TransitionLeadDto {
  @ApiProperty({
    enum: LeadStatus,
    description: 'Target lifecycle status for the lead',
    example: LeadStatus.CONTACTED,
  })
  @IsEnum(LeadStatus)
  @IsNotEmpty({ message: 'targetStatus is required' })
  targetStatus: LeadStatus;

  @ApiPropertyOptional({
    description: 'Optional remarks or audit reason for the transition',
    example: 'Customer answered initial qualification call',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

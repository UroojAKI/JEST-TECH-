import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ApprovalActionDto {
  @ApiProperty({
    enum: ['APPROVE', 'REJECT'],
    description: 'Decision action on the approval request',
    example: 'APPROVE',
  })
  @IsIn(['APPROVE', 'REJECT'])
  @IsNotEmpty()
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({
    description: 'Optional remarks or audit comments',
    example: 'Verified KYC and premium amount',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkApprovalActionDto {
  @ApiProperty({
    description: 'Array of approval request IDs',
    type: [String],
    example: ['appr_123', 'appr_456'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({
    enum: ['APPROVE', 'REJECT'],
    description: 'Decision action to apply across all IDs',
    example: 'APPROVE',
  })
  @IsIn(['APPROVE', 'REJECT'])
  @IsNotEmpty()
  action: 'APPROVE' | 'REJECT';
}

export class TriggerWorkflowTransitionDto {
  @ApiProperty({
    description: 'Identifier of the transition to execute',
    example: 'TRANS_APPROVE_PROPOSAL',
  })
  @IsString()
  @IsNotEmpty()
  transitionId: string;

  @ApiPropertyOptional({
    description: 'Optional audit comments regarding the state transition',
    example: 'Approved proposal following compliance review',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}

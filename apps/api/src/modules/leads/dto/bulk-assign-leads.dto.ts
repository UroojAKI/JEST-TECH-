import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class BulkAssignLeadsDto {
  @ApiProperty({
    description: 'Array of lead IDs to reassign',
    type: [String],
    example: ['11111111-1111-1111-1111-111111111111'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  leadIds: string[];

  @ApiProperty({
    description: 'Target agent user ID',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsUUID('4')
  @IsNotEmpty()
  targetAgentId: string;
}

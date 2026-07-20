import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class AssessClaimDto {
  @ApiProperty({
    example: 'Found minor bumper damage consistent with front collision.',
  })
  @IsNotEmpty()
  @IsString()
  findings: string;

  @ApiProperty({ example: 25000.0 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  estimatedLoss: number;

  @ApiProperty({ example: 22000.0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  approvedAmount: number;
}

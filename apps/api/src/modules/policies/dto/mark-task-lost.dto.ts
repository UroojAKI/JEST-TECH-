import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarkTaskLostDto {
  @ApiPropertyOptional({
    description: 'Reason why the renewal task was marked lost / cancelled',
    example: 'Vehicle sold or transferred by customer',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

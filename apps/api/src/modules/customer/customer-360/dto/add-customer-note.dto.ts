import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AddCustomerNoteDto {
  @ApiPropertyOptional({
    description: 'Note content or remarks regarding the customer',
    example: 'Customer requested follow up regarding premium quote next week',
  })
  @IsOptional()
  @IsString()
  content?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: UserStatus,
    description: 'Target user status',
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Reason for status update or lifecycle change',
    example: 'Account verification completed',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

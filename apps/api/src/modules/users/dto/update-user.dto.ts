import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { UserStatus } from '@prisma/client';
import {
  transformOptionalUserPhone,
  USER_PHONE_ERROR_MESSAGE,
  USER_PHONE_REGEX,
} from '../utils/user-phone.util';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['phone'] as const),
) {
  @IsOptional()
  @Transform(({ value }) =>
    transformOptionalUserPhone(value, { emptyAsNull: true }),
  )
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(USER_PHONE_REGEX, { message: USER_PHONE_ERROR_MESSAGE })
  phone?: string | null;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  branchId?: string;
}

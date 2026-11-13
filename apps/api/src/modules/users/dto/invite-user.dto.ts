import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import {
  transformOptionalUserPhone,
  USER_PHONE_ERROR_MESSAGE,
  USER_PHONE_REGEX,
} from '../utils/user-phone.util';

export class InviteUserDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  role: string;

  @IsOptional()
  @Transform(({ value }) => transformOptionalUserPhone(value))
  @IsString()
  @Matches(USER_PHONE_REGEX, { message: USER_PHONE_ERROR_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsBoolean()
  collectContacts?: boolean;
}

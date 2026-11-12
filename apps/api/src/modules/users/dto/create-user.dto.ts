import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

import { RoleType } from '@prisma/client';
import {
  transformOptionalUserPhone,
  USER_PHONE_ERROR_MESSAGE,
  USER_PHONE_REGEX,
} from '../utils/user-phone.util';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @Transform(({ value }) => transformOptionalUserPhone(value))
  @IsString()
  @Matches(USER_PHONE_REGEX, { message: USER_PHONE_ERROR_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsOptional()
  @IsBoolean()
  collectContacts?: boolean;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  jobRole?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;
}

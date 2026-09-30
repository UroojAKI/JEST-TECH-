import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';
import { VehicleCategory, VehicleStatus } from '@prisma/client';

export class CreateMotorQuotationCaseDto {
  @IsEnum(VehicleCategory)
  category: VehicleCategory;

  @IsOptional()
  @IsEnum(VehicleStatus)
  vehicleStatus?: VehicleStatus;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsString()
  contactId: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  journeyId?: string;

  @IsObject()
  customerSnapshot: Record<string, any>;

  @IsObject()
  vehicleSnapshot: Record<string, any>;

  @IsOptional()
  @IsObject()
  previousPolicySnapshot?: Record<string, any>;
}

export class SelectCaseQuotationDto {
  @IsString()
  quotationId: string;

  @IsOptional()
  @IsString()
  selectionNotes?: string;
}

export class TransitionCaseStatusDto {
  @IsString()
  targetStatus: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelCaseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
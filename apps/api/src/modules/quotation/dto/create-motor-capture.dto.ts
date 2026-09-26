import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateMotorCaptureDto {
  @IsString()
  vehicleCategory: string; // BIKE | PRIVATE_CAR | GCV | TRACTOR | AUTO | TAXI | BUS | MISC

  @IsString()
  policyType: string; // TP_ONLY | SAOD | PACKAGE

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsString()
  insurerName: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsNumber()
  totalPremium?: number;

  @IsOptional()
  @IsNumber()
  idv?: number;

  @IsOptional()
  @IsNumber()
  ncbPercentage?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  proposerDetails?: Record<string, any>;

  @IsOptional()
  @IsObject()
  vehicleDetails?: Record<string, any>;

  @IsOptional()
  @IsObject()
  policyDetails?: Record<string, any>;

  @IsOptional()
  @IsObject()
  saodVerification?: Record<string, any>;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsNumber()
  basePremium?: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  gstAmount?: number;

  @IsOptional()
  @IsString()
  calculationVersion?: string;

  @IsOptional()
  @IsString()
  rateConfigurationVersion?: string;

  @IsOptional()
  @IsString()
  snapshotId?: string;

  @IsOptional()
  @IsString()
  inputHash?: string;

  @IsOptional()
  @IsObject()
  calculationSnapshot?: Record<string, any>;

  @IsOptional()
  @IsArray()
  documents?: Array<{ docType: string; fileName?: string; fileKey?: string }>;

  @IsOptional()
  @IsString()
  journeyId?: string;

  @IsOptional()
  @IsObject()
  manualAgent?: {
    isManual: boolean;
    name?: string;
    code?: string;
    contact?: string;
  };

  @IsOptional()
  @IsObject()
  previousPolicyDetails?: Record<string, any>;
}

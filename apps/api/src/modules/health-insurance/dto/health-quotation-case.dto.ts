import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DocumentVerificationStatus,
  Gender,
  HealthDocumentType,
  HealthPlanCategory,
  HealthPolicyForm,
  InsuredRelation,
  NomineeRelation,
  ProposerOccupation,
} from '@prisma/client';

/**
 * Riders & Add-on Covers - Policy Form (iii), field 1.
 */
export enum HealthRider {
  CRITICAL_ILLNESS = 'CRITICAL_ILLNESS',
  PERSONAL_ACCIDENT = 'PERSONAL_ACCIDENT',
  HOSPITAL_CASH = 'HOSPITAL_CASH',
  OPD_COVER = 'OPD_COVER',
  MATERNITY_COVER = 'MATERNITY_COVER',
  ROOM_RENT_WAIVER = 'ROOM_RENT_WAIVER',
}

/**
 * One insured member - common fields 4-7 and 15-17.
 */
export class HealthInsuredMemberDto {
  @ApiPropertyOptional({ description: 'Pick an existing FamilyMember of the contact' })
  @IsOptional()
  @IsUUID()
  familyMemberId?: string;

  @ApiProperty({ example: 'Sneha' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ enum: InsuredRelation, example: InsuredRelation.SELF })
  @IsEnum(InsuredRelation)
  relation: InsuredRelation;

  @ApiProperty({ example: '1990-05-14' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender, example: Gender.FEMALE })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: 162, description: 'Height in cm' })
  @IsNumber()
  @Min(30)
  @Max(250)
  heightCm: number;

  @ApiProperty({ example: 58, description: 'Weight in kg' })
  @IsNumber()
  @Min(1)
  @Max(300)
  weightKg: number;

  @ApiProperty({ example: 'None', description: 'Full disclosure mandatory as per IRDAI; use "None" if nothing to declare' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  preExistingDiseases: string;

  @ApiProperty({ example: false, description: 'Smoker / Tobacco / Alcohol use' })
  @IsBoolean()
  isSmoker: boolean;
}

/** Common fields 9, 11, 12 - mandatory KYC for Health (IRDAI). */
export class ProposerKycDto {
  @ApiPropertyOptional({ example: 'sneha@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be in format ABCDE1234F' })
  panNumber?: string;

  @ApiPropertyOptional({ example: '123412341234' })
  @IsOptional()
  @Matches(/^\d{12}$/, { message: 'aadhaarNumber must be exactly 12 digits' })
  aadhaarNumber?: string;
}

/** Policy Form (iii) - one selected rider with its own sum insured and premium. */
export class HealthRiderLineDto {
  @ApiProperty({ enum: HealthRider, example: HealthRider.HOSPITAL_CASH })
  @IsEnum(HealthRider)
  rider: HealthRider;

  @ApiProperty({ example: 100000, description: 'Rider sum insured (cannot exceed base sum insured)' })
  @IsNumber()
  @Min(1)
  sumInsured: number;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  @Min(0)
  premium: number;
}

export class HealthAddressDto {
  @ApiProperty({ example: '12, MG Road' })
  @IsString()
  @IsNotEmpty()
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Karnataka' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @IsNotEmpty()
  pincode: string;
}

/**
 * Creates one Health proposal (case). Quotes are added to it afterwards.
 */
export class CreateHealthQuotationCaseDto {
  @ApiProperty({ enum: HealthPlanCategory, example: HealthPlanCategory.FAMILY_FLOATER })
  @IsEnum(HealthPlanCategory)
  planCategory: HealthPlanCategory;

  @ApiProperty({ enum: HealthPolicyForm, example: HealthPolicyForm.NEW_POLICY })
  @IsEnum(HealthPolicyForm)
  policyForm: HealthPolicyForm;

  @ApiProperty({ description: 'Proposer contact ID' })
  @IsUUID()
  contactId: string;

  @ApiPropertyOptional({ description: 'Originating lead ID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiProperty({ enum: ProposerOccupation, example: ProposerOccupation.SALARIED })
  @IsEnum(ProposerOccupation)
  occupation: ProposerOccupation;

  @ApiPropertyOptional({ example: 1200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualIncome?: number;

  @ApiProperty({ type: HealthAddressDto })
  @ValidateNested()
  @Type(() => HealthAddressDto)
  address: HealthAddressDto;

  @ApiProperty({ example: 'Ravi B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nomineeName: string;

  @ApiProperty({ enum: NomineeRelation, example: NomineeRelation.SPOUSE })
  @IsEnum(NomineeRelation)
  nomineeRelation: NomineeRelation;

  @ApiProperty({
    description:
      'Section A fields for the chosen planCategory. Validated per category - see health-plan-details.dto.ts',
    example: { planName: 'Optima Secure', uin: 'HDFHLIP23071V052223', sumInsured: 500000, roomRentCategory: 'NO_CAPPING' },
  })
  @IsObject()
  planDetails: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Policy Form (ii). Required for RENEWAL_PORTABILITY: renewalType, previousInsurerName, previousPolicyNumber, sumInsuredContinuation, cumulativeBonusPercent, claimInExpiringPolicy, waitingPeriodCredit (portability)',
  })
  @IsOptional()
  @IsObject()
  previousPolicySnapshot?: Record<string, any>;

  @ApiPropertyOptional({
    type: () => ProposerKycDto,
    description: 'Email / PAN / Aadhaar are mandatory for Health. Supply any that are missing on the contact.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProposerKycDto)
  proposerKyc?: ProposerKycDto;

  @ApiProperty({ type: [HealthInsuredMemberDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HealthInsuredMemberDto)
  members: HealthInsuredMemberDto[];
}

/**
 * One insurer quote inside a Health case (Policy Forms i / ii / iii premium fields).
 * Several quotes can be added to the same case.
 */
export class AddHealthQuoteDto {
  @ApiProperty({ example: 'HDFC ERGO' })
  @IsString()
  @IsNotEmpty()
  insurerName: string;

  @ApiProperty({ example: 'Optima Secure' })
  @IsString()
  @IsNotEmpty()
  planName: string;

  @ApiProperty({ example: 'HDFHLIP23071V052223', description: 'UIN as filed with IRDAI' })
  @IsString()
  @IsNotEmpty()
  uin: string;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(1)
  sumInsured: number;

  @ApiProperty({ example: 1, description: 'Policy tenure in years (1, 2 or 3)' })
  @IsInt()
  @Min(1)
  @Max(3)
  policyTenureYears: number;

  @ApiProperty({ example: 18000 })
  @IsNumber()
  @Min(0)
  basePremium: number;

  @ApiPropertyOptional({ type: [HealthRiderLineDto], description: 'Policy Form (iii) riders, one line each' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthRiderLineDto)
  riders?: HealthRiderLineDto[];

  @ApiPropertyOptional({ example: 10, description: 'Voluntary co-payment %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coPaymentPercent?: number;

  @ApiProperty({ example: 15, description: 'Commission / discount percentage (D%) - mandatory per the PDF; send 0 if none' })
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent: number;

  @ApiPropertyOptional({ example: 10, description: 'Rider commission / discount % (defaults to commissionPercent)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riderCommissionPercent?: number;

  @ApiPropertyOptional({
    enum: ['INITIAL_30_DAYS', 'PED_2_4_YEARS', 'SPECIFIC_ILLNESS_1_2_YEARS'],
    example: 'INITIAL_30_DAYS',
    description: 'Required for New Policy quotes (Form i field 6)',
  })
  @IsOptional()
  @IsIn(['INITIAL_30_DAYS', 'PED_2_4_YEARS', 'SPECIFIC_ILLNESS_1_2_YEARS'])
  waitingPeriod?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  medicalCheckupRequired?: boolean;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  policyStartDate?: string;
}

export class SelectHealthQuoteDto {
  @ApiProperty()
  @IsUUID()
  quotationId: string;
}

/**
 * Attach a file already uploaded via POST /documents/upload to a Health case,
 * optionally to one quote ("Keep Upload option after each Quote").
 */
export class AttachHealthDocumentDto {
  @ApiProperty({ description: 'Document ID returned by POST /documents/upload' })
  @IsUUID()
  documentId: string;

  @ApiProperty({ enum: HealthDocumentType, example: HealthDocumentType.QUOTE_DOCUMENT })
  @IsEnum(HealthDocumentType)
  documentType: HealthDocumentType;

  @ApiPropertyOptional({ description: 'Quote this file belongs to (required for QUOTE_DOCUMENT)' })
  @IsOptional()
  @IsUUID()
  quotationId?: string;
}

export class VerifyHealthDocumentDto {
  @ApiProperty({ enum: DocumentVerificationStatus, example: DocumentVerificationStatus.VERIFIED })
  @IsEnum(DocumentVerificationStatus)
  status: DocumentVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

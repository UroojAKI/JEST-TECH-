import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointeeRelation,
  Gender,
  LifeCaseStatus,
  LifePlanCategory,
  LifePolicyForm,
  LifePolicyType,
  NomineeRelation,
  PaymentTrackingStatus,
  PremiumPaymentFrequency,
  PremiumPaymentType,
  ProposerOccupation,
  ProposerRelation,
  SmokerStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { LifeRiderInputDto } from './life-rider.dto';
import { SecondaryLifeAssuredDto } from './secondary-life-assured.dto';

export class ProposerKycDto {
  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsString()
  email?: string;
}

export class CreateLifeQuotationCaseDto {
  @ApiProperty({ description: 'Proposer Contact UUID', example: 'd3b07384-d113-4a11-b283-7c2807e7b6d1' })
  @IsUUID()
  contactId: string;

  @ApiPropertyOptional({ description: 'Optional associated Lead UUID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Optional assigned Agent UUID (Admin/BackOffice override)' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiProperty({ enum: LifePlanCategory, description: 'One of the 8 IRDAI life plan categories' })
  @IsEnum(LifePlanCategory)
  planCategory: LifePlanCategory;

  @ApiPropertyOptional({ enum: LifePolicyForm, default: LifePolicyForm.NEW_POLICY })
  @IsOptional()
  @IsEnum(LifePolicyForm)
  policyForm?: LifePolicyForm;

  @ApiPropertyOptional({ enum: ProposerOccupation, description: 'Proposer occupation type' })
  @IsOptional()
  @IsEnum(ProposerOccupation)
  occupation?: ProposerOccupation;

  @ApiPropertyOptional({ description: 'Proposer annual income in INR', example: 1200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualIncome?: number;

  @ApiPropertyOptional({ description: 'Proposer address snapshot' })
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Optional KYC details to update on Contact record' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProposerKycDto)
  proposerKyc?: ProposerKycDto;

  // Life Assured Underwriting Details
  @ApiPropertyOptional({ description: 'Whether the Life Assured is someone other than the proposer', default: false })
  @IsOptional()
  @IsBoolean()
  isLifeAssuredDifferent?: boolean;

  @ApiPropertyOptional({ enum: ProposerRelation, default: ProposerRelation.SELF })
  @IsOptional()
  @IsEnum(ProposerRelation)
  proposerRelation?: ProposerRelation;

  @ApiPropertyOptional({ description: 'Life Assured full legal name if different from proposer' })
  @IsOptional()
  @IsString()
  lifeAssuredName?: string;

  @ApiPropertyOptional({ description: 'Life Assured date of birth (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  lifeAssuredDob?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Life Assured gender' })
  @IsOptional()
  @IsEnum(Gender)
  lifeAssuredGender?: Gender;

  // Underwriting Mortality & Medical Details
  @ApiPropertyOptional({ enum: SmokerStatus, default: SmokerStatus.UNKNOWN })
  @IsOptional()
  @IsEnum(SmokerStatus)
  smokerStatus?: SmokerStatus;

  @ApiPropertyOptional({ description: 'Height in cm', example: 175 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Weight in kg', example: 70 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Occupation risk classification (e.g. CLASS_1, HAZARDOUS)' })
  @IsOptional()
  @IsString()
  occupationRiskCategory?: string;

  @ApiPropertyOptional({ description: 'Whether pre-existing illnesses exist', default: false })
  @IsOptional()
  @IsBoolean()
  hasPreExistingIllness?: boolean;

  @ApiPropertyOptional({ description: 'Details of medical history / pre-existing conditions' })
  @IsOptional()
  @IsString()
  medicalHistoryDetails?: string;

  // Joint-Life Annuity Underwriting (Category 1.7)
  @ApiPropertyOptional({ type: SecondaryLifeAssuredDto, description: 'Secondary Life details for Joint-Life Annuity' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryLifeAssuredDto)
  secondaryLifeAssured?: SecondaryLifeAssuredDto;

  // Nominee & Minor Appointee
  @ApiPropertyOptional({ description: 'Nominee full legal name', example: 'Anita Sharma' })
  @IsOptional()
  @IsString()
  nomineeName?: string;

  @ApiPropertyOptional({ description: 'Nominee date of birth (ISO-8601)', example: '1995-08-20' })
  @IsOptional()
  @IsDateString()
  nomineeDob?: string;

  @ApiPropertyOptional({ enum: NomineeRelation, description: 'Nominee relation to Life Assured' })
  @IsOptional()
  @IsEnum(NomineeRelation)
  nomineeRelation?: NomineeRelation;

  @ApiPropertyOptional({ description: 'Appointee full name if nominee is a minor (< 18)' })
  @IsOptional()
  @IsString()
  appointeeName?: string;

  @ApiPropertyOptional({ description: 'Appointee date of birth (ISO-8601) - must be >= 18' })
  @IsOptional()
  @IsDateString()
  appointeeDob?: string;

  @ApiPropertyOptional({ enum: AppointeeRelation, description: 'Appointee relation to minor nominee' })
  @IsOptional()
  @IsEnum(AppointeeRelation)
  appointeeRelation?: AppointeeRelation;

  // Category Specific Section A Details & Previous Policy
  @ApiPropertyOptional({ description: 'Category-specific parameters (Term, PPT, Fund, Annuity option, etc.)' })
  @IsOptional()
  @IsObject()
  categoryData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Previous life policy snapshot for renewals / portability' })
  @IsOptional()
  @IsObject()
  previousPolicySnapshot?: Record<string, any>;
}

export class UpdateLifeQuotationCaseDto {
  @ApiPropertyOptional({ enum: LifePlanCategory })
  @IsOptional()
  @IsEnum(LifePlanCategory)
  planCategory?: LifePlanCategory;

  @ApiPropertyOptional({ enum: LifeCaseStatus })
  @IsOptional()
  @IsEnum(LifeCaseStatus)
  status?: LifeCaseStatus;

  @ApiPropertyOptional({ enum: ProposerOccupation })
  @IsOptional()
  @IsEnum(ProposerOccupation)
  occupation?: ProposerOccupation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualIncome?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLifeAssuredDifferent?: boolean;

  @ApiPropertyOptional({ enum: ProposerRelation })
  @IsOptional()
  @IsEnum(ProposerRelation)
  proposerRelation?: ProposerRelation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lifeAssuredName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lifeAssuredDob?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  lifeAssuredGender?: Gender;

  @ApiPropertyOptional({ enum: SmokerStatus })
  @IsOptional()
  @IsEnum(SmokerStatus)
  smokerStatus?: SmokerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  heightCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupationRiskCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPreExistingIllness?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicalHistoryDetails?: string;

  @ApiPropertyOptional({ type: SecondaryLifeAssuredDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryLifeAssuredDto)
  secondaryLifeAssured?: SecondaryLifeAssuredDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomineeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nomineeDob?: string;

  @ApiPropertyOptional({ enum: NomineeRelation })
  @IsOptional()
  @IsEnum(NomineeRelation)
  nomineeRelation?: NomineeRelation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appointeeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  appointeeDob?: string;

  @ApiPropertyOptional({ enum: AppointeeRelation })
  @IsOptional()
  @IsEnum(AppointeeRelation)
  appointeeRelation?: AppointeeRelation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  categoryData?: Record<string, any>;
}

export class AddLifeQuoteDto {
  @ApiProperty({ description: 'Insurer name', example: 'HDFC Life Insurance Co.' })
  @IsString()
  @IsNotEmpty()
  insurerName: string;

  @ApiPropertyOptional({ description: 'Insurer master UUID' })
  @IsOptional()
  @IsString()
  insurerId?: string;

  @ApiPropertyOptional({ description: 'Product plan code', example: 'CLICK2PROTECT_SUPER' })
  @IsOptional()
  @IsString()
  productCode?: string;

  @ApiProperty({ description: 'Sum insured / sum assured in INR', example: 10000000 })
  @IsNumber()
  @Min(10000)
  sumInsured: number;

  @ApiProperty({ description: 'Base plan premium before riders, GST, and discount', example: 18000 })
  @IsNumber()
  @Min(0)
  basePremium: number;

  @ApiPropertyOptional({ description: 'Customer discount on base plan', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ description: 'Policy term in years', example: 40 })
  @IsNumber()
  @Min(1)
  policyTermYears: number;

  @ApiProperty({ description: 'Premium paying term (PPT) in years', example: 10 })
  @IsNumber()
  @Min(1)
  premiumPayingTermYears: number;

  @ApiProperty({
    enum: LifePolicyType,
    description: 'Policy structure (individual/joint/group)',
    default: LifePolicyType.INDIVIDUAL_PURE_RISK,
  })
  @IsEnum(LifePolicyType)
  lifePolicyType: LifePolicyType;

  @ApiProperty({
    enum: PremiumPaymentType,
    description: 'Payment structure (regular/limited/single)',
    default: PremiumPaymentType.LIMITED_PAY,
  })
  @IsEnum(PremiumPaymentType)
  premiumPaymentType: PremiumPaymentType;

  @ApiProperty({
    enum: PremiumPaymentFrequency,
    description: 'Installment frequency',
    default: PremiumPaymentFrequency.ANNUAL,
  })
  @IsEnum(PremiumPaymentFrequency)
  premiumFrequency: PremiumPaymentFrequency;

  @ApiPropertyOptional({
    description: 'Brokerage commission percentage for base plan (agency revenue)',
    example: 25.0,
    default: 0.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  brokeragePercent?: number;

  @ApiPropertyOptional({
    description: 'Line-item riders attached to this quotation',
    type: [LifeRiderInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifeRiderInputDto)
  riders?: LifeRiderInputDto[];

  @ApiPropertyOptional({ description: 'Additional underwriting or insurer quotation metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SelectLifeQuoteDto {
  @ApiProperty({ description: 'Quotation UUID to select', example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  @IsUUID()
  quotationId: string;
}

export class RecordLifePaymentDto {
  @ApiPropertyOptional({ description: 'Payment amount; defaults to authoritative totalPremium' })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ description: 'Payment reference / transaction number / UTR', example: 'HDFC982347102' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @ApiProperty({ description: 'Payment method (e.g. NET_BANKING, UPI, CHEQUE, DEBIT_CARD)', example: 'NET_BANKING' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiPropertyOptional({
    enum: PaymentTrackingStatus,
    description: 'Target payment status. Agents can only submit UNDER_PROCESS. Back Office can verify PAID.',
  })
  @IsOptional()
  @IsEnum(PaymentTrackingStatus)
  status?: PaymentTrackingStatus;

  @ApiPropertyOptional({ description: 'Payment date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ description: 'Payment reconciliation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class LifeCaseFilterDto {
  @ApiPropertyOptional({ enum: LifePlanCategory })
  @IsOptional()
  @IsEnum(LifePlanCategory)
  planCategory?: LifePlanCategory;

  @ApiPropertyOptional({ enum: LifeCaseStatus })
  @IsOptional()
  @IsEnum(LifeCaseStatus)
  status?: LifeCaseStatus;

  @ApiPropertyOptional({ description: 'Search by caseCode, proposer name, phone or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Lead UUID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Filter by Contact UUID' })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}


import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SecondaryLifeAssuredDto } from './secondary-life-assured.dto';

// 1.1 Pure Risk Term
export class TermInsuranceDetailsDto {
  @ApiProperty({ description: 'Death benefit sum assured in INR', example: 10000000 })
  @IsNumber()
  @Min(100000)
  sumAssured: number;

  @ApiProperty({ description: 'Policy term duration in years', example: 40 })
  @IsNumber()
  @Min(5)
  termYears: number;

  @ApiProperty({ description: 'Premium paying term in years', example: 10 })
  @IsNumber()
  @Min(1)
  pptYears: number;

  @ApiProperty({
    description: 'Death benefit settlement option',
    enum: ['LUMP_SUM', 'MONTHLY_INCOME', 'LUMP_SUM_PLUS_INCOME', 'INCREASING_INCOME'],
    example: 'LUMP_SUM',
  })
  @IsIn(['LUMP_SUM', 'MONTHLY_INCOME', 'LUMP_SUM_PLUS_INCOME', 'INCREASING_INCOME'])
  deathBenefitPayoutOption: string;

  @ApiPropertyOptional({ description: 'Terminal illness benefit inclusion', default: true })
  @IsOptional()
  @IsBoolean()
  terminalIllnessBenefitIncluded?: boolean;
}

// 1.2 Savings / Endowment Plans
export class SavingsPlanDetailsDto {
  @ApiProperty({ description: 'Guaranteed sum assured on maturity in INR', example: 2500000 })
  @IsNumber()
  @Min(50000)
  sumAssured: number;

  @ApiProperty({ description: 'Policy term in years', example: 20 })
  @IsNumber()
  @Min(5)
  policyTermYears: number;

  @ApiProperty({ description: 'Premium paying term in years', example: 10 })
  @IsNumber()
  @Min(5)
  pptYears: number;

  @ApiPropertyOptional({ description: 'Guaranteed addition / bonus percentage', example: 6.5 })
  @IsOptional()
  @IsNumber()
  guaranteedAdditionPercent?: number;

  @ApiPropertyOptional({
    description: 'Maturity payout choice',
    enum: ['LUMP_SUM', 'REGULAR_ANNUAL_INCOME'],
    default: 'LUMP_SUM',
  })
  @IsOptional()
  @IsIn(['LUMP_SUM', 'REGULAR_ANNUAL_INCOME'])
  maturityPayoutOption?: string;
}

// 1.3 ULIPs / Investment Plans
export class InvestmentPlanDetailsDto {
  @ApiProperty({ description: 'Target annual premium / investment amount in INR', example: 120000 })
  @IsNumber()
  @Min(12000)
  annualInvestmentAmount: number;

  @ApiProperty({ description: 'Policy term in years', example: 15 })
  @IsNumber()
  @Min(5)
  policyTermYears: number;

  @ApiProperty({ description: 'Premium paying term in years', example: 10 })
  @IsNumber()
  @Min(5)
  pptYears: number;

  @ApiProperty({
    description: 'Fund allocation profile',
    enum: ['GROWTH_EQUITY', 'BALANCED', 'DEBT_SECURE', 'LIQUID_CASH'],
    example: 'BALANCED',
  })
  @IsIn(['GROWTH_EQUITY', 'BALANCED', 'DEBT_SECURE', 'LIQUID_CASH'])
  fundChoice: string;

  @ApiProperty({
    description: 'Investor risk profile',
    enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
    example: 'MODERATE',
  })
  @IsIn(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'])
  riskProfile: string;

  @ApiPropertyOptional({ description: 'Whether top-up premium facility is enabled', default: false })
  @IsOptional()
  @IsBoolean()
  topUpAllowed?: boolean;
}

// 1.4 Retirement & Pension
export class RetirementPensionDetailsDto {
  @ApiProperty({ description: 'Vesting / retirement age in years', example: 60 })
  @IsNumber()
  @Min(45)
  vestingAge: number;

  @ApiProperty({ description: 'Target accumulation corpus at vesting', example: 15000000 })
  @IsNumber()
  @Min(100000)
  targetCorpus: number;

  @ApiPropertyOptional({ description: 'Deferment period in years', example: 15 })
  @IsOptional()
  @IsNumber()
  defermentPeriodYears?: number;

  @ApiProperty({
    description: 'Post-retirement annuity payout frequency',
    enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL'],
    example: 'MONTHLY',
  })
  @IsIn(['MONTHLY', 'QUARTERLY', 'ANNUAL'])
  annuityFrequency: string;
}

// 1.5 Child Future Plans
export class ChildFutureDetailsDto {
  @ApiProperty({ description: 'Child full legal name', example: 'Aarav Sharma' })
  @IsString()
  @IsNotEmpty()
  childName: string;

  @ApiProperty({ description: 'Child date of birth (ISO-8601)', example: '2018-04-10' })
  @IsString()
  @IsNotEmpty()
  childDob: string;

  @ApiProperty({ description: 'Child gender', enum: ['MALE', 'FEMALE', 'OTHER'], example: 'MALE' })
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  childGender: string;

  @ApiProperty({ description: 'Target education / marriage corpus in INR', example: 5000000 })
  @IsNumber()
  @Min(100000)
  targetCorpus: number;

  @ApiProperty({
    description: 'Waiver of premium rider on parent/proposer death',
    default: true,
  })
  @IsBoolean()
  waiverOfPremiumOnParentDeath: boolean;

  @ApiPropertyOptional({
    description: 'Key education milestone payout ages (e.g. [18, 21, 24])',
    type: [Number],
    example: [18, 21, 24],
  })
  @IsOptional()
  @IsArray()
  milestoneAges?: number[];
}

// 1.6 Whole Life Insurance (99/100 Years)
export class WholeLifeDetailsDto {
  @ApiProperty({ description: 'Life sum assured in INR', example: 5000000 })
  @IsNumber()
  @Min(500000)
  sumAssured: number;

  @ApiProperty({
    description: 'Coverage duration limit (typically 99 or 100 years of age)',
    example: 99,
  })
  @IsNumber()
  @IsIn([99, 100])
  coverageUptoAge: number;

  @ApiProperty({ description: 'Premium paying term in years', example: 15 })
  @IsNumber()
  @Min(5)
  pptYears: number;

  @ApiPropertyOptional({ description: 'Survival income benefit starting age', example: 60 })
  @IsOptional()
  @IsNumber()
  survivalBenefitStartAge?: number;
}

// 1.7 Annuity (Immediate / Joint-Life Annuity)
export class AnnuityDetailsDto {
  @ApiProperty({ description: 'Purchase price / single corpus in INR', example: 5000000 })
  @IsNumber()
  @Min(100000)
  purchasePrice: number;

  @ApiProperty({
    description: 'Annuity option structure',
    enum: [
      'LIFE_ANNUITY_SINGLE',
      'LIFE_ANNUITY_RETURN_OF_PURCHASE_PRICE',
      'JOINT_LIFE_LAST_SURVIVOR',
      'JOINT_LIFE_WITH_RETURN_OF_PURCHASE_PRICE',
      'GUARANTEED_PERIOD_5_YEARS',
      'GUARANTEED_PERIOD_10_YEARS',
      'INCREASING_ANNUITY_3_PERCENT',
    ],
    example: 'JOINT_LIFE_WITH_RETURN_OF_PURCHASE_PRICE',
  })
  @IsIn([
    'LIFE_ANNUITY_SINGLE',
    'LIFE_ANNUITY_RETURN_OF_PURCHASE_PRICE',
    'JOINT_LIFE_LAST_SURVIVOR',
    'JOINT_LIFE_WITH_RETURN_OF_PURCHASE_PRICE',
    'GUARANTEED_PERIOD_5_YEARS',
    'GUARANTEED_PERIOD_10_YEARS',
    'INCREASING_ANNUITY_3_PERCENT',
  ])
  annuityOption: string;

  @ApiProperty({
    description: 'Payout frequency',
    enum: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'],
    example: 'MONTHLY',
  })
  @IsIn(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'])
  payoutFrequency: string;

  @ApiPropertyOptional({
    description: 'Secondary Life Assured details (mandatory for JOINT_LIFE annuity options)',
    type: SecondaryLifeAssuredDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryLifeAssuredDto)
  secondaryLifeAssured?: SecondaryLifeAssuredDto;
}

// 1.8 Group Insurance
export class GroupInsuranceDetailsDto {
  @ApiProperty({ description: 'Name of the corporate/organization entity', example: 'Acme Technologies Pvt Ltd' })
  @IsString()
  @IsNotEmpty()
  corporateName: string;

  @ApiProperty({
    description: 'Group structure relationship',
    enum: ['EMPLOYER_EMPLOYEE', 'NON_EMPLOYER_EMPLOYEE', 'CREDIT_LINKED', 'AFFINITY_GROUP'],
    example: 'EMPLOYER_EMPLOYEE',
  })
  @IsIn(['EMPLOYER_EMPLOYEE', 'NON_EMPLOYER_EMPLOYEE', 'CREDIT_LINKED', 'AFFINITY_GROUP'])
  groupType: string;

  @ApiProperty({ description: 'Total number of lives covered under master policy', example: 250 })
  @IsNumber()
  @Min(10)
  totalMemberCount: number;

  @ApiProperty({ description: 'Sum assured per member in INR', example: 1000000 })
  @IsNumber()
  @Min(50000)
  sumAssuredPerMember: number;

  @ApiPropertyOptional({ description: 'Master group policy reference number if existing' })
  @IsOptional()
  @IsString()
  masterPolicyNumber?: string;
}


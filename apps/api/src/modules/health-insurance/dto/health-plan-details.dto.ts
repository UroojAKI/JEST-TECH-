import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { HealthPlanCategory } from '@prisma/client';

/*
 * "Section A - Member / Plan-Specific Details" for each of the 8 plan categories
 * (Health_Insurance_CRM_Forms, sections 1.1 - 1.8). Fields marked Y in the PDF are required.
 *
 * Fields the PDF lists in Section A that are already captured per insured member
 * (age, pre-existing disease Y/N, smoker Y/N, BMI, number of members & relationship)
 * are derived from the members instead of being entered twice.
 */

export enum HealthIndemnityType {
  INDEMNITY = 'INDEMNITY',
  FIXED_BENEFIT = 'FIXED_BENEFIT',
}

export enum RoomRentCategory {
  SINGLE_PRIVATE_AC = 'SINGLE_PRIVATE_AC',
  TWIN_SHARING = 'TWIN_SHARING',
  NO_CAPPING = 'NO_CAPPING',
}

export enum SeniorMedicalTest {
  ECG = 'ECG',
  BLOOD_SUGAR = 'BLOOD_SUGAR',
  LIPID_PROFILE = 'LIPID_PROFILE',
  RENAL_FUNCTION = 'RENAL_FUNCTION',
}

export enum ChronicIllness {
  NONE = 'NONE',
  DIABETES = 'DIABETES',
  HYPERTENSION = 'HYPERTENSION',
  CARDIAC = 'CARDIAC',
  OTHER = 'OTHER',
}

export enum CriticalIllnessCovered {
  CANCER = 'CANCER',
  HEART_ATTACK = 'HEART_ATTACK',
  STROKE = 'STROKE',
  KIDNEY_FAILURE = 'KIDNEY_FAILURE',
  MAJOR_ORGAN_TRANSPLANT = 'MAJOR_ORGAN_TRANSPLANT',
  OTHER = 'OTHER',
}

export enum DeductibleBasis {
  PER_CLAIM = 'PER_CLAIM', // Top-up
  AGGREGATE_ANNUAL = 'AGGREGATE_ANNUAL', // Super Top-up
}

export enum GroupSchemeType {
  EMPLOYER_EMPLOYEE = 'EMPLOYER_EMPLOYEE',
  AFFINITY_GROUP = 'AFFINITY_GROUP',
  ASSOCIATION = 'ASSOCIATION',
}

export enum GroupSumInsuredBasis {
  FLAT = 'FLAT',
  GRADED = 'GRADED',
}

export enum PaCoverType {
  INDIVIDUAL = 'INDIVIDUAL',
  FAMILY_FLOATER = 'FAMILY_FLOATER',
  GROUP = 'GROUP',
}

export enum OccupationRiskCategory {
  CATEGORY_I = 'CATEGORY_I',
  CATEGORY_II = 'CATEGORY_II',
  CATEGORY_III = 'CATEGORY_III',
  HAZARDOUS = 'HAZARDOUS',
}

export enum MiscPlanType {
  MATERNITY_ADDON = 'MATERNITY_ADDON',
  OPD_COVER = 'OPD_COVER',
  TRAVEL_HEALTH = 'TRAVEL_HEALTH',
  MICRO_INSURANCE = 'MICRO_INSURANCE',
}

export enum CoverageTerritory {
  INDIA = 'INDIA',
  WORLDWIDE_EXCL_US_CANADA = 'WORLDWIDE_EXCL_US_CANADA',
  WORLDWIDE_INCL_US_CANADA = 'WORLDWIDE_INCL_US_CANADA',
}

/** Plan Name & UIN + Sum Insured, shared by most categories. */
class PlanIdentityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  planName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  uin: string;

  @IsNumber()
  @Min(1)
  sumInsured: number;
}

/** 1.1 Individual Health Insurance */
export class IndividualPlanDetailsDto extends PlanIdentityDto {
  @IsEnum(HealthIndemnityType)
  indemnityType: HealthIndemnityType;

  @IsEnum(RoomRentCategory)
  roomRentCategory: RoomRentCategory;

  @IsOptional()
  @IsBoolean()
  existingHealthPolicy?: boolean;
}

/** 1.2 Family Floater */
export class FamilyFloaterPlanDetailsDto extends PlanIdentityDto {
  @IsEnum(RoomRentCategory)
  roomRentCategory: RoomRentCategory;

  @IsOptional()
  @IsBoolean()
  maternityCoverRequired?: boolean;
}

/** 1.3 Senior Citizen */
export class SeniorCitizenPlanDetailsDto extends PlanIdentityDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  coPaymentPercent: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SeniorMedicalTest, { each: true })
  prePolicyMedicalTests: SeniorMedicalTest[];

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ChronicIllness, { each: true })
  existingChronicIllness: ChronicIllness[];
}

/** 1.4 Critical Illness / Cancer Care */
export class CriticalIllnessPlanDetailsDto extends PlanIdentityDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(CriticalIllnessCovered, { each: true })
  illnessesCovered: CriticalIllnessCovered[];

  @IsInt()
  @Min(0)
  @Max(365)
  survivalPeriodDays: number;

  @IsBoolean()
  familyHistoryOfCriticalIllness: boolean;
}

/** 1.5 Top-up / Super Top-up */
export class TopUpPlanDetailsDto extends PlanIdentityDto {
  @IsNumber()
  @Min(1)
  deductibleAmount: number;

  @IsNumber()
  @Min(1)
  basePolicySumInsured: number;

  @IsEnum(DeductibleBasis)
  deductibleBasis: DeductibleBasis;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  existingBaseInsurerName?: string;
}

/** 1.6 Group / Corporate */
export class GroupCorporatePlanDetailsDto {
  @IsEnum(GroupSchemeType)
  schemeType: GroupSchemeType;

  @IsInt()
  @Min(1)
  memberStrength: number;

  @IsEnum(GroupSumInsuredBasis)
  sumInsuredBasis: GroupSumInsuredBasis;

  @IsNumber()
  @Min(1)
  sumInsured: number;

  @ValidateIf((o) => o.sumInsuredBasis === GroupSumInsuredBasis.GRADED)
  @IsObject()
  gradeWiseSumInsured?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  parentalCoverIncluded?: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  masterPolicyholderName: string;

  @IsDateString()
  policyEffectiveDate: string;
}

/** 1.7 Personal Accident */
export class PersonalAccidentPlanDetailsDto extends PlanIdentityDto {
  @IsEnum(PaCoverType)
  coverType: PaCoverType;

  @IsEnum(OccupationRiskCategory)
  occupationRiskCategory: OccupationRiskCategory;

  @IsNumber()
  @Min(0)
  @Max(100)
  permanentTotalDisabilityPercent: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  temporaryTotalDisabilityWeeklyBenefit?: number;
}

/** 1.8 Miscellaneous (Maternity / OPD / Travel Health / Micro-Insurance) */
export class MiscellaneousPlanDetailsDto {
  @IsEnum(MiscPlanType)
  planType: MiscPlanType;

  @IsNumber()
  @Min(1)
  sumInsured: number;

  @ValidateIf((o) => o.planType === MiscPlanType.MATERNITY_ADDON)
  @IsString()
  @IsNotEmpty()
  maternityWaitingPeriod?: string;

  @ValidateIf((o) => o.planType === MiscPlanType.TRAVEL_HEALTH)
  @IsString()
  @IsNotEmpty()
  travelDestination?: string;

  @ValidateIf((o) => o.planType === MiscPlanType.TRAVEL_HEALTH)
  @IsInt()
  @Min(1)
  travelDurationDays?: number;

  @ValidateIf((o) => o.planType === MiscPlanType.TRAVEL_HEALTH)
  @IsEnum(CoverageTerritory)
  coverageTerritory?: CoverageTerritory;
}

export const PLAN_DETAILS_DTO: Record<HealthPlanCategory, new () => object> = {
  INDIVIDUAL: IndividualPlanDetailsDto,
  FAMILY_FLOATER: FamilyFloaterPlanDetailsDto,
  SENIOR_CITIZEN: SeniorCitizenPlanDetailsDto,
  CRITICAL_ILLNESS: CriticalIllnessPlanDetailsDto,
  TOP_UP: TopUpPlanDetailsDto,
  GROUP_CORPORATE: GroupCorporatePlanDetailsDto,
  PERSONAL_ACCIDENT: PersonalAccidentPlanDetailsDto,
  MISCELLANEOUS: MiscellaneousPlanDetailsDto,
};

/*
 * Policy Form (ii) - Renewal / Portability.
 */
export enum RenewalType {
  RENEWAL = 'RENEWAL',
  PORTABILITY = 'PORTABILITY',
}

export enum SumInsuredContinuation {
  CONTINUED = 'CONTINUED',
  ENHANCED = 'ENHANCED',
}

export class RenewalPortabilityDetailsDto {
  @IsEnum(RenewalType)
  renewalType: RenewalType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  previousInsurerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  previousPolicyNumber: string;

  @IsEnum(SumInsuredContinuation)
  sumInsuredContinuation: SumInsuredContinuation;

  @IsNumber()
  @Min(0)
  @Max(100)
  cumulativeBonusPercent: number;

  @IsBoolean()
  claimInExpiringPolicy: boolean;

  /** Required for port-in cases, per IRDAI portability guidelines. */
  @ValidateIf((o) => o.renewalType === RenewalType.PORTABILITY)
  @IsBoolean()
  waitingPeriodCredit?: boolean;

  @IsOptional()
  @IsDateString()
  previousPolicyExpiryDate?: string;
}

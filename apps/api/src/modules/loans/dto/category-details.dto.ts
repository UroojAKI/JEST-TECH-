import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';

export class HomeLoanDetailsDto {
  @IsEnum(['Ready-to-move', 'Under-construction', 'Resale', 'Plot + Construction'])
  propertyType: string;

  @IsString()
  @IsNotEmpty()
  propertyAddress: string;

  @IsNumber()
  @Min(100000)
  propertyValue: number;

  @IsString()
  @IsOptional()
  builderSocietyName?: string;

  @IsString()
  @IsOptional()
  stageOfConstruction?: string;

  @IsEnum(['Purchase', 'Construction', 'Extension', 'Renovation'])
  loanPurpose: string;

  @IsBoolean()
  @IsOptional()
  isCoApplicantRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  hasExistingHomeLoan?: boolean;
}

export class LoanAgainstPropertyDetailsDto {
  @IsEnum(['Residential', 'Commercial', 'Industrial'])
  propertyType: string;

  @IsString()
  @IsNotEmpty()
  propertyAddress: string;

  @IsNumber()
  @Min(100000)
  propertyMarketValue: number;

  @IsEnum(['Sale Deed', 'Gift Deed', 'Inheritance', 'Allotment Letter'])
  propertyOwnershipProof: string;

  @IsEnum(['Business Expansion', 'Working Capital', 'Personal', 'Education', 'Medical'])
  endUseOfLoan: string;

  @IsBoolean()
  hasExistingMortgage: boolean;
}

export class PersonalLoanDetailsDto {
  @IsEnum(['Wedding', 'Travel', 'Medical', 'Debt Consolidation', 'Home Renovation', 'Other'])
  loanPurpose: string;

  @IsEnum(['Salaried', 'Self-Employed Professional', 'Self-Employed Non-Professional'])
  employmentType: string;

  @IsNumber()
  @Min(10000)
  netMonthlyIncome: number;

  @IsNumber()
  @Min(0)
  existingEmiObligations: number;

  @IsEnum(['MNC', 'PSU', 'Government', 'Private', 'SME'])
  @IsOptional()
  employerCategory?: string;

  @IsNumber()
  @Min(0)
  yearsInCurrentJobOrBusiness: number;
}

export class BusinessLoanDetailsDto {
  @IsEnum(['Proprietorship', 'Partnership', 'Pvt Ltd', 'LLP'])
  businessType: string;

  @IsString()
  @IsNotEmpty()
  natureOfBusiness: string;

  @IsNumber()
  @Min(0)
  yearsInBusinessVintage: number;

  @IsNumber()
  @Min(100000)
  annualTurnover: number;

  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid Indian GSTIN format',
  })
  gstRegistrationNumber: string;

  @IsEnum(['Term Loan', 'Cash Credit', 'Overdraft', 'Letter of Credit'])
  facilityTypeRequired: string;

  @IsBoolean()
  @IsOptional()
  isCollateralOffered?: boolean;
}

export class VehicleLoanDetailsDto {
  @IsEnum(['New Car', 'Used Car', 'Two-Wheeler', 'Commercial Vehicle'])
  vehicleType: string;

  @IsString()
  @IsOptional()
  vehicleMakeModel?: string;

  @IsNumber()
  @Min(20000)
  onRoadPriceOrVehicleValue: number;

  @IsString()
  @IsOptional()
  dealerName?: string;

  @IsNumber()
  @Min(0)
  downPaymentAmount: number;
}

export class EducationLoanDetailsDto {
  @IsString()
  @IsNotEmpty()
  courseNameLevel: string; // UG, PG, Diploma, PhD

  @IsString()
  @IsNotEmpty()
  institutionNameCountry: string;

  @IsNumber()
  @Min(0.5)
  courseDurationYears: number;

  @IsNumber()
  @Min(50000)
  totalCourseFee: number;

  @IsString()
  @IsNotEmpty()
  coBorrowerDetails: string;

  @IsBoolean()
  @IsOptional()
  isCollateralRequired?: boolean;
}

export class GoldLoanDetailsDto {
  @IsEnum(['Jewellery', 'Coins', 'Bars'])
  goldOrnamentType: string;

  @IsNumber()
  @Min(0.1)
  grossWeightGrams: number;

  @IsNumber()
  @Min(0.1)
  netWeightGrams: number;

  @IsEnum(['18K', '20K', '22K', '24K'])
  purityKarat: string;

  @IsNumber()
  @Min(1000)
  appraisedValue: number;
}

export class SecuritiesOverdraftDetailsDto {
  @IsEnum(['Shares', 'Mutual Funds', 'Bonds', 'Insurance Policies', 'Fixed Deposit'])
  securityType: string;

  @IsNumber()
  @Min(10000)
  securityMarketOrFaceValue: number;

  @IsString()
  @IsOptional()
  dematAccountNumber?: string;

  @IsEnum(['Overdraft', 'Term Loan'])
  facilityType: string;

  @IsNumber()
  @Min(5000)
  drawingPower: number;
}


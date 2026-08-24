// Motor Insurance CRM — TypeScript Types
// 8 Vehicle Categories × 3 Policy Types

export type VehicleCategory =
  | 'BIKE'
  | 'PRIVATE_CAR'
  | 'GCV'
  | 'TRACTOR'
  | 'AUTO'
  | 'TAXI'
  | 'BUS_COACH'
  | 'MISC_CLASS_D';

export type PolicyType = 'TP_ONLY' | 'SAOD' | 'PACKAGE';

// ------------------------------------------------------------------
// PROPOSER / CUSTOMER DETAILS (common across all motor forms)
// ------------------------------------------------------------------
export interface ProposerDetails {
  proposalDate: string;          // Y — Auto-populated
  leadSource: string;            // Y — Dropdown
  customerName: string;          // N — As per RC / KYC
  mobileNumber: string;          // N — OTP verified
  emailId: string;               // Y
  address: string;               // Y
  panNumber: string;             // Y — KYC mandatory
  relationshipManager: string;   // Y — Auto-mapped to logged-in user
}

// ------------------------------------------------------------------
// VEHICLE-SPECIFIC DETAILS
// ------------------------------------------------------------------
export interface BikeVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // Y — Scooter/Motorcycle/Moped/Electric
  makeModel: string;             // N
  engineCapacity: string;        // N — CC or kW
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineNumber: string;          // N
  chassisNumber: string;         // N
  fuelType: string;              // N — Petrol/Electric
  rtoLocation: string;           // N
  usageType: string;             // Y — Personal/Commercial
}

export interface PrivateCarVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // N — Hatchback/Sedan/SUV/MPV
  makeModelVariant: string;      // N
  engineCapacity: string;        // N
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineNumber: string;          // N
  chassisNumber: string;         // N
  fuelType: string;              // N
  seatingCapacity: string;       // N
  rtoLocation: string;           // N
  hypothecationFinancer: string; // N
}

export interface GCVVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // Y — LCV/MCV/HCV/Trailer/Tanker
  makeModel: string;             // N
  grossVehicleWeight: string;    // Y — kg
  carryingCapacity: string;      // N — Tonnes
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineChassisNumber: string;   // N
  fuelType: string;              // N
  zoneOfOperation: string;       // N
  usageType: string;             // Y
  routePermitType: string;       // N
}

export interface TractorVehicleDetails {
  registrationNumber: string;    // Y
  makeModel: string;             // N
  horsePower: string;            // N
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineChassisNumber: string;   // N
  attachmentUsed: string;        // Y — Trailer1/Trailer2/Harvester/Cultivator/None
  usageType: string;             // Y — Agricultural/Commercial
  rtoLocation: string;           // N
}

export interface AutoVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // Y — Passenger/Goods
  makeModel: string;             // N
  seatLoadCapacity: string;      // Y
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineChassisNumber: string;   // N
  fuelType: string;              // N
  permitType: string;            // N
  rtoLocation: string;           // N
}

export interface TaxiVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // N — Hatchback/Sedan/SUV
  makeModel: string;             // N
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineChassisNumber: string;   // N
  fuelType: string;              // N
  seatingCapacity: string;       // Y
  permitType: string;            // N
  aggregatorAffiliation: string; // N
  rtoLocation: string;           // N
}

export interface BusVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // Y — School Bus/Staff Bus/Stage Carriage/Luxury Coach
  makeModel: string;             // N
  seatingCapacity: string;       // Y
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineChassisNumber: string;   // N
  fuelType: string;              // N
  routePermitType: string;       // N
  schoolBusCompliance: string;   // Conditional
  rtoLocation: string;           // N
}

export interface MiscVehicleDetails {
  registrationNumber: string;    // Y
  vehicleSubType: string;        // Y — Crane/Forklift/Excavator/Dumper/Ambulance/Fire Tender/Other
  makeModel: string;             // N
  manufactureYearMonth: string;  // N
  dateOfRegistration: string;    // N
  engineChassisNumber: string;   // N
  purposeOfUse: string;          // N
  rtoLocation: string;           // N
}

export type VehicleDetails =
  | BikeVehicleDetails
  | PrivateCarVehicleDetails
  | GCVVehicleDetails
  | TractorVehicleDetails
  | AutoVehicleDetails
  | TaxiVehicleDetails
  | BusVehicleDetails
  | MiscVehicleDetails;

// ------------------------------------------------------------------
// POLICY FORMS
// ------------------------------------------------------------------
export interface PolicyFormTPOnly {
  policyType: 'TP_ONLY';
  policyTenure: string;          // Y
  previousTPInsurerName: string; // Conditional
  previousTPPolicyNumber: string;// Conditional
  thirdPartyPremium: string;     // N (non-editable, IRDAI tariff)
  paCoverOwner: boolean;         // Y
  legalLiabilityPaidDriver: string; // Conditional
  totalPremiumInclGST: string;   // Y — auto-calc
  policyStartDate: string;       // N
  policyEndDate: string;         // N
  commissionDiscountCalc: string; // Y — free text employee
}

export type SaodVerificationMethod =
  | 'POLICY_DOCUMENT'
  | 'INSURER_PORTAL'
  | 'INSURER_CONFIRMATION'
  | 'OTHER';

export type SaodVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface SaodTpVerification {
  // Active TP Policy Details (all mandatory for SAOD)
  tpInsurer: string;             // Which company issued the TP policy
  tpPolicyNumber: string;        // TP policy number
  tpStartDate: string;           // ISO date string
  tpExpiryDate: string;          // ISO date string — must be future date

  // Verification Mechanism
  verificationStatus: SaodVerificationStatus;
  verificationMethod: SaodVerificationMethod | '';
  verifierNotes: string;         // Free text — optional but encouraged
  evidenceDocumentUrl: string;   // Upload reference

  // Final confirmation checkbox
  verifiedByUserConfirmed: boolean; // User must explicitly check this
}

export interface PolicyFormSAOD {
  policyType: 'SAOD';

  // Full structured TP verification (not just a checkbox)
  tpVerification: SaodTpVerification;

  // Legacy simple fields (kept for backwards compat — populated from tpVerification)
  activeTPInsurerName: string;   // Synced from tpVerification.tpInsurer
  activeTPPolicyNumberValidity: string; // Legacy combined field

  previousODInsurerName: string; // Conditional
  previousODPolicyNumber: string;// Conditional
  insuredDeclaredValue: string;  // Y
  ncbPercentage: string;         // Y — 0/20/25/35/45/50
  claimInExpiringODPolicy: string; // Y — Y/N
  addonsSelected: string[];      // N
  odPremium: string;             // Y — insurer-specific OD premium
  odPremiumBase: string;         // Auto-calc: IDV × insurer OD rate
  ncbDiscountAmount: string;     // Auto-calc: odPremiumBase × NCB%
  addOnsPremium: string;         // Sum of selected add-on premiums
  gstAmount: string;             // Auto-calc: 18% of net premium
  totalPremiumInclGST: string;   // Auto-calc: locked, system-generated
  policyStartDate: string;       // N — must be within active TP period
  policyEndDate: string;         // N
  odCommissionPercent: string;   // Employee enters insurer commission %
  commissionAmount: string;      // Auto-calc: odPremium × commission%
  commissionDiscountCalc: string; // Y — free text employee notes
}


export interface PolicyFormPackage {
  policyType: 'PACKAGE';
  policyTenure: string;          // N
  insuredDeclaredValue: string;  // Y
  ncbPercentage: string;         // Y
  previousInsurerName: string;   // Conditional
  previousPolicyNumber: string;  // Conditional
  claimInExpiringPolicy: string; // Y — Y/N
  ownDamagePremium: string;      // Y
  thirdPartyPremium: string;     // Y
  paCoverOwner: boolean;         // Y
  addonsSelected: string[];      // N
  totalPremiumInclGST: string;   // Y
  policyStartDate: string;       // N
  policyEndDate: string;         // N
  tpCommissionCalc: string;      // Y — free text employee
  odCommissionCalc: string;      // Y — free text employee
  finalCommissionCalc: string;   // Y — free text employee
}

export type PolicyDetails = PolicyFormTPOnly | PolicyFormSAOD | PolicyFormPackage;

// ------------------------------------------------------------------
// FULL MOTOR QUOTATION FORM
// ------------------------------------------------------------------
export interface MotorQuoteFormData {
  vehicleCategory: VehicleCategory;
  policyType: PolicyType;
  proposerDetails: ProposerDetails;
  vehicleDetails: VehicleDetails;
  policyDetails: PolicyDetails;
  uploadedDocuments: UploadedDoc[];
  quoteUploadFile?: File | null;
  insurerName: string;
}

export interface UploadedDoc {
  docType: string;
  fileName?: string;
  fileKey?: string;
}

// ------------------------------------------------------------------
// SAVED QUOTE CARD (displayed in lead quotations list)
// ------------------------------------------------------------------
export interface SavedMotorQuote {
  id: string;
  quotationCode: string;
  vehicleCategory: VehicleCategory;
  policyType: PolicyType;
  insurerName: string;
  registrationNumber: string;
  totalPremium: number;
  idv?: number;
  ncbPercentage?: number;
  policyStartDate?: string;
  policyEndDate?: string;
  status: string;
  createdAt: string;
  proposerDetails?: ProposerDetails;
  vehicleDetails?: Record<string, any>;
  policyDetails?: Record<string, any>;
  leadId?: string;
}

// ------------------------------------------------------------------
// PREVIOUS POLICY
// ------------------------------------------------------------------
export type PreviousPolicyType = 'COMPREHENSIVE' | 'THIRD_PARTY' | 'SAOD' | 'NOT_AVAILABLE';

export interface PreviousPolicyDetails {
  policyExpiryDate: string;             // 'YYYY-MM-DD'
  expiredMoreThan90Days: boolean;        // auto-computed, shown as readonly
  ownershipTransfer: boolean;
  previousPolicyTransferred?: boolean;   // shown when ownershipTransfer = true
  rcTransferStatus?: boolean;            // shown when ownershipTransfer = true
  newOwnerName?: string;                 // shown when ownershipTransfer = true
  previousPolicyType?: PreviousPolicyType;
  previousInsurerName?: string;
  previousPolicyNumber?: string;
  // SAOD-specific — shown when previousPolicyType = 'SAOD' or when new policy = SAOD
  previousOdInsurerName?: string;
  previousOdPolicyNumber?: string;
  odExpiryDate?: string;
  tpExpiryDate?: string;
  claimInPreviousYear: boolean;
  eligibleNcbPercentage: number;         // 0 | 20 | 25 | 35 | 45 | 50 — before resets
  previousPolicyCopyUrl?: string;
}

// ------------------------------------------------------------------
// RULE ENGINE RESULT — from backend, never computed frontend-side
// ------------------------------------------------------------------
export type NcbResetReason =
  | 'CLAIM_IN_PREVIOUS_YEAR'
  | 'OWNERSHIP_TRANSFER'
  | 'POLICY_EXPIRED_MORE_THAN_90_DAYS'
  | 'ELIGIBLE';

export type InspectionReason =
  | 'POLICY_EXPIRED'
  | 'POLICY_EXPIRED_MORE_THAN_90_DAYS'
  | 'OWNERSHIP_TRANSFER_POLICY_NOT_TRANSFERRED'
  | 'OWNERSHIP_TRANSFER_POLICY_EXPIRED'
  | 'TP_TO_PACKAGE_UPGRADE'
  | 'SAOD_OD_POLICY_EXPIRED';

export interface MotorRuleResult {
  inspectionRequired: boolean;
  inspectionReasons: InspectionReason[];
  ncb: number;                           // BACKEND AUTHORITY — frontend cannot override
  ncbReason: NcbResetReason;
  eligibleNcb: number;
  tpVerificationRequired: boolean;
  policyTransferRequired: boolean;
  saodTpValid: boolean;
  saodTpInvalidReason?: string;
  missingDocuments: string[];
  nextStep: 'QUOTATION' | 'INSPECTION' | 'TP_VERIFICATION';
}

// ------------------------------------------------------------------
// INSPECTION
// ------------------------------------------------------------------
export type InspectionConductedBy =
  | 'JEST_TEAM'
  | 'INSURER_EMPLOYEE'
  | 'CUSTOMER_SELF'
  | 'AGENT'
  | 'INSPECTION_AGENCY';

export type InspectionPhotoType = 'front' | 'back' | 'left' | 'right' | 'windshield' | 'chassis' | 'odometer';

export interface InspectionPhotoSlot {
  type: InspectionPhotoType;
  label: string;
  icon: string;
  required: boolean;
  uploaded: boolean;
  file?: File;
  previewUrl?: string;
}

export interface InspectionDetails {
  conductedByType?: InspectionConductedBy;
  inspectorName?: string;
  inspectorPhone?: string;
  inspectorEmail?: string;
  inspectorCompany?: string;
  inspectorEmployeeId?: string;
  inspectionDate?: string;
  inspectionTime?: string;
  photos: Record<InspectionPhotoType, File | null>;
}

// ------------------------------------------------------------------
// PAYMENT
// ------------------------------------------------------------------
export type PaymentTrackingStatus = 'NOT_DONE' | 'UNDER_PROCESS' | 'PAID';

export interface PaymentRecord {
  status: PaymentTrackingStatus;
  amount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  paidAt?: string;
  notes?: string;
}

// ------------------------------------------------------------------
// MOTOR WORKFLOW STATE (mirrors backend enum)
// ------------------------------------------------------------------
export type MotorWorkflowState =
  | 'LEAD_CREATED'
  | 'CUSTOMER_CAPTURED'
  | 'VEHICLE_CAPTURED'
  | 'PREVIOUS_POLICY_CAPTURED'
  | 'POLICY_TYPE_SELECTED'
  | 'RULES_EVALUATED'
  | 'INSPECTION_REQUIRED'
  | 'INSPECTION_COMPLETED'
  | 'QUOTE_FINALIZED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_UNDER_PROCESS'
  | 'PAYMENT_DONE'
  | 'DOCUMENT_CHECK'
  | 'POLICY_CREATED'
  | 'ACTIVE'
  | 'RENEWAL';

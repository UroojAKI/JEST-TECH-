import { PolicyStatus, PaymentStatus } from '@prisma/client';

export class PolicyMemberResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  dateOfBirth: Date;
}

export class PolicyNomineeResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  percentage: number;
}

export class PolicyRenewalResponseDto {
  id: string;
  renewalNumber: number;
  previousExpiry: Date;
  newExpiry: Date;
  premiumAmount: number;
  createdAt: Date;
}

export class PolicyPaymentResponseDto {
  id: string;
  amount: number;
  paymentDate: Date;
  transactionId: string;
  paymentMethod: string;
  status: PaymentStatus;
}

export class PolicyDocumentResponseDto {
  id: string;
  documentType: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  createdAt: Date;
}

export class PolicyHistoryResponseDto {
  id: string;
  status: string;
  comments: string | null;
  createdById: string | null;
  createdAt: Date;
}

export class PolicyVehicleResponseDto {
  id: string;
  registrationNumber?: string | null;
  makeModel?: string | null;
  manufactureYearMonth?: string | null;
  engineNumber?: string | null;
  chassisNumber?: string | null;
  fuelType?: string | null;
  rtoLocation?: string | null;
  category?: string | null;
}

export class PolicyClaimResponseDto {
  id: string;
  claimNumber: string;
  status: string;
  incidentDate?: Date | null;
  claimAmount?: number;
  approvedAmount?: number | null;
  description?: string | null;
  createdAt?: Date;
}

export class PolicyEndorsementResponseDto {
  id: string;
  endorsementNumber?: string | null;
  type: string;
  status: string;
  reason?: string | null;
  createdAt: Date;
}

export class PolicyResponseDto {
  id: string;
  policyNumber: string;
  status: PolicyStatus;
  quotationId: string;
  contactId: string;
  accountId: string | null;
  premiumAmount: number;
  effectiveDate: Date;
  expiryDate: Date;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Authoritative linked and derived fields
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  quotationCode?: string | null;
  insurerName?: string | null;
  productLine?: string | null;
  policyType?: string | null;
  totalPremium?: number;
  netPremium?: number;
  odPremium?: number;
  tpPremium?: number;
  addonPremium?: number;
  discountAmount?: number;
  ncbPercentage?: number;
  gstAmount?: number;
  netPayable?: number;
  idvValue?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  odStartDate?: Date | null;
  odExpiryDate?: Date | null;
  tpStartDate?: Date | null;
  tpExpiryDate?: Date | null;
  paymentStatus?: string | null;
  paidAmount?: number;
  outstandingBalance?: number;
  renewalExecutive?: string | null;
  claimsCount?: number;

  vehicle?: PolicyVehicleResponseDto | null;
  claims?: PolicyClaimResponseDto[];
  endorsements?: PolicyEndorsementResponseDto[];

  members?: PolicyMemberResponseDto[];
  nominees?: PolicyNomineeResponseDto[];
  renewals?: PolicyRenewalResponseDto[];
  payments?: PolicyPaymentResponseDto[];
  documents?: PolicyDocumentResponseDto[];
  histories?: PolicyHistoryResponseDto[];

  workflowState?: {
    status: string;
    ownerId: string | null;
    ownerName: string | null;
    waitingFor: string;
    nextAction: string;
    blocker: string | null;
    dueAt: Date | null;
    lastTransitionAt: Date;
  };
}

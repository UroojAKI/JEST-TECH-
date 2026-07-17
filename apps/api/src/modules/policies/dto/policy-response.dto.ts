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

  members?: PolicyMemberResponseDto[];
  nominees?: PolicyNomineeResponseDto[];
  renewals?: PolicyRenewalResponseDto[];
  payments?: PolicyPaymentResponseDto[];
  documents?: PolicyDocumentResponseDto[];
  histories?: PolicyHistoryResponseDto[];
}

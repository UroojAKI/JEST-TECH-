import { ClaimStatus, ReserveType } from '@prisma/client';

export class ClaimResponseDto {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  policyId: string;
  contactId: string;
  accountId: string | null;
  incidentDate: Date;
  reportedDate: Date;
  description: string;
  claimAmount: number;
  approvedAmount: number | null;
  surveyorName: string | null;
  surveyorDetails: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;

  documents?: {
    id: string;
    documentType: string;
    fileKey: string;
    fileName: string;
    fileSize: number;
    createdAt: Date;
  }[];

  assessments?: {
    id: string;
    assessorId: string | null;
    assessmentDate: Date;
    findings: string;
    estimatedLoss: number;
    approvedAmount: number;
    status: string;
    createdAt: Date;
  }[];

  payments?: {
    id: string;
    amount: number;
    paymentDate: Date;
    transactionId: string;
    paymentMethod: string;
    status: string;
    recipientDetails: string;
    createdAt: Date;
  }[];

  reserves?: {
    id: string;
    amount: number;
    type: ReserveType;
    comments: string | null;
    createdById: string | null;
    createdAt: Date;
  }[];

  histories?: {
    id: string;
    status: ClaimStatus;
    action: string;
    comments: string | null;
    createdById: string | null;
    createdAt: Date;
  }[];

  communications?: {
    id: string;
    senderId: string | null;
    recipient: string;
    channel: string;
    subject: string | null;
    body: string;
    sentAt: Date;
  }[];
}

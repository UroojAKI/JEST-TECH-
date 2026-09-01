import { QuotationStatus } from '@prisma/client';

export class QuotationVersionResponseDto {
  id: string;
  versionNumber: number;
  sumInsured: number;
  basePremium: number;
  gstAmount: number;
  totalPremium: number;
  discountAmount: number;
  metadata: any;
  createdById: string | null;
  createdAt: Date;
}

export class QuotationAddonResponseDto {
  id: string;
  addonCode: string;
  addonName: string;
  premium: number;
  description: string | null;
}

export class QuotationDiscountResponseDto {
  id: string;
  discountType: string;
  percentage: number | null;
  amount: number;
  description: string | null;
}

export class QuotationHistoryResponseDto {
  id: string;
  status: string;
  comments: string | null;
  createdById: string | null;
  createdAt: Date;
}

export class QuotationDocumentResponseDto {
  id: string;
  documentType: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  createdAt: Date;
}

export class QuotationResponseDto {
  id: string;
  quotationCode: string;
  title: string;
  status: QuotationStatus;
  leadId: string | null;
  contactId: string;
  accountId: string | null;
  insurerName: string;
  productType: string;
  sumInsured: number;
  basePremium: number;
  gstAmount: number;
  totalPremium: number;
  ncbPercentage: number;
  discountAmount: number;
  expiryDate: Date;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Motor-specific workflow fields are intentionally exposed so clients cannot infer state from stale UI metadata.
  vehicleCategory?: string | null;
  policyType?: string | null;
  registrationNumber?: string | null;
  motorMetadata?: any;
  workflowState?:
    | {
        status: string;
        ownerId: string | null;
        ownerName: string | null;
        waitingFor: string;
        nextAction: string;
        blocker: string | null;
        dueAt: Date | null;
        lastTransitionAt: Date;
      }
    | string
    | null;
  issuanceStatus?: string | null;
  calculationSnapshot?: any;

  versions?: QuotationVersionResponseDto[];
  addons?: QuotationAddonResponseDto[];
  discounts?: QuotationDiscountResponseDto[];
  histories?: QuotationHistoryResponseDto[];
  documents?: QuotationDocumentResponseDto[];
}

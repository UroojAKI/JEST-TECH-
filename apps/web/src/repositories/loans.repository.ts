import { apiClient } from '../lib/api-client';

export type LoanCategory =
  | 'HOME_LOAN'
  | 'LAP'
  | 'PERSONAL_LOAN'
  | 'BUSINESS_LOAN'
  | 'VEHICLE_LOAN'
  | 'EDUCATION_LOAN'
  | 'GOLD_LOAN'
  | 'SECURITIES_OD';

export type LoanEnquiryStatus =
  | 'DRAFT'
  | 'DOCUMENTS_PENDING'
  | 'SUBMITTED_FOR_REVIEW'
  | 'UNDERWRITING_IN_PROGRESS'
  | 'OFFERS_RECEIVED'
  | 'OFFER_SELECTED'
  | 'SANCTIONED'
  | 'DISBURSED'
  | 'REJECTED'
  | 'CANCELLED';

export type LoanPartyRole = 'APPLICANT' | 'CO_APPLICANT' | 'GUARANTOR';

export type LoanFacilityType =
  | 'NEW_TERM_LOAN'
  | 'BALANCE_TRANSFER'
  | 'TOP_UP'
  | 'OVERDRAFT_CASH_CREDIT'
  | 'OVERDRAFT'
  | 'DROP_LINE_OD';

export type LenderOfferStatus =
  | 'RECEIVED'
  | 'SHORTLISTED'
  | 'SELECTED'
  | 'REJECTED'
  | 'EXPIRED';

export interface LoanParty {
  id: string;
  loanCaseId: string;
  role: LoanPartyRole;
  name: string;
  relationship?: string | null;
  mobileNumber?: string | null;
  email?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  occupation?: string | null;
  monthlyIncome?: number | null;
  annualIncome?: number | null;
  cibilScore?: number | null;
}

export interface LoanLenderOffer {
  id: string;
  facilityId: string;
  lenderName: string;
  status: LenderOfferStatus;
  offeredAmount: number;
  offeredTenureMonths: number;
  rateOfInterest: number;
  interestRateType?: string;
  emiAmount: number;
  processingFee: number;
  otherCharges?: number | null;
  gstAmount: number;
  totalChargesInclGst: number;
  commissionRatePercentage?: number | null;
  grossCommissionAmount?: number | null;
  customerDiscountAmount?: number | null;
  netCommissionPayable?: number | null;
  sanctionLetterDocId?: string | null;
  sanctionDate?: string | null;
  expiryDate?: string | null;
  remarks?: string | null;
  createdAt: string;
  sanctionLetterDoc?: {
    id: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export interface LoanAddOn {
  id: string;
  facilityId: string;
  creditLifeOpted: boolean;
  creditLifeSumAssured?: number | null;
  creditLifePremium?: number | null;
  assetInsuranceOpted: boolean;
  assetSumAssured?: number | null;
  assetPremium?: number | null;
  gstAmount: number;
  totalPremiumInclGst: number;
  brokerageAmount?: number | null;
  createdAt: string;
}

export interface LoanFacility {
  id: string;
  loanCaseId: string;
  facilityType: LoanFacilityType;
  status?: string;
  requestedAmount: number;
  tenureMonths: number;
  targetRoiPercentage?: number | null;
  interestRateType?: string;
  disbursementMode?: string;
  existingLenderName?: string | null;
  existingLoanAccountNo?: string | null;
  outstandingAmount?: number | null;
  existingRoiPercentage?: number | null;
  topUpAmountRequested?: number | null;
  foreclosureCharges?: number | null;
  selectedOfferId?: string | null;
  selectedOffer?: LoanLenderOffer | null;
  lenderOffers: LoanLenderOffer[];
  addOns: LoanAddOn[];
}

export interface LoanDocument {
  id: string;
  loanCaseId: string;
  companyId: string;
  documentId: string;
  documentType: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  document: {
    id: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export interface LoanApplicationCase {
  id: string;
  caseCode: string;
  companyId: string;
  category: LoanCategory;
  status: LoanEnquiryStatus;
  contactId: string;
  agentId?: string | null;
  leadId?: string | null;
  leadSource?: string | null;
  occupationType: string;
  employerBusinessName: string;
  monthlyIncome: number;
  annualIncome: number;
  existingEmiObligations?: number | null;
  cibilScore?: number | null;
  categoryData?: Record<string, any> | null;
  customerSnapshot?: {
    contactId?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    occupation?: string;
  };
  contact?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    phone: string;
    email?: string | null;
    panNumber?: string | null;
  };
  agent?: {
    id: string;
    agentCode: string;
    user?: {
      firstName: string;
      lastName?: string | null;
    };
  };
  parties: LoanParty[];
  facilities: LoanFacility[];
  documents: LoanDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanCasePayload {
  contactId?: string;
  applicant?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    panNumber?: string;
    aadhaarNumber?: string;
  };
  category: LoanCategory;
  occupationType?: string;
  employerBusinessName?: string;
  monthlyIncome?: number;
  annualIncome?: number;
  existingEmiObligations?: number;
  cibilScore?: number;
  leadId?: string;
  agentId?: string;
  categoryData?: Record<string, any>;
  facility?: {
    facilityType: LoanFacilityType;
    requestedAmount: number;
    tenureMonths: number;
    targetRoiPercentage?: number;
    existingLenderName?: string;
    existingLoanAccountNo?: string;
    outstandingAmount?: number;
    existingRoiPercentage?: number;
    topUpAmountRequested?: number;
  };
  parties?: Array<{
    role: LoanPartyRole;
    name: string;
    relationship?: string;
    mobileNumber?: string;
    email?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    occupation?: string;
    monthlyIncome?: number;
    cibilScore?: number;
  }>;
}

export interface LoanFilterParams {
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IssueLoanSanctionPayload {
  sanctionLetterDocId?: string;
  sanctionDate?: string;
  sanctionedAmount?: number;
  notes?: string;
}

export interface IssueLoanDisbursementPayload {
  loanAccountNumber?: string;
  disbursementDate?: string;
  disbursedAmount?: number;
  utrNumber?: string;
  bankName?: string;
  notes?: string;
}

export const loansRepository = {
  async resolveOrCreateContact(proposer: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    panNumber?: string;
    aadhaarNumber?: string;
  }): Promise<string> {
    const cleanPhone = (proposer.phone || '').replace(/\D/g, '');
    const cleanPan = (proposer.panNumber || '').trim().toUpperCase();

    // 1. Search existing contacts by phone
    if (cleanPhone && cleanPhone.length === 10) {
      try {
        const searchRes = await apiClient.get('/contacts', { params: { search: cleanPhone, limit: 10 } });
        const items = Array.isArray(searchRes.data?.data) ? searchRes.data.data : Array.isArray(searchRes.data) ? searchRes.data : [];
        const match = items.find((c: any) => String(c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (match?.id) return match.id;
      } catch {
        // Fallback
      }
    }

    // 2. Search existing customers by phone
    if (cleanPhone && cleanPhone.length === 10) {
      try {
        const custSearchRes = await apiClient.get('/customers', { params: { search: cleanPhone, limit: 10 } });
        const custItems = Array.isArray(custSearchRes.data?.data) ? custSearchRes.data.data : Array.isArray(custSearchRes.data) ? custSearchRes.data : [];
        const custMatch = custItems.find((c: any) => String(c.mobile || c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (custMatch?.contactId || custMatch?.id) return custMatch.contactId || custMatch.id;
      } catch {
        // Continue
      }
    }

    // 3. Attempt creation, catching 409 Conflict if record exists
    const payload: Record<string, any> = {
      type: 'INDIVIDUAL',
      firstName: proposer.firstName?.trim() || 'Loan',
      lastName: (proposer.lastName || '').trim() || 'Applicant',
    };
    if (cleanPhone && cleanPhone.length === 10) {
      payload.phone = cleanPhone;
    }
    if (proposer.email?.trim() && proposer.email.includes('@')) {
      payload.email = proposer.email.trim();
    }
    if (cleanPan && cleanPan.length === 10) {
      payload.panNumber = cleanPan;
    }

    try {
      const created = await apiClient.post('/contacts', payload);
      const createdId = created.data?.id || (created.data as any)?.data?.id || (created as any)?.id;
      if (createdId) return createdId;
    } catch (err: any) {
      // If 409 Conflict, extract existingContactId directly
      const conflictId = err?.response?.data?.existingContactId || err?.response?.data?.data?.existingContactId;
      if (conflictId) {
        return conflictId;
      }
      // If error, check if contact can be re-fetched
      if (cleanPhone && cleanPhone.length === 10) {
        try {
          const searchRes = await apiClient.get('/contacts', { params: { search: cleanPhone, limit: 10 } });
          const items = Array.isArray(searchRes.data?.data) ? searchRes.data.data : Array.isArray(searchRes.data) ? searchRes.data : [];
          const match = items.find((c: any) => String(c.phone || '').replace(/\D/g, '') === cleanPhone);
          if (match?.id) return match.id;
        } catch {
          // ignore
        }
      }
    }

    // Return empty string to let backend auto-resolve/create contact
    return '';
  },

  async listCases(params?: LoanFilterParams): Promise<{ items: LoanApplicationCase[]; total: number; page: number; limit: number }> {
    const response = await apiClient.get('/loans/cases', { params });
    const data = response.data;
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page: 1, limit: data.length };
    }
    return {
      items: data.items || data.data || [],
      total: data.total || 0,
      page: data.page || 1,
      limit: data.limit || 20,
    };
  },

  async getCaseById(id: string): Promise<LoanApplicationCase> {
    const response = await apiClient.get(`/loans/cases/${id}`);
    return response.data;
  },

  async createCase(data: CreateLoanCasePayload): Promise<LoanApplicationCase> {
    const response = await apiClient.post('/loans/cases', data);
    return response.data;
  },

  async updateCase(id: string, data: Partial<CreateLoanCasePayload>): Promise<LoanApplicationCase> {
    const response = await apiClient.put(`/loans/cases/${id}`, data);
    return response.data;
  },

  async updateStatus(id: string, status: LoanEnquiryStatus, reason?: string): Promise<LoanApplicationCase> {
    const response = await apiClient.patch(`/loans/cases/${id}/status`, { status, reason });
    return response.data;
  },

  async issueSanction(id: string, payload?: IssueLoanSanctionPayload): Promise<LoanApplicationCase> {
    const response = await apiClient.post(`/loans/cases/${id}/sanction`, payload || {});
    return response.data;
  },

  async issueLoan(id: string, payload?: IssueLoanDisbursementPayload): Promise<LoanApplicationCase> {
    const response = await apiClient.post(`/loans/cases/${id}/issue`, payload || {});
    return response.data;
  },

  async disburseLoan(id: string, payload?: IssueLoanDisbursementPayload): Promise<LoanApplicationCase> {
    const response = await apiClient.post(`/loans/cases/${id}/disburse`, payload || {});
    return response.data;
  },

  async submitForReview(id: string): Promise<LoanApplicationCase> {
    const response = await apiClient.post(`/loans/cases/${id}/submit-for-review`);
    return response.data;
  },

  async addParty(caseId: string, party: any): Promise<LoanParty> {
    const response = await apiClient.post(`/loans/cases/${caseId}/parties`, party);
    return response.data;
  },

  async removeParty(caseId: string, partyId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/loans/cases/${caseId}/parties/${partyId}`);
    return response.data;
  },

  async addFacility(caseId: string, facility: any): Promise<LoanFacility> {
    const response = await apiClient.post(`/loans/cases/${caseId}/facilities`, facility);
    return response.data;
  },

  async updateFacility(facilityId: string, data: any): Promise<LoanFacility> {
    const response = await apiClient.put(`/loans/facilities/${facilityId}`, data);
    return response.data;
  },

  async removeFacility(facilityId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/loans/facilities/${facilityId}`);
    return response.data;
  },

  async addLenderOffer(facilityId: string, offer: any): Promise<LoanLenderOffer> {
    const response = await apiClient.post(`/loans/facilities/${facilityId}/offers`, offer);
    return response.data;
  },

  async selectLenderOffer(facilityId: string, offerId: string): Promise<LoanLenderOffer> {
    const response = await apiClient.post(`/loans/facilities/${facilityId}/select-offer`, { offerId });
    return response.data;
  },

  async configureAddOn(facilityId: string, addOn: any): Promise<LoanAddOn> {
    const response = await apiClient.post(`/loans/facilities/${facilityId}/add-ons`, addOn);
    return response.data;
  },

  async attachDocument(caseId: string, payload: { documentId: string; documentType: string }): Promise<LoanDocument> {
    const response = await apiClient.post(`/loans/cases/${caseId}/documents`, payload);
    return response.data;
  },

  async verifyDocument(loanDocId: string, payload: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string }): Promise<LoanDocument> {
    const response = await apiClient.post(`/loans/cases/documents/${loanDocId}/verify`, payload);
    return response.data;
  },

  async uploadSanctionLetter(offerId: string, documentId: string): Promise<LoanLenderOffer> {
    const response = await apiClient.post(`/loans/offers/${offerId}/sanction`, { documentId });
    return response.data;
  },

  calculateEmi(principal: number, annualRate: number, tenureMonths: number): number {
    if (!principal || !annualRate || !tenureMonths || tenureMonths <= 0) return 0;
    const monthlyRate = annualRate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    const emi = (principal * monthlyRate * factor) / (factor - 1);
    return Math.round(emi);
  },
};

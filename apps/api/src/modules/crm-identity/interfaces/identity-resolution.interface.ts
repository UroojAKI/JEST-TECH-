export type IdentityMatchStatus = 'MATCH' | 'NEW' | 'AMBIGUOUS';

export interface IdentityMatch {
  status: IdentityMatchStatus;
  contact?: any;
  customer?: any;
  matchedBy?: 'PHONE' | 'EMAIL' | 'BOTH' | 'CONTACT_ID' | 'CUSTOMER_ID';
  conflictReason?: string;
  normalizedPhone?: string | null;
  normalizedEmail?: string | null;
}

export interface ResolveIdentityParams {
  companyId: string;
  phone?: string | null;
  email?: string | null;
  contactId?: string | null;
  customerId?: string | null;
  firstName?: string;
  lastName?: string;
}

export interface EnsureIdentityParams extends ResolveIdentityParams {
  firstName: string;
  lastName?: string;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  createdById?: string | null;
  primaryAgentId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  isVip?: boolean;
  createCustomerIfMissing?: boolean;
}

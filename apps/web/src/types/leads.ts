import { RoleType } from './index';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'DOCS_RECEIVED'
  | 'QUOTE_PREPARED'
  | 'NEGOTIATION'
  | 'PAYMENT_RECEIVED'
  | 'POLICY_ISSUED'
  | 'LOST';

export type LeadSource =
  | 'WEBSITE'
  | 'WHATSAPP'
  | 'WALK_IN'
  | 'REFERRAL'
  | 'AGENT'
  | 'FACEBOOK'
  | 'GOOGLE'
  | 'EXISTING_CUSTOMER';

export type LeadPriority = 'HOT' | 'WARM' | 'COLD';

export type LeadTag = 'HOT' | 'VIP' | 'CORPORATE' | 'RENEWAL' | 'CROSS_SELL' | 'UPSELL' | 'HIGH_PREMIUM';

export type LostReason =
  | 'PREMIUM_HIGH'
  | 'COMPETITOR_WON'
  | 'NOT_INTERESTED'
  | 'NO_RESPONSE'
  | 'DUPLICATE'
  | 'INVALID_LEAD';

export interface LeadItem {
  id: string;
  leadCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  productInterest: string;
  priority: LeadPriority;
  expectedPremium: number;
  probabilityScore: number;
  assignedToId?: string;
  assignedAgentName?: string;
  branchId?: string;
  tags?: LeadTag[];
  slaStatus: 'ON_TRACK' | 'WARNING' | 'BREACHED';
  slaTimeRemaining: string;
  daysInPipeline: number;
  duplicateWarning?: boolean;
  duplicateLeadId?: string;
  createdAt: string;
}

export interface LeadFilterParams {
  status?: LeadStatus;
  source?: LeadSource;
  priority?: LeadPriority;
  assignedToId?: string;
  view?: 'MY_WORK' | 'TODAY_FOLLOWUPS' | 'OVERDUE' | 'QUOTES_PENDING' | 'LOST';
}

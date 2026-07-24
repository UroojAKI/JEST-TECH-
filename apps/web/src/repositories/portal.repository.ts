import { apiClient } from '../lib/api-client';

export interface AgentDashboardMetrics {
  todaysLeads: number;
  pendingQuotes: number;
  policiesIssued: number;
  renewalsDue: number;
  claimsPending: number;
  commissionEarned: number;
  monthlyTargetAchievementPercent: number;
  leaderboardRank: number;
  branchName: string;
}

export interface AgentCustomer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  city: string;
  activePoliciesCount: number;
  totalGwp: number;
  lastInteraction: string;
}

export interface AgentLead {
  id: string;
  customerName: string;
  mobile: string;
  productLine: string;
  estimatedGwp: number;
  status: 'NEW' | 'CONTACTED' | 'QUOTE_SENT' | 'NEGOTIATION' | 'PAYMENT' | 'ISSUED';
  createdAt: string;
}

export interface AgentQuoteComparison {
  insurerCode: string;
  insurerName: string;
  rating: number;
  idvAmount: number;
  basePremium: number;
  addonsPremium: number;
  netPremium: number;
  gstAmount: number;
  totalPremium: number;
}

export interface AgentPolicy {
  id: string;
  policyNumber: string;
  customerName: string;
  productLine: string;
  insurerName: string;
  totalPremium: number;
  startDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'RENEWAL_DUE';
}

export interface AgentRenewalItem {
  id: string;
  policyNumber: string;
  customerName: string;
  mobile: string;
  productLine: string;
  expiryDate: string;
  daysRemaining: number;
  bucket: '45_DAYS' | '30_DAYS' | '15_DAYS' | '7_DAYS' | 'GRACE';
  previousPremium: number;
  renewalQuoteReady: boolean;
}

export interface AgentCommissionLedger {
  id: string;
  policyNumber: string;
  customerName: string;
  totalPremium: number;
  commissionRate: number;
  earnedAmount: number;
  payoutStatus: 'PENDING' | 'APPROVED' | 'PAID';
  transactionDate: string;
}

export interface BranchTeamMetrics {
  teamName: string;
  branchName: string;
  activeAgentsCount: number;
  monthlyGwpTarget: number;
  monthlyGwpAchieved: number;
  pendingProposalApprovals: number;
  totalClaimsExposure: number;
}

export const portalRepository = {
  async getDashboardMetrics(): Promise<AgentDashboardMetrics> {
    const response = await apiClient.get('/portal/metrics');
    return response.data;
  },

  async getCustomers(search?: string): Promise<AgentCustomer[]> {
    const response = await apiClient.get('/portal/customers', { params: { search } });
    return response.data;
  },

  async getLeads(status?: string): Promise<AgentLead[]> {
    const response = await apiClient.get('/portal/leads', { params: { status } });
    return response.data;
  },

  async createLead(data: Partial<AgentLead>): Promise<AgentLead> {
    const response = await apiClient.post('/portal/leads', data);
    return response.data;
  },

  async getQuoteComparisons(params: { productLine: string; idv: number }): Promise<AgentQuoteComparison[]> {
    const response = await apiClient.post('/portal/quotations/compare', params);
    return response.data;
  },

  async getPolicies(status?: string): Promise<AgentPolicy[]> {
    const response = await apiClient.get('/portal/policies', { params: { status } });
    return response.data;
  },

  async getRenewals(bucket?: string): Promise<AgentRenewalItem[]> {
    const response = await apiClient.get('/portal/renewals', { params: { bucket } });
    return response.data;
  },

  async getCommissions(): Promise<AgentCommissionLedger[]> {
    const response = await apiClient.get('/portal/commissions');
    return response.data;
  },

  async getBranchTeamMetrics(): Promise<BranchTeamMetrics> {
    const response = await apiClient.get('/portal/branch-manager/metrics');
    return response.data;
  },
};

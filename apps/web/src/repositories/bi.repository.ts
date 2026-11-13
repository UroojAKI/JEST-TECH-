import { apiClient } from '../lib/api-client';

export interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number;
}

export interface ConversionMetrics {
  totalLeads: number;
  quotedLeads: number;
  proposalsCreated: number;
  paymentsCompleted: number;
  policiesIssued: number;
  leadToQuoteRate: number;
  quoteToPolicyRate: number;
  quoteToProposalRate: number;
  proposalToPaymentRate: number;
  paymentToPolicyRate: number;
  overallConversionRate: number;
  stageFunnel: { stage: string; count: number; rate: number }[];
  funnelJourney: FunnelStage[];
}

export interface RevenueMetrics {
  totalPremium: number;
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  monthOverMonthGrowth: number;
  byInsurer: { insurerName: string; premium: number }[];
  byMonth: { month: string; premium: number }[];
  byProductType: { productType: string; premium: number; count: number }[];
  quarterlyBreakdown: { quarter: string; premium: number }[];
  insurerMarketShare: { insurerName: string; premium: number; percentage: number }[];
}

export interface RenewalMetrics {
  expiring20: number;
  expiring30: number;
  expiring45: number;
  expiring60: number;
  expiring90: number;
  missed: number;
  conversionRate: number;
  retentionRate: number;
  pipeline: { bucket: string; count: number; premium: number }[];
}

export interface AgentPerformanceItem {
  agentId: string;
  agentName: string;
  agentCode: string;
  email: string;
  phone?: string;
  branchName?: string;
  gwp: number;
  formattedGwp: string;
  policiesIssued: number;
  activePolicies: number;
  lapsedPolicies: number;
  activeVsLapsedRatio: number;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  quotationsCreated: number;
  commissionEarned: number;
  commissionPaid: number;
}

export interface AgentPerformanceAnalytics {
  totalAgents: number;
  activeAgents: number;
  totalGwp: number;
  formattedTotalGwp: string;
  averageConversionRate: number;
  topPerformers: AgentPerformanceItem[];
  allAgents: AgentPerformanceItem[];
}

export interface ActionCentreItem {
  id: string;
  category: 'OVERDUE_TASK' | 'BACK_OFFICE_TASK' | 'PENDING_INSPECTION' | 'PAYMENT_VERIFICATION' | 'COMPLIANCE_BLOCK';
  title: string;
  referenceCode?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo?: string;
  entityType: string;
  entityId: string;
  dueDate?: string;
  daysOverdue?: number;
  createdAt: string;
}

export interface OperationalActionCentre {
  summary: {
    totalActionItems: number;
    overdueTasksCount: number;
    pendingInspectionsCount: number;
    pendingPaymentsCount: number;
    complianceBlocksCount: number;
    backOfficeTasksCount?: number;
  };
  criticalItems: ActionCentreItem[];
  itemsByCategory: {
    overdueTasks: ActionCentreItem[];
    pendingInspections: ActionCentreItem[];
    pendingPayments: ActionCentreItem[];
    complianceBlocks: ActionCentreItem[];
    backOfficeTasks?: ActionCentreItem[];
  };
}

export interface CommissionIntelligence {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  reconciliationRate: number;
  statusBreakdown: {
    accrued: number;
    approved: number;
    realized: number;
    paid: number;
    cancelled: number;
  };
  byAgent: Array<{
    agentId: string;
    agentName: string;
    agentCode: string;
    totalEarned: number;
    totalPaid: number;
    totalPending: number;
    recordsCount: number;
  }>;
  byInsurer: Array<{
    insurerName: string;
    totalCommission: number;
    paidCommission: number;
    pendingCommission: number;
  }>;
}

export const biRepository = {
  async getConversion(): Promise<ConversionMetrics> {
    const res = await apiClient.get('/bi/conversion');
    return res.data;
  },

  async getRevenue(): Promise<RevenueMetrics> {
    const res = await apiClient.get('/bi/revenue');
    return res.data;
  },

  async getRenewal(): Promise<RenewalMetrics> {
    const res = await apiClient.get('/bi/renewal');
    return res.data;
  },

  async getAgentPerformance(): Promise<AgentPerformanceAnalytics> {
    const res = await apiClient.get('/bi/agent-performance');
    return res.data;
  },

  async getOperationalActionCentre(): Promise<OperationalActionCentre> {
    const res = await apiClient.get('/bi/operational-action-centre');
    return res.data;
  },

  async getCommissionIntelligence(): Promise<CommissionIntelligence> {
    const res = await apiClient.get('/bi/commission-intelligence');
    return res.data;
  },

  async exportReport(type: 'agent-performance' | 'commission-intelligence' | 'action-centre' | 'revenue'): Promise<Blob> {
    const res = await apiClient.get(`/bi/export/${type}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

import { apiClient } from '../lib/api-client';

export interface FinanceDashboardMetrics {
  todayCollections: number;
  monthlyGwp: number;
  outstandingPremium: number;
  totalCommissionAccrued: number;
  totalCommissionPaid: number;
  netProfitToday: number;
  payables: number;
  receivables: number;
  cashFlow: number;
  ledgerBalance: number;
  myWorkQueue: {
    pendingVerification: number;
    settlementsPending: number;
    commissionApproval: number;
    reconciliationQueue: number;
  };
}

export interface ReceiptItem {
  id: string;
  receiptNumber: string;
  customerName: string;
  policyNumber: string;
  amount: number;
  paymentMode: string;
  status: 'PENDING' | 'VERIFIED' | 'RECONCILED' | 'FAILED' | 'REFUNDED';
  receivedBy: string;
  date: string;
  txnRef: string;
}

export interface PaymentItem {
  id: string;
  paymentNumber: string;
  payee: string;
  type: 'INSURER_SETTLEMENT' | 'COMMISSION_DISBURSAL' | 'CUSTOMER_REFUND' | 'VENDOR_PAYMENT';
  amount: number;
  mode: string;
  status: 'COMPLETED' | 'PENDING_APPROVAL' | 'FAILED';
  date: string;
}

export interface LedgerEntryItem {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  referenceType: string;
  referenceId: string;
  status: string;
  lines: {
    accountName: string;
    debit: number;
    credit: number;
    accountType: string;
  }[];
}

export interface CommissionItem {
  id: string;
  policyNumber: string;
  customerName: string;
  agentName: string;
  roleTier: string;
  grossPremium: number;
  commissionPercent: number;
  commissionAmount: number;
  status: 'ACCRUED' | 'REALIZED';
  payoutStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  createdAt: string;
}

export interface SettlementItem {
  id: string;
  insurerName: string;
  period: string;
  grossPremiumCollected: number;
  commissionRetained: number;
  netPayable: number;
  status: 'SETTLED' | 'PENDING_SETTLEMENT';
  settledDate: string | null;
}

export interface IncentiveItem {
  id: string;
  employeeName: string;
  role: string;
  type: string;
  targetAmount: number;
  achievedAmount: number;
  incentiveAmount: number;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED';
}

/** Safely normalize any API response to an array */
function toArray<T>(raw: any): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;
  if (raw && Array.isArray(raw.data)) return raw.data;
  if (raw && Array.isArray(raw.results)) return raw.results;
  return [];
}

export const financeRepository = {
  async getDashboardMetrics(): Promise<FinanceDashboardMetrics> {
    const response = await apiClient.get('/finance/dashboard');
    return response.data;
  },

  async getReceipts(status?: string): Promise<ReceiptItem[]> {
    const response = await apiClient.get('/finance/receipts', { params: { status } });
    return toArray<ReceiptItem>(response.data);
  },

  async getPayments(type?: string): Promise<PaymentItem[]> {
    const response = await apiClient.get('/finance/payments', { params: { type } });
    return toArray<PaymentItem>(response.data);
  },

  async getLedgerEntries(): Promise<LedgerEntryItem[]> {
    const response = await apiClient.get('/finance/ledger');
    return toArray<LedgerEntryItem>(response.data);
  },

  async postJournalEntry(data: any): Promise<LedgerEntryItem> {
    const response = await apiClient.post('/finance/ledger/journal', data);
    return response.data;
  },

  async getCommissions(): Promise<CommissionItem[]> {
    const response = await apiClient.get('/finance/commissions');
    return toArray<CommissionItem>(response.data);
  },

  async approveCommission(id: string): Promise<any> {
    const response = await apiClient.post(`/finance/commissions/${id}/approve`);
    return response.data;
  },

  async getSettlements(): Promise<SettlementItem[]> {
    const response = await apiClient.get('/finance/settlements');
    return toArray<SettlementItem>(response.data);
  },

  async getIncentives(): Promise<IncentiveItem[]> {
    const response = await apiClient.get('/finance/incentives');
    return toArray<IncentiveItem>(response.data);
  },

  async getReconciliationQueue(params?: { status?: string; search?: string; page?: number; limit?: number }) {
    const response = await apiClient.get('/finance/reconciliation-queue', { params });
    return response.data;
  },

  async reconcilePayment(id: string, data: { bankReference?: string; bankTransactionDate?: string; notes?: string }) {
    const response = await apiClient.post(`/finance/reconciliation-queue/${id}/reconcile`, data);
    return response.data;
  },

  async flagDiscrepancy(id: string, data: { reason: string; notes?: string }) {
    const response = await apiClient.post(`/finance/reconciliation-queue/${id}/discrepancy`, data);
    return response.data;
  },
};

import { apiClient } from '../lib/api-client';

export interface FinanceDashboardMetrics {
  todayCollections: number;
  monthlyGwp: number;
  outstandingPremium: number;
  totalCommissionAccrued: number;
  totalCommissionPaid: number;
  myWorkQueue: {
    pendingVerification: number;
    settlementsPending: number;
    commissionApproval: number;
    reconciliationQueue: number;
  };
}

export interface ChartOfAccountItem {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

export interface JournalEntryLine {
  accountId: string; // UUID — NOT accountName
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryRequest {
  date: string; // ISO date string
  description: string;
  referenceType?: string;
  lines: JournalEntryLine[];
}

export interface CreateSettlementBatchRequest {
  insurerName: string;
  period: string; // 'YYYY-MM'
  description?: string;
}

export interface SettlementBatchResult {
  id: string;
  batchNumber: string;
  insurerName: string;
  period: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED';
  grossPremiumCollected: number;
  commissionRetained: number;
  netPayable: number;
  policyCount: number;
  createdAt: string;
}

export interface ReceiptItem {
  id: string;
  receiptNumber: string;
  customerName: string;
  policyNumber: string;
  amount: number;
  paymentMode: string;
  status: 'CLEARED' | 'BOUNCED';
  receivedBy: string;
  date: string;
  txnRef: string;
}

export interface OutstandingInvoiceItem {
  id: string;
  invoiceNumber: string;
  policyNumber: string;
  customerName: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  dueDate: string;
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
  policyId?: string;
  policyNumber: string;
  customerName: string;
  agentName: string;
  roleTier: string;
  grossPremium: number;
  commissionPercent: number;
  commissionAmount: number;
  amount: number;
  status: 'ACCRUED' | 'REALIZED' | 'APPROVED' | 'PAID' | 'CANCELLED';
  payoutStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REALIZED';
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
  incentiveAmount: number | null;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'POLICY_PENDING';
  policyStatus?: string;
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

  async getChartOfAccounts(): Promise<ChartOfAccountItem[]> {
    const response = await apiClient.get('/finance/accounts');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getReceipts(status?: string): Promise<ReceiptItem[]> {
    const response = await apiClient.get('/finance/receipts', { params: { status } });
    return toArray<ReceiptItem>(response.data);
  },

  async exportReceipts(): Promise<Blob> {
    const response = await apiClient.get('/finance/receipts/export', {
      responseType: 'blob',
    });
    return response.data;
  },

  async getOutstandingInvoices(): Promise<OutstandingInvoiceItem[]> {
    const response = await apiClient.get('/finance/invoices/outstanding');
    return toArray<OutstandingInvoiceItem>(response.data);
  },

  async recordInvoicePayment(
    invoiceId: string,
    payment: { amount: string; mode: string; reference?: string },
  ) {
    const response = await apiClient.post(
      `/finance/invoices/${invoiceId}/pay`,
      payment,
    );
    return response.data;
  },

  async getPayments(type?: string): Promise<PaymentItem[]> {
    const response = await apiClient.get('/finance/payments', { params: { type } });
    return toArray<PaymentItem>(response.data);
  },

  async getLedgerEntries(params?: { search?: string; referenceType?: string; page?: number; limit?: number }): Promise<any> {
    const response = await apiClient.get('/finance/ledger', { params });
    return response.data;
  },

  async postJournalEntry(data: CreateJournalEntryRequest): Promise<LedgerEntryItem> {
    const response = await apiClient.post('/finance/ledger/journal', data);
    return response.data;
  },

  async getCommissions(): Promise<CommissionItem[]> {
    const response = await apiClient.get('/finance/commissions');
    return toArray<CommissionItem>(response.data);
  },

  async getMyCommissions(): Promise<CommissionItem[]> {
    const response = await apiClient.get('/finance/commissions/me');
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

  async createSettlementBatch(data: CreateSettlementBatchRequest): Promise<SettlementBatchResult> {
    const response = await apiClient.post('/finance/settlements', data);
    return response.data;
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

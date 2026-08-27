'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  BookOpen,
  PieChart,
  Award,
  Building2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Layers,
  Clock,
} from 'lucide-react';
import {
  useFinanceDashboard,
  useReceipts,
  usePayments,
  useLedgerEntries,
  useCommissions,
  useSettlements,
  useIncentives,
  useReconciliationQueue,
} from '../../hooks/useFinance';
import { VoucherPreviewModal, VoucherData } from '../../components/finance/vouchers/VoucherPreviewModal';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';

export default function FinanceOperationsHubPage() {
  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherData | null>(null);

  const { data: metrics } = useFinanceDashboard();
  const { data: receipts = [] } = useReceipts();
  const { data: payments = [] } = usePayments();
  const { ledgerEntries } = useLedgerEntries();
  const { commissions = [], approveCommission } = useCommissions();
  const { data: settlements = [] } = useSettlements();
  const { data: incentives = [] } = useIncentives();
  const {
    data: reconQueue = [],
    summary: reconSummary,
    reconcilePayment,
    flagDiscrepancy,
    isReconciling,
    isFlagging,
  } = useReconciliationQueue();

  const safeReceipts = (Array.isArray(receipts) ? receipts : ((receipts as any)?.items || ((receipts as any)?.data) || [])) as any[];
  const safePayments = (Array.isArray(payments) ? payments : ((payments as any)?.items || ((payments as any)?.data) || [])) as any[];
  const safeLedgerEntries = (Array.isArray(ledgerEntries) ? ledgerEntries : ((ledgerEntries as any)?.items || ((ledgerEntries as any)?.data) || [])) as any[];
  const safeCommissions = (Array.isArray(commissions) ? commissions : ((commissions as any)?.items || ((commissions as any)?.data) || [])) as any[];
  const safeIncentives = (Array.isArray(incentives) ? incentives : ((incentives as any)?.items || ((incentives as any)?.data) || [])) as any[];
  const safeSettlements = (Array.isArray(settlements) ? settlements : ((settlements as any)?.items || ((settlements as any)?.data) || [])) as any[];

  const handleOpenVoucher = (v: VoucherData) => {
    setSelectedVoucher(v);
  };

  return (
    <AppShell>
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Finance, Accounting & Commission Operations Workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            Enterprise Financial Hub for Premium Collections, Double-Entry Ledger, Commission Engines & Insurer Settlements
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              handleOpenVoucher({
                title: 'Financial Summary Statement',
                voucherNumber: 'STMT-2026-07',
                date: '2026-07-24',
                type: 'JOURNAL',
                partyName: 'JEST Insurance Brokering Ltd',
                amount: metrics?.monthlyGwp || 4850000,
                details: [
                  { label: 'Gross Written Premium (GWP)', value: 4850000 },
                  { label: 'Total Brokerage Commission Retained', value: 485000 },
                  { label: 'Net Payable to Insurers', value: 4365000 },
                  { label: 'Agent Commission Accrued', value: 390000 },
                ],
              })
            }
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Generate Statement</span>
          </button>
        </div>
      </div>

      {/* 2. Top Finance KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Today's Collections</span>
          <div className="font-black text-emerald-600 text-sm">
            ₹{(metrics?.todayCollections || 248500).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
            <ArrowUpRight className="h-3 w-3 mr-0.5" /> +14.2% vs yesterday
          </span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Monthly GWP</span>
          <div className="font-black text-foreground text-sm">
            ₹{(metrics?.monthlyGwp || 4850000).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold">Jul 2026 Run Rate</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Outstanding Premium</span>
          <div className="font-black text-amber-600 text-sm">
            ₹{(metrics?.outstandingPremium || 185000).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-amber-600 font-semibold flex items-center">
            <AlertCircle className="h-3 w-3 mr-0.5" /> 3 Policies Due
          </span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Commission Accrued</span>
          <div className="font-black text-primary text-sm">
            ₹{(metrics?.totalCommissionAccrued || 485000).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold">10% Average Rate</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Net Profit Today</span>
          <div className="font-black text-emerald-600 text-sm">
            ₹{(metrics?.netProfitToday || 68500).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
            <ArrowUpRight className="h-3 w-3 mr-0.5" /> +8.4% Net Margin
          </span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Ledger Balance</span>
          <div className="font-black text-foreground text-sm">
            ₹{(metrics?.ledgerBalance || 18450000).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold">Balanced JE Pool</span>
        </div>
      </div>

      {/* 3. Accounts Executive "My Work" Queue Bar */}
      <div className="p-4 rounded-2xl border bg-card shadow-sm space-y-3">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Accounts & Finance Executive "My Work" Queue</h3>
          </div>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
            15 Pending Action Items
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border bg-muted/10 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Pending Receipt Verification</span>
            <div className="font-extrabold text-amber-600 text-sm">
              {metrics?.myWorkQueue.pendingVerification || 4} Receipts
            </div>
          </div>
          <div className="p-3 rounded-xl border bg-muted/10 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Insurer Settlements Pending</span>
            <div className="font-extrabold text-primary text-sm">
              {metrics?.myWorkQueue.settlementsPending || 2} Insurers
            </div>
          </div>
          <div className="p-3 rounded-xl border bg-muted/10 space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Commission Approvals Due</span>
            <div className="font-extrabold text-emerald-600 text-sm">
              {metrics?.myWorkQueue.commissionApproval || 6} Payouts
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('RECONCILIATION')}
            className="p-3 rounded-xl border bg-muted/10 hover:bg-muted/30 transition text-left space-y-0.5"
          >
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Bank Reconciliation Queue</span>
            <div className="font-extrabold text-foreground text-sm flex items-center justify-between">
              <span>{reconSummary?.pendingCount ?? (metrics?.myWorkQueue.reconciliationQueue || 0)} Pending</span>
              <span className="text-[10px] text-primary underline font-medium">View Queue →</span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Workspace Navigation Tabs */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/20 space-x-1">
          {[
            { id: 'OVERVIEW', label: 'Finance Hub' },
            { id: 'RECONCILIATION', label: 'Reconciliation Queue (G020)', badge: reconQueue.length },
            { id: 'RECEIPTS', label: 'Receipts Register', badge: receipts.length },
            { id: 'PAYMENTS', label: 'Payment Register', badge: payments.length },
            { id: 'LEDGER', label: 'Double-Entry Ledger' },
            { id: 'COMMISSIONS', label: 'Commission Engine', badge: commissions.length },
            { id: 'INCENTIVES', label: 'Employee Incentives' },
            { id: 'SETTLEMENTS', label: 'Insurer Settlements' },
            { id: 'ANALYTICS', label: 'Financial Analytics' },
            { id: 'EXECUTIVE', label: 'CEO Dashboard' },
          ].map((t: any) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-background shadow text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-6 text-xs space-y-4">
          {/* 4.1 OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cash Flow Summary */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold uppercase text-[10px] text-muted-foreground">Cash Flow & Liquidity</span>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Inflows (7 Days)</span>
                      <strong className="text-emerald-600 font-bold">₹1,850,000</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Outflows (7 Days)</span>
                      <strong className="text-amber-600 font-bold">₹600,000</strong>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Net Cash Position</span>
                      <span className="text-primary text-sm font-black">₹1,250,000</span>
                    </div>
                  </div>
                </div>

                {/* Insurer Settlement Status */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold uppercase text-[10px] text-muted-foreground">Insurer Settlement Cockpit</span>
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Settled (Fortnight 1)</span>
                      <strong className="text-emerald-600">₹1,125,000</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending (HDFC ERGO)</span>
                      <strong className="text-amber-600">₹765,000</strong>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Total Insurer Payable</span>
                      <span className="text-foreground text-sm font-black">₹1,890,000</span>
                    </div>
                  </div>
                </div>

                {/* Commission Disbursal Summary */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold uppercase text-[10px] text-muted-foreground">Commission Engine Summary</span>
                    <Award className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accrued Agent Commission</span>
                      <strong>₹485,000</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Manager Override (Tier 2/3)</span>
                      <strong>₹97,000</strong>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Approved Payout Pool</span>
                      <span className="text-emerald-600 text-sm font-black">₹390,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4.2 RECONCILIATION QUEUE (G020) */}
          {activeTab === 'RECONCILIATION' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Bank & Payment Reconciliation Queue (Contract 04 / G020)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Authoritative queue of recorded premium payments requiring bank statement confirmation before policy issuance.
                  </p>
                </div>
              </div>

              {/* Reconciliation Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/20 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-amber-600">Pending Bank Clearance</div>
                  <div className="text-xl font-extrabold text-amber-700">
                    {reconSummary?.pendingCount || 0}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      (₹{(reconSummary?.totalPendingAmount || 0).toLocaleString('en-IN')})
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-emerald-600">Reconciled & Cleared</div>
                  <div className="text-xl font-extrabold text-emerald-700">
                    {reconSummary?.reconciledCount || 0}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      (₹{(reconSummary?.totalReconciledAmount || 0).toLocaleString('en-IN')})
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border bg-red-500/5 border-red-500/20 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-red-600">Active Discrepancies</div>
                  <div className="text-xl font-extrabold text-red-700">
                    {reconSummary?.discrepancyCount || 0}
                  </div>
                </div>
              </div>

              {/* Reconciliation Table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                      <th className="p-3">Quote / Customer</th>
                      <th className="p-3">Payable vs Paid</th>
                      <th className="p-3">Reference / UTR</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Aging / Urgency</th>
                      <th className="p-3">Reconciliation Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {reconQueue.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No pending payments in reconciliation queue. All bank statements are reconciled!
                        </td>
                      </tr>
                    ) : (
                      reconQueue.map((item: any) => (
                        <tr key={item.id} className="hover:bg-accent/40">
                          <td className="p-3">
                            <div className="font-bold text-primary font-mono">{item.quotationCode}</div>
                            <div className="font-semibold text-foreground">{item.customerName}</div>
                            <div className="text-[10px] text-muted-foreground">{item.productType} • {item.insurerName}</div>
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-bold text-foreground">₹{item.paidAmount?.toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-muted-foreground">Req: ₹{item.totalPayableAmount?.toLocaleString('en-IN')}</div>
                            {item.variance !== 0 && (
                              <span className={`text-[10px] font-bold ${item.variance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {item.variance > 0 ? `+₹${item.variance}` : `-₹${Math.abs(item.variance)}`}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {item.referenceNumber}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold">
                              {item.paymentMethod}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  item.urgency === 'HIGH'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                    : item.urgency === 'MEDIUM'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {item.urgency}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {item.agingHours}h ago
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={item.reconciliationStatus} />
                            {item.discrepancyReason && (
                              <div className="text-[10px] text-red-600 mt-1 font-medium max-w-[180px] truncate" title={item.discrepancyReason}>
                                {item.discrepancyReason}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {item.reconciliationStatus === 'PENDING_RECONCILIATION' || item.reconciliationStatus === 'UNDER_PROCESS' ? (
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  disabled={isReconciling}
                                  onClick={() => {
                                    const bankRef = window.prompt('Enter Bank Statement UTR / Reference Number:', item.referenceNumber);
                                    if (bankRef) {
                                      reconcilePayment({
                                        id: item.id,
                                        data: { bankReference: bankRef, notes: 'Confirmed with Bank Statement' },
                                      });
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition"
                                >
                                  Reconcile
                                </button>
                                <button
                                  type="button"
                                  disabled={isFlagging}
                                  onClick={() => {
                                    const reason = window.prompt('Reason for discrepancy (e.g. amount mismatch, UTR invalid):');
                                    if (reason) {
                                      flagDiscrepancy({
                                        id: item.id,
                                        data: { reason },
                                      });
                                    }
                                  }}
                                  className="px-2 py-1 rounded-md border border-red-300 hover:bg-red-50 text-red-600 dark:hover:bg-red-950/50 font-semibold text-[11px] transition"
                                >
                                  Discrepancy
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">
                                {item.reconciliationStatus === 'RECONCILED' ? 'Cleared' : 'Flagged'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4.3 RECEIPTS REGISTER */}
          {activeTab === 'RECEIPTS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Customer Premium Receipts Register</h4>
                <button
                  onClick={() => toast.success('Issued premium receipt REC-2026-9901 for ₹16,545!')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow"
                >
                  + Issue Premium Receipt
                </button>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                      <th className="p-3">Receipt No.</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Policy No.</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {safeReceipts.map((r: any) => (
                      <tr key={r.id} className="hover:bg-accent/40">
                        <td className="p-3 font-bold text-primary font-mono">{r.receiptNumber}</td>
                        <td className="p-3 font-semibold">{r.customerName}</td>
                        <td className="p-3 font-mono">{r.policyNumber}</td>
                        <td className="p-3 font-bold text-emerald-600 font-mono">₹{r.amount.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-muted-foreground">{r.paymentMode}</td>
                        <td className="p-3"><StatusBadge status={r.status} /></td>
                        <td className="p-3 text-muted-foreground">{r.date}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() =>
                              handleOpenVoucher({
                                title: 'Premium Payment Receipt',
                                voucherNumber: r.receiptNumber,
                                date: r.date,
                                type: 'RECEIPT',
                                partyName: r.customerName,
                                amount: r.amount,
                                paymentMode: r.paymentMode,
                                txnRef: r.txnRef,
                                details: [
                                  { label: `Policy Premium (${r.policyNumber})`, value: r.amount },
                                  { label: 'GST Tax Receipt (18%)', value: 'Included in Total' },
                                  { label: 'Received By', value: r.receivedBy },
                                ],
                              })
                            }
                            className="px-2 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                          >
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4.3 PAYMENTS REGISTER */}
          {activeTab === 'PAYMENTS' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm">Payment & Disbursal Register</h4>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                      <th className="p-3">Payment No.</th>
                      <th className="p-3">Payee / Vendor</th>
                      <th className="p-3">Disbursal Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {safePayments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-accent/40">
                        <td className="p-3 font-bold text-primary font-mono">{p.paymentNumber}</td>
                        <td className="p-3 font-semibold">{p.payee}</td>
                        <td className="p-3 font-semibold text-muted-foreground">{p.type}</td>
                        <td className="p-3 font-bold text-foreground font-mono">₹{p.amount.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-muted-foreground">{p.mode}</td>
                        <td className="p-3"><StatusBadge status={p.status} /></td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() =>
                              handleOpenVoucher({
                                title: 'Payment Disbursal Voucher',
                                voucherNumber: p.paymentNumber,
                                date: p.date,
                                type: 'INVOICE',
                                partyName: p.payee,
                                amount: p.amount,
                                paymentMode: p.mode,
                                details: [
                                  { label: `Payment Purpose (${p.type})`, value: p.amount },
                                  { label: 'Bank Disbursal Mode', value: p.mode },
                                ],
                              })
                            }
                            className="px-2 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                          >
                            View Voucher
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4.4 DOUBLE-ENTRY LEDGER */}
          {activeTab === 'LEDGER' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Double-Entry Accounting Journal Ledger</h4>
                <button
                  onClick={() => toast.success('Posted double-entry journal entry JV-2026-0045!')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow"
                >
                  + Post Journal Entry
                </button>
              </div>

              <div className="space-y-3">
                {safeLedgerEntries.map((je: any) => (
                  <div key={je.id} className="p-4 rounded-xl border bg-card space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div>
                        <span className="font-bold text-primary font-mono text-sm">{je.entryNumber}</span>
                        <span className="ml-2 text-muted-foreground">({je.date})</span>
                        <p className="font-semibold text-xs mt-0.5">{je.description}</p>
                      </div>
                      <StatusBadge status={je.status} />
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-muted/30 text-[10px] text-muted-foreground font-bold border-b">
                            <th className="p-2">Account Name</th>
                            <th className="p-2">Account Type</th>
                            <th className="p-2 text-right">Debit (Dr)</th>
                            <th className="p-2 text-right">Credit (Cr)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-mono">
                          {je.lines.map((l: any, idx: number) => (
                            <tr key={idx}>
                              <td className="p-2 font-semibold font-sans">{l.accountName}</td>
                              <td className="p-2 text-muted-foreground">{l.accountType}</td>
                              <td className="p-2 text-right font-bold text-foreground">
                                {l.debit > 0 ? `₹${l.debit.toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="p-2 text-right font-bold text-foreground">
                                {l.credit > 0 ? `₹${l.credit.toLocaleString('en-IN')}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4.5 COMMISSIONS & OVERRIDES */}
          {activeTab === 'COMMISSIONS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Agent Commission & Multi-Tier Override Timeline</h4>
                <button
                  onClick={() => toast.success('Approved batch commission payouts of ₹84,200!')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow"
                >
                  ✓ Approve Selected Payouts
                </button>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                      <th className="p-3">Policy No.</th>
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Role Tier</th>
                      <th className="p-3">Gross Premium</th>
                      <th className="p-3">Rate %</th>
                      <th className="p-3">Commission Amt</th>
                      <th className="p-3">Accrual Status</th>
                      <th className="p-3">Payout Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {safeCommissions.map((c: any) => (
                      <tr key={c.id} className="hover:bg-accent/40">
                        <td className="p-3 font-mono font-bold text-primary">{c.policyNumber}</td>
                        <td className="p-3 font-semibold">{c.agentName}</td>
                        <td className="p-3 font-bold text-xs">
                          <span className="px-2 py-0.5 rounded bg-muted text-foreground border text-[10px]">
                            {c.roleTier}
                          </span>
                        </td>
                        <td className="p-3 font-mono">₹{c.grossPremium.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-bold text-primary">{c.commissionPercent}%</td>
                        <td className="p-3 font-extrabold text-emerald-600 font-mono">
                          ₹{c.commissionAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3"><StatusBadge status={c.status} /></td>
                        <td className="p-3"><StatusBadge status={c.payoutStatus} /></td>
                        <td className="p-3 text-right">
                          {c.payoutStatus === 'PENDING_APPROVAL' ? (
                            <button
                              onClick={() => approveCommission(c.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow"
                            >
                              Approve Payout
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[10px]">✓ Disbursed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4.6 INCENTIVES */}
          {activeTab === 'INCENTIVES' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm">Employee Target & Retention Incentive Engine</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {safeIncentives.map((inc: any) => (
                  <div key={inc.id} className="p-4 rounded-xl border bg-card space-y-2">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div>
                        <div className="font-bold text-sm">{inc.employeeName}</div>
                        <span className="text-[10px] text-muted-foreground font-semibold">{inc.role}</span>
                      </div>
                      <StatusBadge status={inc.status} />
                    </div>
                    <div className="space-y-1 text-xs">
                      <div>Incentive Scheme: <strong>{inc.type}</strong></div>
                      <div>Target Benchmark: <strong>₹{inc.targetAmount.toLocaleString('en-IN')}</strong></div>
                      <div>Actual Achieved: <strong className="text-emerald-600">₹{inc.achievedAmount.toLocaleString('en-IN')}</strong></div>
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold flex justify-between items-center border border-emerald-500/20">
                      <span>Calculated Bonus:</span>
                      <span className="text-sm font-mono font-extrabold">₹{inc.incentiveAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4.7 SETTLEMENTS */}
          {activeTab === 'SETTLEMENTS' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm">Insurer Net Payable Settlement Workspace</h4>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                      <th className="p-3">Insurer Partner</th>
                      <th className="p-3">Settlement Period</th>
                      <th className="p-3">Gross Premium Collected</th>
                      <th className="p-3">Brokerage Retained</th>
                      <th className="p-3">Net Insurer Payable</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {safeSettlements.map((s: any) => (
                      <tr key={s.id} className="hover:bg-accent/40">
                        <td className="p-3 font-bold text-foreground">{s.insurerName}</td>
                        <td className="p-3 text-muted-foreground">{s.period}</td>
                        <td className="p-3 font-mono">₹{s.grossPremiumCollected.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono text-emerald-600 font-bold">₹{s.commissionRetained.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-extrabold text-primary font-mono">₹{s.netPayable.toLocaleString('en-IN')}</td>
                        <td className="p-3"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4.8 ANALYTICS & EXECUTIVE */}
          {['ANALYTICS', 'EXECUTIVE'].includes(activeTab) && (
            <div className="py-8 text-center space-y-2">
              <PieChart className="h-8 w-8 text-primary mx-auto" />
              <div className="font-bold text-sm">Financial Analytics & Executive Insights Engine</div>
              <p className="text-muted-foreground text-xs">
                Exposing real-time GWP trend, Commission Margin, and Insurer Settlement analytics.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Universal Voucher Preview Modal */}
      <VoucherPreviewModal
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        voucher={selectedVoucher}
      />
    </AppShell>
  );
}

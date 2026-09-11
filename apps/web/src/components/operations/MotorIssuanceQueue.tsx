'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Clock,
  UserCheck,
  Car,
  FileCheck2,
  CreditCard,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Search,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { policiesRepository } from '../../repositories/policies.repository';
import { quotationsRepository } from '../../repositories/quotations.repository';
import { UpdatePolicyDetailsDialog } from '../leads/motor-quote/UpdatePolicyDetailsDialog';

export interface GateStatus {
  passed: boolean;
  status: string;
  detail: string;
}

export interface BackOfficeQueueItem {
  id: string;
  quotationCode: string;
  status: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  salesAgentName: string;
  productType: string;
  insurerName: string;
  totalPremium: number;
  paymentAmount: number;
  paymentReference?: string;
  createdAt: string;
  slaRemainingHours: number;
  slaStatus: 'CRITICAL' | 'WARNING' | 'ON_TRACK';
  gates: {
    customer: GateStatus;
    vehicle: GateStatus;
    inspection: GateStatus;
    payment: GateStatus;
    documents: GateStatus;
  };
  allGatesPassed: boolean;
  nextAction: string;
}

export function MotorIssuanceQueue() {
  const [queue, setQueue] = useState<BackOfficeQueueItem[]>([]);
  const [summary, setSummary] = useState<{
    totalPending: number;
    readyCount: number;
    blockedCount: number;
    issuedCount: number;
  }>({ totalPending: 0, readyCount: 0, blockedCount: 0, issuedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  // Underwriter action modal state
  const [underwriterAction, setUnderwriterAction] = useState<{
    type: 'APPROVE' | 'REJECT';
    quotationId: string;
    quotationCode: string;
  } | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const loadQueue = async (statusOverride?: string) => {
    setLoading(true);
    try {
      const activeStatus = statusOverride !== undefined ? statusOverride : statusFilter;
      const res = await policiesRepository.getBackOfficeQueue({
        search: search.trim() || undefined,
        status: activeStatus === 'ALL' ? undefined : activeStatus,
      });
      setQueue(res.data || []);
      if (res.summary) setSummary(res.summary);
    } catch (error: any) {
      console.error(error);
      toast.error('Unable to load Back-Office policy issuance queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [statusFilter]);

  const handleDirectIssue = async (quotationId: string) => {
    setIssuingId(quotationId);
    try {
      const res = await policiesRepository.issueFromQueue(quotationId);
      toast.success(res.message || 'Policy issued successfully!');
      await loadQueue();
    } catch (error: any) {
      const errMsg =
        error.response?.data?.message ||
        error.message ||
        'Failed to issue policy';
      toast.error(errMsg);
    } finally {
      setIssuingId(null);
    }
  };

  const handleUnderwriterSubmit = async () => {
    if (!underwriterAction) return;
    if (!actionComments.trim()) {
      toast.error('Please provide review comments or reason.');
      return;
    }

    setActionSubmitting(true);
    try {
      if (underwriterAction.type === 'APPROVE') {
        await quotationsRepository.approveQuotation(underwriterAction.quotationId, actionComments.trim());
        toast.success(`Quotation ${underwriterAction.quotationCode} approved successfully!`);
      } else {
        await quotationsRepository.rejectQuotation(underwriterAction.quotationId, actionComments.trim());
        toast.info(`Quotation ${underwriterAction.quotationCode} marked as rejected.`);
      }
      setUnderwriterAction(null);
      setActionComments('');
      await loadQueue();
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Action failed';
      toast.error(errMsg);
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Back-Office Operations & Underwriter Workbench</h1>
          <p className="text-xs text-muted-foreground">
            Multi-gate issuance validator enforcing Customer KYC, Vehicle Specs, Inspection & Payment Clearance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadQueue()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold shadow-xs transition"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('READY')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'READY'
              ? 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/30'
              : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-emerald-600">Ready to Issue (100% Gates)</div>
          <div className="text-2xl font-black text-emerald-700">{summary.readyCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('BLOCKED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'BLOCKED'
              ? 'ring-2 ring-amber-500 bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-amber-600">Blocked by Stage Gates</div>
          <div className="text-2xl font-black text-amber-700">{summary.blockedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('INSPECTION_REQUIRED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'INSPECTION_REQUIRED'
              ? 'ring-2 ring-purple-500 bg-purple-500/10 border-purple-500/30'
              : 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-purple-600">Inspection Required</div>
          <div className="text-2xl font-black text-purple-700">
            {queue.filter((q) => q.status === 'INSPECTION_REQUIRED' || !q.gates.inspection.passed).length}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'ALL'
              ? 'ring-2 ring-primary bg-primary/10 border-primary/30'
              : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-primary">Total In Queue</div>
          <div className="text-2xl font-black text-primary">{queue.length}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Cases' },
            { id: 'READY', label: 'Ready to Issue' },
            { id: 'BLOCKED', label: 'Blocked' },
            { id: 'SUBMITTED,UNDER_REVIEW', label: 'Pending Review' },
            { id: 'INSPECTION_REQUIRED', label: 'Inspection Required' },
            { id: 'APPROVED', label: 'Approved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                  : 'bg-card text-muted-foreground hover:bg-accent border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search code, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void loadQueue()}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Queue Listing */}
      {queue.length === 0 && !loading ? (
        <div className="rounded-xl border bg-card p-10 text-center space-y-2">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-bold text-base">Back-Office Issuance Queue is Empty</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All customer quotations in this category have been processed or are awaiting preliminary stages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-card p-4 transition-all shadow-xs ${
                item.allGatesPassed ? 'border-emerald-500/40 bg-emerald-500/[0.02]' : 'border-border'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Primary Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-foreground font-mono">{item.quotationCode}</span>
                    <span className="text-xs font-semibold text-muted-foreground">• {item.customerName}</span>
                    
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      item.status === 'APPROVED' || item.status === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.status === 'INSPECTION_REQUIRED'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : item.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>

                    {item.allGatesPassed ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        ALL GATES READY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        GATES BLOCKED
                      </span>
                    )}

                    {/* SLA Badge */}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.slaStatus === 'CRITICAL'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : item.slaStatus === 'WARNING'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      SLA: {item.slaRemainingHours}h Left
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>Product: <strong>{item.productType}</strong></span>
                    <span>Insurer: <strong>{item.insurerName}</strong></span>
                    <span>Agent: <strong>{item.salesAgentName}</strong></span>
                    <span>Premium: <strong className="text-foreground font-mono">₹{Number(item.totalPremium || 0).toLocaleString('en-IN')}</strong></span>
                  </div>

                  {/* Multi-Gate Checklist Chips */}
                  <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
                    {/* Customer Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.customer.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}
                      title={item.gates.customer.detail}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Customer KYC: {item.gates.customer.status}</span>
                    </div>

                    {/* Vehicle Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.vehicle.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}
                      title={item.gates.vehicle.detail}
                    >
                      <Car className="h-3.5 w-3.5" />
                      <span>Vehicle Specs: {item.gates.vehicle.status}</span>
                    </div>

                    {/* Inspection Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.inspection.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      }`}
                      title={item.gates.inspection.detail}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Inspection: {item.gates.inspection.status}</span>
                    </div>

                    {/* Payment Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.payment.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}
                      title={item.gates.payment.detail}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Payment: {item.gates.payment.status}</span>
                    </div>

                    {/* Documents Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.documents.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      }`}
                      title={item.gates.documents.detail}
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      <span>Docs (G017): {item.gates.documents.status}</span>
                    </div>
                  </div>

                  {/* Next Action Recommendation */}
                  <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Next Action:</span>
                    <span>{item.nextAction}</span>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex flex-row lg:flex-col items-end gap-2 shrink-0">
                  {/* Underwriter Approval Controls (when pending review or inspection required) */}
                  {item.status !== 'APPROVED' && item.status !== 'ACCEPTED' && item.status !== 'REJECTED' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUnderwriterAction({
                            type: 'APPROVE',
                            quotationId: item.id,
                            quotationCode: item.quotationCode,
                          });
                          setActionComments('Approved upon underwriting review.');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUnderwriterAction({
                            type: 'REJECT',
                            quotationId: item.id,
                            quotationCode: item.quotationCode,
                          });
                          setActionComments('Declined due to risk guidelines.');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <ThumbsDown className="h-3 w-3" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {/* Inspection Link */}
                  {!item.gates.inspection.passed && (
                    <Link
                      href="/workspace/operations?tab=inspections"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Inspect Vehicle</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}

                  {/* 1-Click Issuance (when all gates pass and status is approved/accepted) */}
                  {item.allGatesPassed && (item.status === 'APPROVED' || item.status === 'ACCEPTED') && (
                    <button
                      type="button"
                      disabled={issuingId === item.id}
                      onClick={() => handleDirectIssue(item.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                    >
                      {issuingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>1-Click Issue Policy</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedQuote(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold transition"
                  >
                    <span>Manual Policy Entry</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Underwriter Review Modal */}
      {underwriterAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card text-card-foreground border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black">
                {underwriterAction.type === 'APPROVE' ? 'Underwriter Quotation Approval' : 'Underwriter Quotation Rejection'}
              </h3>
              <span className="font-mono text-xs font-bold text-muted-foreground">
                #{underwriterAction.quotationCode}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">
                {underwriterAction.type === 'APPROVE' ? 'Approval Comments / Conditions:' : 'Rejection Reason / Justification:'}
              </label>
              <textarea
                rows={3}
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder={underwriterAction.type === 'APPROVE' ? 'e.g. Approved with standard terms.' : 'e.g. Disapproved due to vehicle age / break-in risk.'}
                className="w-full p-2.5 rounded-xl border bg-background text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setUnderwriterAction(null)}
                disabled={actionSubmitting}
                className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnderwriterSubmit}
                disabled={actionSubmitting}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 ${
                  underwriterAction.type === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Confirm {underwriterAction.type === 'APPROVE' ? 'Approval' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedQuote && (
        <UpdatePolicyDetailsDialog
          isOpen={Boolean(selectedQuote)}
          quotationId={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onSaved={() => {
            setSelectedQuote(null);
            toast.success('Policy issued successfully');
            void loadQueue();
          }}
        />
      )}
    </div>
  );
}

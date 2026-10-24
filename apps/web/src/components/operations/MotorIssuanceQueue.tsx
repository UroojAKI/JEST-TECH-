'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  HeartPulse,
  Columns3,
  Table as TableIcon,
  LayoutGrid,
  Phone,
  Mail,
  User,
  Check,
  ArrowRight,
  Sparkles,
  Layers,
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
  const [productFilter, setProductFilter] = useState<'ALL' | 'MOTOR' | 'HEALTH'>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<{ id: string; productType: 'MOTOR' | 'HEALTH' } | null>(null);

  // Underwriter action modal state
  const [underwriterAction, setUnderwriterAction] = useState<{
    type: 'APPROVE' | 'REJECT';
    quotationId: string;
    quotationCode: string;
    productType: string;
  } | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadQueue = async (statusOverride?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const activeStatus = statusOverride !== undefined ? statusOverride : statusFilter;
      const res = await policiesRepository.getBackOfficeQueue({
        search: search.trim() || undefined,
        status: activeStatus === 'ALL' ? undefined : activeStatus,
      });
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setQueue(items);
      if (res?.summary) setSummary(res.summary);
    } catch (error: any) {
      console.error('Failed to load queue:', error);
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load Back-Office policy issuance queue';
      setLoadError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [statusFilter]);

  // Client-side search & partitioning
  const filteredQueue = useMemo(() => {
    if (!search.trim()) return queue;
    const term = search.toLowerCase().trim();
    return queue.filter((item) => {
      return (
        item.quotationCode.toLowerCase().includes(term) ||
        item.customerName.toLowerCase().includes(term) ||
        (item.customerPhone || '').toLowerCase().includes(term) ||
        (item.customerEmail || '').toLowerCase().includes(term) ||
        item.salesAgentName.toLowerCase().includes(term) ||
        item.insurerName.toLowerCase().includes(term) ||
        (item.gates.vehicle.detail || '').toLowerCase().includes(term)
      );
    });
  }, [queue, search]);

  const motorQueue = useMemo(
    () => filteredQueue.filter((item) => item.productType !== 'HEALTH'),
    [filteredQueue],
  );

  const healthQueue = useMemo(
    () => filteredQueue.filter((item) => item.productType === 'HEALTH'),
    [filteredQueue],
  );

  const displayedQueue = useMemo(() => {
    if (productFilter === 'MOTOR') return motorQueue;
    if (productFilter === 'HEALTH') return healthQueue;
    return filteredQueue;
  }, [productFilter, motorQueue, healthQueue, filteredQueue]);

  const handleDirectIssue = async (quotationId: string, item?: BackOfficeQueueItem) => {
    if (item) {
      const isApproved = item.status === 'APPROVED' || item.status === 'ACCEPTED';
      const isHealth = item.productType === 'HEALTH';
      const gatesOk = Boolean(
        item.allGatesPassed &&
        item.gates?.customer?.passed &&
        item.gates?.payment?.passed &&
        item.gates?.documents?.passed &&
        (isHealth ? true : item.gates?.vehicle?.passed && item.gates?.inspection?.passed)
      );
      if (!isApproved || !gatesOk) {
        toast.error(
          !isApproved
            ? `Quotation must be approved before issuance (currently ${item.status}).`
            : `Policy issuance blocked: ${item.nextAction || 'All required compliance & payment gates must be cleared.'}`
        );
        return;
      }
    }

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

  /**
   * Card Component for a single case item
   */
  const renderCaseCard = (item: BackOfficeQueueItem, domain: 'MOTOR' | 'HEALTH') => {
    const isHealth = domain === 'HEALTH';
    const isApprovedOrAccepted = item.status === 'APPROVED' || item.status === 'ACCEPTED';
    const allGatesCleared = Boolean(
      item.allGatesPassed &&
      item.gates?.customer?.passed &&
      item.gates?.payment?.passed &&
      item.gates?.documents?.passed &&
      (isHealth ? true : item.gates?.vehicle?.passed && item.gates?.inspection?.passed)
    );
    const canIssue = Boolean(isApprovedOrAccepted && allGatesCleared);

    return (
      <div
        key={item.id}
        className="rounded-xl border border-border bg-card p-4 transition-all shadow-xs space-y-3"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wide border shadow-2xs ${
                  isHealth
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                    : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                }`}
              >
                {isHealth ? 'Health Insurance' : 'Motor Insurance'}
              </span>
              <span className="font-mono text-xs font-bold text-foreground">#{item.quotationCode}</span>

              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${item.status === 'APPROVED' || item.status === 'ACCEPTED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : item.status === 'INSPECTION_REQUIRED'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      : item.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
              >
                {item.status.replace('_', ' ')}
              </span>

              {/* Gates Passed Badge */}
              {item.allGatesPassed ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ALL GATES READY
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  GATES BLOCKED
                </span>
              )}
            </div>

            {/* Customer Details */}
            <div className="flex items-center gap-2 text-xs text-foreground font-semibold">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{item.customerName}</span>
              {item.customerPhone && (
                <span className="text-muted-foreground text-[11px] font-normal flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {item.customerPhone}
                </span>
              )}
            </div>
          </div>

          {/* Right Corner: Centered Symbol + SLA Badge */}
          <div className="shrink-0 flex flex-col items-center justify-center gap-1.5 self-center">
            {isHealth ? (
              <span
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs"
                title="Health Insurance Policy"
              >
                <HeartPulse className="h-4 w-4 text-rose-500" />
                <span>Health</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs"
                title="Motor Insurance Policy"
              >
                <Car className="h-4 w-4 text-blue-500" />
                <span>Motor</span>
              </span>
            )}

            <span
              className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.slaStatus === 'CRITICAL'
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
        </div>

        {/* Commercial Metadata */}
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap bg-muted/30 p-2 rounded-lg">
          <span>Insurer: <strong className="text-foreground">{item.insurerName}</strong></span>
          <span>Agent: <strong className="text-foreground">{item.salesAgentName}</strong></span>
          <span>
            Premium:{' '}
            <strong className="text-foreground font-mono font-bold">
              ₹{Number(item.totalPremium || 0).toLocaleString('en-IN')}
            </strong>
          </span>
          {item.paymentReference && (
            <span className="text-[11px] font-mono">Ref: {item.paymentReference}</span>
          )}
        </div>

        {/* Domain-Specific Underwriting & Compliance Gates */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            {isHealth ? '❤️ Health Verification Gates' : '🚗 Motor Verification Gates'}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {/* Customer KYC Gate */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${item.gates.customer.passed
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                }`}
              title={item.gates.customer.detail}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>KYC: {item.gates.customer.status}</span>
            </div>

            {/* Vehicle Gate vs Health Plan Gate */}
            {isHealth ? (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                title="Comprehensive health plan coverage verified"
              >
                <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                <span>Health Plan: READY</span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${item.gates.vehicle.passed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  }`}
                title={item.gates.vehicle.detail}
              >
                <Car className="h-3.5 w-3.5" />
                <span>Vehicle: {item.gates.vehicle.status}</span>
              </div>
            )}

            {/* Inspection Gate vs Health Underwriting Gate */}
            {isHealth ? (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                title="Medical checkup waived / pre-underwriting passed"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>UW Review: EXEMPT</span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${item.gates.inspection.passed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                title={item.gates.inspection.detail}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Inspection: {item.gates.inspection.status}</span>
              </div>
            )}

            {/* Payment Gate */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${item.gates.payment.passed
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
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] ${item.gates.documents.passed
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              title={item.gates.documents.detail}
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Docs (G017): {item.gates.documents.status}</span>
            </div>
          </div>

          {/* Details string */}
          {!isHealth && item.gates.vehicle.detail && (
            <div className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Specs:</span> {item.gates.vehicle.detail}
            </div>
          )}
        </div>

        {/* Next Action Recommendation */}
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/50">
          <span className="font-semibold text-foreground">Next Action:</span>
          <span className="truncate">{item.nextAction}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            {/* Underwriter Approval Controls */}
            {!isApprovedOrAccepted && item.status !== 'REJECTED' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setUnderwriterAction({
                      type: 'APPROVE',
                      quotationId: item.id,
                      quotationCode: item.quotationCode,
                      productType: item.productType,
                    });
                    setActionComments('Approved upon underwriting review.');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs"
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
                      productType: item.productType,
                    });
                    setActionComments('Declined due to risk guidelines.');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition shadow-xs"
                >
                  <ThumbsDown className="h-3 w-3" />
                  <span>Reject</span>
                </button>
              </>
            )}

            {/* Inspection Link for Motor */}
            {!isHealth && !item.gates.inspection.passed && (
              <Link
                href={`/workspace/operations/inspections/${item.id}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[11px] font-bold hover:bg-purple-500/20 transition"
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Inspect</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedQuote({ id: item.id, productType: isHealth ? 'HEALTH' : 'MOTOR' })}
              className="px-2.5 py-1 rounded-md border bg-card hover:bg-accent text-[11px] font-medium transition"
              title={isHealth ? 'Manual Health policy number & date entry' : 'Manual Motor policy number & date entry'}
            >
              Manual Entry
            </button>

            <button
              type="button"
              disabled={issuingId === item.id || !canIssue}
              title={
                !allGatesCleared
                  ? `Blocked: ${item.nextAction || 'All compliance & payment gates must be cleared'}`
                  : !isApprovedOrAccepted
                    ? `Quotation must be approved before issuance (currently ${item.status})`
                    : isHealth
                      ? 'Issue official Health Policy'
                      : 'Issue official Motor Policy'
              }
              onClick={() => handleDirectIssue(item.id, item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition ${
                canIssue
                  ? isHealth
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-muted/80 text-muted-foreground border border-border/80 cursor-not-allowed opacity-60'
              }`}
            >
              {issuingId === item.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isHealth ? (
                <HeartPulse className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>
                {issuingId === item.id
                  ? 'Issuing...'
                  : canIssue
                    ? isHealth
                      ? 'Issue Health Policy'
                      : 'Issue Motor Policy'
                    : isHealth
                      ? 'Issue Health (Gates Pending)'
                      : 'Issue Motor (Gates Pending)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Policy Issuance Queue</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
              Multi-Product Back Office
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Authoritative gate verification and official policy issuance for Motor & Health insurance lines.
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

      {/* Summary Metrics with Motor vs Health Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('READY')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${statusFilter === 'READY'
              ? 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/30'
              : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-600">Ready to Issue (100% Gates)</span>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{summary.readyCount}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              🚗 {motorQueue.filter((q) => q.allGatesPassed).length} Motor
            </span>
            <span>•</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              ❤️ {healthQueue.filter((q) => q.allGatesPassed).length} Health
            </span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('BLOCKED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${statusFilter === 'BLOCKED'
              ? 'ring-2 ring-amber-500 bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-600">Blocked by Stage Gates</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{summary.blockedCount}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              🚗 {motorQueue.filter((q) => !q.allGatesPassed).length} Motor
            </span>
            <span>•</span>
            <span className="text-rose-700 dark:text-rose-300 font-semibold">
              ❤️ {healthQueue.filter((q) => !q.allGatesPassed).length} Health
            </span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('INSPECTION_REQUIRED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${statusFilter === 'INSPECTION_REQUIRED'
              ? 'ring-2 ring-purple-500 bg-purple-500/10 border-purple-500/30'
              : 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-purple-600">Inspection Required</span>
            <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">
            {queue.filter((q) => q.status === 'INSPECTION_REQUIRED' || !q.gates.inspection.passed).length}
          </div>
          <div className="text-[11px] text-muted-foreground pt-0.5">
            Vehicle break-in inspection gate
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${statusFilter === 'ALL'
              ? 'ring-2 ring-primary bg-primary/10 border-primary/30'
              : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-primary">Total In Queue</span>
            <Layers className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-2xl font-black text-primary">{queue.length}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              🚗 {motorQueue.length} Motor
            </span>
            <span>•</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              ❤️ {healthQueue.length} Health
            </span>
          </div>
        </div>
      </div>

      {/* Primary Control Bar: Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold pb-1">
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
            className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${statusFilter === tab.id
                ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-accent border-border'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Secondary Bar: Product Filter, View Mode Switcher & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl border bg-card/60">
        {/* Product Line Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Product Line:</span>
          <button
            type="button"
            onClick={() => setProductFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${productFilter === 'ALL'
                ? 'bg-foreground text-background shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
          >
            <span>All Products</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/20 font-mono">
              {filteredQueue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProductFilter('MOTOR')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${productFilter === 'MOTOR'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
              }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>🚗 Motor Cases</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {motorQueue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProductFilter('HEALTH')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${productFilter === 'HEALTH'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
              }`}
          >
            <HeartPulse className="h-3.5 w-3.5" />
            <span>❤️ Health Cases</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {healthQueue.length}
            </span>
          </button>
        </div>

        {/* View Switcher & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-muted/60 border border-border text-xs">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition ${viewMode === 'TABLE'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Table view with dedicated columns for Motor and Health details"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition ${viewMode === 'CARDS'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Full-width cards stream view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards Stream</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search code, customer, plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadQueue()}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Main Content Areas based on selected View Mode */}
      {loadError && !loading && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-amber-600" />
          <div>
            <h3 className="font-bold text-sm text-foreground">Failed to Load Policy Issuance Queue</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md mx-auto">
              {loadError}. The backend server may have restarted or reconnected.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Loading Queue</span>
          </button>
        </div>
      )}

      {displayedQueue.length === 0 && !loading && !loadError ? (
        <div className="rounded-xl border bg-card p-12 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-bold text-base">Policy Issuance Queue is Empty</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All customer quotations in this category have been processed or are awaiting preliminary stages.
          </p>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* ========================================================================= */
        /* VIEW MODE 2: TABLE VIEW WITH DEDICATED MOTOR & HEALTH COLUMNS             */
        /* ========================================================================= */
        <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b border-border">
                  <th className="py-2.5 px-3 text-left font-bold">Case / Code</th>
                  <th className="py-2.5 px-3 text-left font-bold">Customer</th>
                  <th className="py-2.5 px-3 text-left font-bold">Insurer & Premium</th>
                  <th className="py-2.5 px-3 text-left font-bold bg-blue-500/5 text-blue-700 dark:text-blue-300">
                    🚗 Motor Details (Plate / Inspection)
                  </th>
                  <th className="py-2.5 px-3 text-left font-bold bg-rose-500/5 text-rose-700 dark:text-rose-300">
                    ❤️ Health Details (Plan / UW)
                  </th>
                  <th className="py-2.5 px-3 text-left font-bold">Status & Gates</th>
                  <th className="py-2.5 px-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedQueue.map((item) => {
                  const isHealth = item.productType === 'HEALTH';
                  const isApproved = item.status === 'APPROVED' || item.status === 'ACCEPTED';
                  const allGatesCleared = Boolean(
                    item.allGatesPassed &&
                    item.gates?.customer?.passed &&
                    item.gates?.payment?.passed &&
                    item.gates?.documents?.passed &&
                    (isHealth ? true : item.gates?.vehicle?.passed && item.gates?.inspection?.passed)
                  );
                  const canIssue = Boolean(isApproved && allGatesCleared);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/40 transition ${item.allGatesPassed ? 'bg-emerald-500/[0.01]' : ''
                        }`}
                    >
                      {/* Case / Code Column */}
                      <td className="py-3 px-3 align-top space-y-1">
                        <div className="font-mono font-bold text-foreground">{item.quotationCode}</div>
                        <div className="flex items-center gap-1">
                          {isHealth ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300">
                              <HeartPulse className="h-3 w-3" />
                              Health
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                              <Car className="h-3 w-3" />
                              Motor
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Customer Column */}
                      <td className="py-3 px-3 align-top space-y-0.5">
                        <div className="font-semibold text-foreground">{item.customerName}</div>
                        {item.customerPhone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {item.customerPhone}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">Agent: {item.salesAgentName}</div>
                      </td>

                      {/* Insurer & Premium */}
                      <td className="py-3 px-3 align-top space-y-1">
                        <div className="font-medium text-foreground">{item.insurerName}</div>
                        <div className="font-mono font-bold text-foreground">
                          ₹{Number(item.totalPremium || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px]">
                          {item.gates.payment.passed ? (
                            <span className="text-emerald-600 font-semibold">Payment Paid</span>
                          ) : (
                            <span className="text-amber-600 font-semibold">{item.gates.payment.status}</span>
                          )}
                        </div>
                      </td>

                      {/* DEDICATED COLUMN: MOTOR DETAILS */}
                      <td className="py-3 px-3 align-top space-y-1 bg-blue-500/[0.02]">
                        {!isHealth ? (
                          <>
                            <div className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">
                              {item.gates.vehicle.detail || 'Plate Verified'}
                            </div>
                            <div className="flex items-center gap-1 text-[11px]">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.gates.inspection.passed
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                                  }`}
                              >
                                Inspection: {item.gates.inspection.status}
                              </span>
                              {!item.gates.inspection.passed && (
                                <Link
                                  href={`/workspace/operations/inspections/${item.id}`}
                                  className="text-[10px] text-purple-600 underline font-semibold flex items-center gap-0.5"
                                >
                                  Inspect <ExternalLink className="h-2.5 w-2.5" />
                                </Link>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            — N/A (Health Case) —
                          </span>
                        )}
                      </td>

                      {/* DEDICATED COLUMN: HEALTH DETAILS */}
                      <td className="py-3 px-3 align-top space-y-1 bg-rose-500/[0.02]">
                        {isHealth ? (
                          <>
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300">
                              <HeartPulse className="h-3 w-3" />
                              Plan Verified
                            </div>
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                              Medical UW: EXEMPT / PASSED
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            — N/A (Motor Case) —
                          </span>
                        )}
                      </td>

                      {/* Status & Gates */}
                      <td className="py-3 px-3 align-top space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${isApproved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                          {item.allGatesPassed ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              READY
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              BLOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          SLA: {item.slaRemainingHours}h Left
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 align-top text-right space-y-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedQuote({ id: item.id, productType: isHealth ? 'HEALTH' : 'MOTOR' })}
                            className="px-2 py-1 rounded border bg-card hover:bg-accent text-[11px] font-medium transition"
                            title={isHealth ? 'Manual Health policy entry' : 'Manual Motor policy entry'}
                          >
                            Manual
                          </button>
                          <button
                            type="button"
                            disabled={issuingId === item.id || !canIssue}
                            onClick={() => handleDirectIssue(item.id, item)}
                            title={
                              !allGatesCleared
                                ? `Blocked: ${item.nextAction || 'All gates must be cleared'}`
                                : !isApproved
                                  ? `Quotation must be approved before issuance (currently ${item.status})`
                                  : isHealth
                                    ? 'Issue Health Policy'
                                    : 'Issue Motor Policy'
                            }
                            className={`px-2.5 py-1 rounded text-[11px] font-bold shadow-xs transition ${
                              canIssue
                                ? isHealth
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                : 'bg-muted/80 text-muted-foreground border border-border/80 cursor-not-allowed opacity-60'
                            }`}
                          >
                            {issuingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin inline" />
                            ) : canIssue ? (
                              isHealth ? 'Issue Health' : 'Issue Motor'
                            ) : (
                              'Pending Gates'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW MODE 3: CARDS STREAM (Original Full-Width Stream)                    */
        /* ========================================================================= */
        <div className="space-y-3">
          {displayedQueue.map((item) =>
            renderCaseCard(item, item.productType === 'HEALTH' ? 'HEALTH' : 'MOTOR'),
          )}
        </div>
      )}

      {/* Underwriter Review Modal */}
      {underwriterAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card text-card-foreground border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black">
                  {underwriterAction.type === 'APPROVE'
                    ? 'Underwriter Quotation Approval'
                    : 'Underwriter Quotation Rejection'}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {underwriterAction.productType === 'HEALTH' ? '❤️ Health Insurance' : '🚗 Motor Insurance'}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-muted-foreground">
                #{underwriterAction.quotationCode}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">
                {underwriterAction.type === 'APPROVE'
                  ? 'Approval Comments / Conditions:'
                  : 'Rejection Reason / Justification:'}
              </label>
              <textarea
                rows={3}
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder={
                  underwriterAction.type === 'APPROVE'
                    ? 'e.g. Approved with standard terms.'
                    : 'e.g. Declined due to medical risk or vehicle break-in guidelines.'
                }
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
                className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 ${underwriterAction.type === 'APPROVE'
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

      {/* Manual Entry Dialog */}
      {selectedQuote && (
        <UpdatePolicyDetailsDialog
          isOpen={Boolean(selectedQuote)}
          quotationId={selectedQuote.id}
          productType={selectedQuote.productType}
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

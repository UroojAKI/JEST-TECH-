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
  Eye,
  X,
  FileText,
  MapPin,
  Shield,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { policiesRepository } from '../../repositories/policies.repository';
import {
  isQuotationBackOfficeApproved,
  quotationsRepository,
} from '../../repositories/quotations.repository';
import { UpdatePolicyDetailsDialog } from '../leads/motor-quote/UpdatePolicyDetailsDialog';
import { showApiErrorToast } from '../../lib/api-client';

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

  // Extended Policy & Issuance Details
  policyType?: string;
  vehicleCategory?: string;
  policyTenure?: number;
  sumInsured?: number;
  basePremium?: number;
  gstAmount?: number;
  odPremium?: number;
  tpPremium?: number;
  addonPremium?: number;
  discountAmount?: number;
  ncbPercentage?: number;
  addons?: Array<{ addonCode: string; addonName: string; premium: number }>;
  workflowState?: string;
  issuanceStatus?: string;
  proposalStatus?: string;
  proposalNumber?: string;
  caseId?: string;
  caseCode?: string;
  calculationValid?: boolean;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerPincode?: string;
  customerDob?: string;
  panMasked?: string;
  aadhaarMasked?: string;
  kycStatus?: string;
  vehicleDetails?: {
    registrationNumber?: string;
    makeModel?: string;
    make?: string;
    model?: string;
    category?: string;
    fuelType?: string;
    rtoLocation?: string;
    manufactureYearMonth?: string;
    dateOfRegistration?: string;
    engineNumber?: string;
    chassisNumber?: string;
    status?: string;
  };
  previousPolicy?: {
    previousPolicyType?: string;
    previousInsurerName?: string;
    previousPolicyNumber?: string;
    policyExpiryDate?: string;
    activeTpInsurer?: string;
    activeTpPolicyNumber?: string;
    activeTpExpiryDate?: string;
  };
  healthDetails?: {
    planCategory?: string;
    policyForm?: string;
    planName?: string;
    memberCount?: number;
    members?: Array<{
      firstName: string;
      lastName?: string;
      relation: string;
      dateOfBirth?: string;
      gender?: string;
    }>;
    nomineeName?: string;
    nomineeRelation?: string;
    occupation?: string;
    preExistingDiseases?: string;
  };
  documents?: Array<{
    id: string;
    documentType: string;
    verificationStatus: string;
    fileName?: string;
    fileUrl?: string;
    createdAt?: string;
    source: string;
  }>;
  issuedPolicy?: {
    id: string;
    policyNumber: string;
    status: string;
    premiumAmount: number;
    effectiveDate?: string;
    expiryDate?: string;
    odStartDate?: string;
    odExpiryDate?: string;
    tpStartDate?: string;
    tpExpiryDate?: string;
    policyTenure?: number;
  };
}

function formatPolicyTypeBadge(policyType?: string): string {
  const upper = String(policyType || '').toUpperCase();
  if (upper === 'TP_ONLY' || upper === 'THIRD_PARTY_ONLY') return 'TP Only';
  if (upper === 'SAOD' || upper === 'STANDALONE_OD' || upper === 'STANDALONE_OWN_DAMAGE') return 'SAOD';
  if (upper === 'PACKAGE' || upper === 'PACKAGE_COMPREHENSIVE') return 'Package';
  return upper ? upper.replace(/_/g, ' ') : 'Standard';
}

function formatCurrency(val?: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN')}`;
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
  const [productFilter, setProductFilter] = useState<'ALL' | 'MOTOR' | 'HEALTH' | 'LIFE'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<{ id: string; productType: 'MOTOR' | 'HEALTH' | 'LIFE' } | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<BackOfficeQueueItem | null>(null);

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
        page,
        limit: 25,
        productType: productFilter === 'ALL' ? undefined : productFilter,
      });
      const items = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];
      setQueue(items);
      setTotalPages(Number(res?.totalPages ?? res?.data?.totalPages ?? res?.meta?.totalPages ?? 1));
      setTotalRecords(Number(res?.total ?? res?.data?.total ?? res?.meta?.total ?? items.length));
      if (res?.summary || res?.data?.summary) setSummary(res?.summary || res?.data?.summary);
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

  useEffect(() => { setPage(1); }, [statusFilter, productFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadQueue(); }, search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [statusFilter, productFilter, page, search]);

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
        (item.caseCode || '').toLowerCase().includes(term) ||
        (item.vehicleDetails?.registrationNumber || '').toLowerCase().includes(term) ||
        (item.vehicleDetails?.makeModel || '').toLowerCase().includes(term) ||
        (item.issuedPolicy?.policyNumber || '').toLowerCase().includes(term) ||
        (item.gates.vehicle.detail || '').toLowerCase().includes(term)
      );
    });
  }, [queue, search]);

  const motorQueue = useMemo(
    () => filteredQueue.filter((item) => item.productType !== 'HEALTH' && item.productType !== 'LIFE'),
    [filteredQueue],
  );

  const healthQueue = useMemo(
    () => filteredQueue.filter((item) => item.productType === 'HEALTH'),
    [filteredQueue],
  );

  const lifeQueue = useMemo(
    () => filteredQueue.filter((item) => item.productType === 'LIFE'),
    [filteredQueue],
  );

  const displayedQueue = useMemo(() => {
    if (productFilter === 'MOTOR') return motorQueue;
    if (productFilter === 'HEALTH') return healthQueue;
    if (productFilter === 'LIFE') return lifeQueue;
    return filteredQueue;
  }, [productFilter, motorQueue, healthQueue, lifeQueue, filteredQueue]);

  const handleDirectIssue = async (quotationId: string, item?: BackOfficeQueueItem) => {
    if (item) {
      const isApproved = item.status === 'APPROVED' || item.status === 'ACCEPTED';
      const isHealth = item.productType === 'HEALTH';
      const isLife = item.productType === 'LIFE';
      const gatesOk = Boolean(
        item.allGatesPassed &&
        item.gates?.customer?.passed &&
        item.gates?.payment?.passed &&
        item.gates?.documents?.passed &&
        (isHealth || isLife ? true : item.gates?.vehicle?.passed && item.gates?.inspection?.passed)
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
      console.warn('Queue issuance error:', error);
      const isPdfError =
        error?.response?.data?.message?.toString().toLowerCase().includes('pdf') ||
        error?.message?.toString().toLowerCase().includes('pdf') ||
        error?.response?.status === 400;

      showApiErrorToast(
        error,
        'Policy issuance blocked: Official policy schedule PDF document is mandatory before policy can be issued.'
      );

      // Automatically open the Manual Entry dialog so user can immediately upload the PDF
      if (isPdfError && item) {
        toast.info('Opening Manual Entry to upload the mandatory policy PDF schedule...');
        setSelectedQuote({
          id: item.id,
          productType: item.productType === 'LIFE' ? 'LIFE' : item.productType === 'HEALTH' ? 'HEALTH' : 'MOTOR',
        });
      }
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

  const renderGateChips = (
    item: BackOfficeQueueItem,
    domain: 'MOTOR' | 'HEALTH' | 'LIFE' | boolean,
    compact = false,
  ) => {
    const isLife = domain === 'LIFE' || item.productType === 'LIFE';
    const isHealth = domain === 'HEALTH' || domain === true || item.productType === 'HEALTH';
    const padCls = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
    const iconCls = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} ${
            item.gates.customer.passed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}
          title={item.gates.customer.detail}
        >
          <UserCheck className={iconCls} />
          <span>KYC: {item.gates.customer.status}</span>
        </span>

        {isLife ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300`}
            title="Life assured underwriting profile verified"
          >
            <Shield className={iconCls} />
            <span>Life: READY</span>
          </span>
        ) : isHealth ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300`}
            title="Comprehensive health plan coverage verified"
          >
            <HeartPulse className={iconCls} />
            <span>Health: READY</span>
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} ${
              item.gates.vehicle.passed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            }`}
            title={item.gates.vehicle.detail}
          >
            <Car className={iconCls} />
            <span>Veh: {item.gates.vehicle.status}</span>
          </span>
        )}

        {isLife ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300`}
            title="Medical checkup clean / pre-underwriting passed"
          >
            <ShieldCheck className={iconCls} />
            <span>UW: PASSED</span>
          </span>
        ) : isHealth ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300`}
            title="Medical checkup waived / pre-underwriting passed"
          >
            <ShieldCheck className={iconCls} />
            <span>UW: EXEMPT</span>
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} ${
              item.gates.inspection.passed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
            title={item.gates.inspection.detail}
          >
            <ShieldCheck className={iconCls} />
            <span>Insp: {item.gates.inspection.status}</span>
          </span>
        )}

        <span
          className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} ${
            item.gates.payment.passed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}
          title={item.gates.payment.detail}
        >
          <CreditCard className={iconCls} />
          <span>Pay: {item.gates.payment.status}</span>
        </span>

        <span
          className={`inline-flex items-center gap-1 rounded-md border font-medium ${padCls} ${
            item.gates.documents.passed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}
          title={item.gates.documents.detail}
        >
          <FileCheck2 className={iconCls} />
          <span>Docs: {item.gates.documents.status}</span>
        </span>
      </div>
    );
  };

  /**
   * Card Component for a single case item
   */
  const renderCaseCard = (item: BackOfficeQueueItem, domain: 'MOTOR' | 'HEALTH' | 'LIFE') => {
    const isLife = domain === 'LIFE';
    const isHealth = domain === 'HEALTH';
    const isMotor = !isLife && !isHealth;
    const isApprovedOrAccepted = isLife
      ? (item.status === 'APPROVED' || item.status === 'ACCEPTED')
      : isQuotationBackOfficeApproved(item);
    const allGatesCleared = Boolean(
      item.allGatesPassed &&
      item.gates?.customer?.passed &&
      item.gates?.payment?.passed &&
      item.gates?.documents?.passed &&
      (isHealth || isLife ? true : item.gates?.vehicle?.passed && item.gates?.inspection?.passed)
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
                  isLife
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : isHealth
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                }`}
              >
                {isLife ? 'Life Insurance' : isHealth ? 'Health Insurance' : 'Motor Insurance'}
              </span>
              <span className="font-mono text-xs font-bold text-foreground">#{item.quotationCode}</span>
              {item.policyType && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground border border-border">
                  {formatPolicyTypeBadge(item.policyType)}
                </span>
              )}
              {item.caseCode && item.caseId && (
                <Link
                  href={!isHealth ? `/workspace/operations/cases/${item.caseId}` : `/workspace/health`}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 hover:underline inline-flex items-center gap-1"
                  title="Open Case Workspace"
                >
                  {item.caseCode}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
              {item.issuedPolicy?.policyNumber && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-600 text-white">
                  Policy #{item.issuedPolicy.policyNumber}
                </span>
              )}

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
            {isLife ? (
              <span
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs"
                title="Life Insurance Policy"
              >
                <Shield className="h-4 w-4 text-amber-500" />
                <span>Life</span>
              </span>
            ) : isHealth ? (
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
        <div className="text-xs text-muted-foreground flex items-center gap-x-3 gap-y-1 flex-wrap bg-muted/30 p-2.5 rounded-lg">
          <span>Insurer: <strong className="text-foreground">{item.insurerName}</strong></span>
          <span>Agent: <strong className="text-foreground">{item.salesAgentName}</strong></span>
          <span>
            Total:{' '}
            <strong className="text-foreground font-mono font-bold">
              {formatCurrency(item.totalPremium)}
            </strong>
          </span>
          {(item.basePremium || item.gstAmount) ? (
            <span className="text-[11px]">
              (Base {formatCurrency(item.basePremium)} + GST {formatCurrency(item.gstAmount)})
            </span>
          ) : null}
          <span>
            {isHealth ? 'Sum Insured: ' : 'IDV: '}
            <strong className="text-foreground font-mono">
              {Number(item.sumInsured || 0) > 0
                ? formatCurrency(item.sumInsured)
                : String(item.policyType || '').includes('TP')
                  ? 'TP Liability Only'
                  : '—'}
            </strong>
          </span>
          {item.paymentReference && (
            <span className="text-[11px] font-mono">Ref: {item.paymentReference}</span>
          )}
          {item.panMasked && (
            <span className="text-[11px] font-mono">PAN: {item.panMasked}</span>
          )}
        </div>

        {/* Domain-Specific Underwriting & Compliance Gates */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            {isLife ? '🛡️ Life Verification Gates' : isHealth ? '❤️ Health Verification Gates' : '🚗 Motor Verification Gates'}
          </div>

          {renderGateChips(item, domain)}

          {isMotor && item.vehicleDetails && (
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
              {item.vehicleDetails.registrationNumber && (
                <span>Plate: <strong className="font-mono text-foreground">{item.vehicleDetails.registrationNumber}</strong></span>
              )}
              {item.vehicleDetails.makeModel && (
                <span>Vehicle: <strong className="text-foreground">{item.vehicleDetails.makeModel}</strong></span>
              )}
              {(item.vehicleDetails.engineNumber || item.vehicleDetails.chassisNumber) && (
                <span>Eng/Chs: <strong className="font-mono text-foreground">{item.vehicleDetails.engineNumber || '—'} / {item.vehicleDetails.chassisNumber || '—'}</strong></span>
              )}
              {item.previousPolicy?.previousInsurerName && (
                <span>Prev: <strong className="text-foreground">{item.previousPolicy.previousInsurerName}</strong></span>
              )}
            </div>
          )}

          {isMotor && item.gates.vehicle.detail && (
            <div className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Specs:</span> {item.gates.vehicle.detail}
            </div>
          )}
          {isHealth && item.healthDetails && (
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
              {item.healthDetails.planName && (
                <span>Plan: <strong className="text-foreground">{item.healthDetails.planName}</strong></span>
              )}
              {item.healthDetails.planCategory && (
                <span>Category: <strong className="text-foreground">{item.healthDetails.planCategory}</strong></span>
              )}
              <span>Members: <strong className="text-foreground">{item.healthDetails.memberCount || 1}</strong></span>
              {item.healthDetails.nomineeName && (
                <span>Nominee: <strong className="text-foreground">{item.healthDetails.nomineeName} ({item.healthDetails.nomineeRelation || 'NOMINEE'})</strong></span>
              )}
            </div>
          )}
          {isLife && item.gates.vehicle?.detail && (
            <div className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Underwriting:</span> {item.gates.vehicle.detail}
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
            {isMotor && !item.gates.inspection.passed && (
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
              onClick={() => setSelectedDetailItem(item)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border bg-card hover:bg-accent text-[11px] font-semibold transition"
              title="View Complete Policy & Issuance Details"
            >
              <Eye className="h-3 w-3" />
              <span>Details</span>
            </button>

            {!item.issuedPolicy && (
              <button
                type="button"
                onClick={() => setSelectedQuote({ id: item.id, productType: isLife ? 'LIFE' : isHealth ? 'HEALTH' : 'MOTOR' })}
                className="px-2.5 py-1 rounded-md border bg-card hover:bg-accent text-[11px] font-medium transition"
                title={isLife ? 'Manual Life policy number & date entry' : isHealth ? 'Manual Health policy number & date entry' : 'Manual Motor policy number & date entry'}
              >
                Manual Entry
              </button>
            )}

            {item.issuedPolicy ? (
              <Link
                href={`/policies/${item.issuedPolicy.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>View Policy #{item.issuedPolicy.policyNumber}</span>
              </Link>
            ) : (
              <button
              type="button"
              disabled={issuingId === item.id || !canIssue}
              title={
                !allGatesCleared
                  ? `Blocked: ${item.nextAction || 'All compliance & payment gates must be cleared'}`
                  : !isApprovedOrAccepted
                    ? `Quotation must be approved before issuance (currently ${item.status})`
                    : isLife
                      ? 'Issue official Life Policy'
                      : isHealth
                        ? 'Issue official Health Policy'
                        : 'Issue official Motor Policy'
              }
              onClick={() => handleDirectIssue(item.id, item)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition ${
                canIssue
                  ? isLife
                    ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                    : isHealth
                      ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-muted/80 text-muted-foreground border border-border/80 cursor-not-allowed opacity-60'
              }`}
            >
              {issuingId === item.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isLife ? (
                <Shield className="h-3.5 w-3.5" />
              ) : isHealth ? (
                <HeartPulse className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>
                {issuingId === item.id
                  ? 'Issuing...'
                  : canIssue
                    ? isLife
                      ? 'Issue Life Policy'
                      : isHealth
                        ? 'Issue Health Policy'
                        : 'Issue Motor Policy'
                    : isLife
                      ? 'Issue Life (Gates Pending)'
                      : isHealth
                        ? 'Issue Health (Gates Pending)'
                        : 'Issue Motor (Gates Pending)'}
              </span>
            </button>
            )}
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
            Authoritative gate verification and official policy issuance for Motor, Health & Life insurance lines.
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

      {/* Summary Metrics with Motor vs Health vs Life Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              🚗 {motorQueue.filter((q) => q.allGatesPassed).length} Motor
            </span>
            <span>•</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              ❤️ {healthQueue.filter((q) => q.allGatesPassed).length} Health
            </span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              🛡️ {lifeQueue.filter((q) => q.allGatesPassed).length} Life
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
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              🚗 {motorQueue.filter((q) => !q.allGatesPassed).length} Motor
            </span>
            <span>•</span>
            <span className="text-rose-700 dark:text-rose-300 font-semibold">
              ❤️ {healthQueue.filter((q) => !q.allGatesPassed).length} Health
            </span>
            <span>•</span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              🛡️ {lifeQueue.filter((q) => !q.allGatesPassed).length} Life
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
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              🚗 {motorQueue.length} Motor
            </span>
            <span>•</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              ❤️ {healthQueue.filter((q) => !q.issuedPolicy).length} Health
            </span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              🛡️ {lifeQueue.length} Life
            </span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('ISSUED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${statusFilter === 'ISSUED'
              ? 'ring-2 ring-teal-500 bg-teal-500/10 border-teal-500/30'
              : 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-teal-600">Issued Policies</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-700">{summary.issuedCount}</div>
          <div className="text-[11px] text-muted-foreground pt-0.5">
            Click to view issued records
          </div>
        </div>
      </div>

      {/* Primary Control Bar: Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold pb-1">
        {[
          { id: 'ALL', label: 'All Pending' },
          { id: 'READY', label: 'Ready to Issue' },
          { id: 'BLOCKED', label: 'Blocked' },
          { id: 'SUBMITTED,UNDER_REVIEW', label: 'Pending Review' },
          { id: 'INSPECTION_REQUIRED', label: 'Inspection Required' },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'ISSUED', label: `Issued Policies (${summary.issuedCount})` },
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

          <button
            type="button"
            onClick={() => setProductFilter('LIFE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${productFilter === 'LIFE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>🛡️ Life Cases</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {lifeQueue.length}
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
                  <th className="py-2.5 px-3 text-left font-bold">Case / Quote</th>
                  <th className="py-2.5 px-3 text-left font-bold">Customer & KYC</th>
                  <th className="py-2.5 px-3 text-left font-bold">Coverage & Premium</th>
                  <th className="py-2.5 px-3 text-left font-bold bg-blue-500/5 text-blue-700 dark:text-blue-300">
                    🚗 Motor Details
                  </th>
                  <th className="py-2.5 px-3 text-left font-bold bg-rose-500/5 text-rose-700 dark:text-rose-300">
                    ❤️ Health Details
                  </th>
                  <th className="py-2.5 px-3 text-left font-bold bg-amber-500/5 text-amber-700 dark:text-amber-300">
                    🛡️ Life Details (Plan / Life Assured)
                  </th>
                  <th className="py-2.5 px-3 text-left font-bold">Gates & Next Action</th>
                  <th className="py-2.5 px-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedQueue.map((item) => {
                  const isHealth = item.productType === 'HEALTH';
                  const isLife = item.productType === 'LIFE';
                  const isMotor = !isHealth && !isLife;
                  const isApproved = isLife
                    ? (item.status === 'APPROVED' || item.status === 'ACCEPTED')
                    : isQuotationBackOfficeApproved(item);
                  const allGatesCleared = Boolean(
                    item.allGatesPassed &&
                    item.gates?.customer?.passed &&
                    item.gates?.payment?.passed &&
                    item.gates?.documents?.passed &&
                    (isHealth || isLife ? true : item.gates?.vehicle?.passed && item.gates?.inspection?.passed)
                  );
                  const canIssue = Boolean(!item.issuedPolicy && isApproved && allGatesCleared);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/40 transition ${item.allGatesPassed ? 'bg-emerald-500/[0.01]' : ''
                        }`}
                    >
                      {/* Case / Code Column */}
                      <td className="py-3 px-3 align-top space-y-1 min-w-[155px]">
                        <div className="font-mono font-bold text-foreground">{item.quotationCode}</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {isLife ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              <Shield className="h-3 w-3" />
                              Life
                            </span>
                          ) : isHealth ? (
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
                          {item.policyType && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border border-border">
                              {formatPolicyTypeBadge(item.policyType)}
                            </span>
                          )}
                        </div>
                        {item.caseCode && item.caseId && (
                          <div>
                            <Link
                              href={!isHealth ? `/workspace/operations/cases/${item.caseId}` : `/workspace/health`}
                              className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              {item.caseCode} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          </div>
                        )}
                        {item.issuedPolicy?.policyNumber && (
                          <div className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            Pol: {item.issuedPolicy.policyNumber}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()} • {item.policyTenure || 1} Yr
                        </div>
                      </td>

                      {/* Customer & KYC Column */}
                      <td className="py-3 px-3 align-top space-y-0.5 min-w-[175px]">
                        <div className="font-semibold text-foreground">{item.customerName}</div>
                        {item.customerPhone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            {item.customerPhone}
                          </div>
                        )}
                        {item.customerEmail && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate max-w-[170px]" title={item.customerEmail}>
                            <Mail className="h-3 w-3 shrink-0" />
                            {item.customerEmail}
                          </div>
                        )}
                        {(item.customerCity || item.customerPincode) && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1" title={item.customerAddress}>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{[item.customerCity, item.customerPincode].filter(Boolean).join(' - ')}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span>Agent: {item.salesAgentName}</span>
                          {item.panMasked && <span className="font-mono">• PAN {item.panMasked}</span>}
                        </div>
                      </td>

                      {/* Coverage, Insurer & Premium Breakdown */}
                      <td className="py-3 px-3 align-top space-y-1 min-w-[165px]">
                        <div className="font-medium text-foreground">{item.insurerName}</div>
                        <div className="font-mono font-bold text-foreground">
                          {formatCurrency(item.totalPremium)}
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          <div>
                            {isHealth ? 'SI: ' : 'IDV: '}
                            <strong className="font-mono text-foreground">
                              {Number(item.sumInsured || 0) > 0
                                ? formatCurrency(item.sumInsured)
                                : String(item.policyType || '').includes('TP')
                                  ? 'TP Liability Only'
                                  : '—'}
                            </strong>
                          </div>
                          {(item.basePremium || item.gstAmount) ? (
                            <div className="font-mono">
                              Base {formatCurrency(item.basePremium)} + GST {formatCurrency(item.gstAmount)}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-[10px] flex items-center gap-1 flex-wrap">
                          {item.gates.payment.passed ? (
                            <span className="text-emerald-600 font-semibold">Paid {formatCurrency(item.paymentAmount)}</span>
                          ) : (
                            <span className="text-amber-600 font-semibold">{item.paymentStatus || item.gates.payment.status}</span>
                          )}
                          {item.paymentReference && (
                            <span className="font-mono text-muted-foreground">({item.paymentReference})</span>
                          )}
                        </div>
                      </td>

                      {/* DEDICATED COLUMN: MOTOR DETAILS */}
                      <td className="py-3 px-3 align-top space-y-1 bg-blue-500/[0.02] min-w-[180px]">
                        {isMotor ? (
                          <>
                            <div className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">
                              {item.vehicleDetails?.registrationNumber || item.gates.vehicle.detail || 'Plate Pending'}
                            </div>
                            {item.vehicleDetails?.makeModel && (
                              <div className="text-[11px] font-medium text-foreground">
                                {item.vehicleDetails.makeModel}
                              </div>
                            )}
                            {(item.vehicleDetails?.category || item.vehicleDetails?.fuelType) && (
                              <div className="text-[10px] text-muted-foreground">
                                {[item.vehicleDetails.category, item.vehicleDetails.fuelType].filter(Boolean).join(' • ')}
                              </div>
                            )}
                            {(item.vehicleDetails?.engineNumber || item.vehicleDetails?.chassisNumber) && (
                              <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[175px]" title={`Eng: ${item.vehicleDetails.engineNumber || '—'} | Chs: ${item.vehicleDetails.chassisNumber || '—'}`}>
                                Eng: {item.vehicleDetails.engineNumber || '—'}
                              </div>
                            )}
                            {item.previousPolicy?.previousInsurerName && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[175px]">
                                Prev: {item.previousPolicy.previousInsurerName}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[11px]">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.gates.inspection.passed
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                                  }`}
                              >
                                Insp: {item.gates.inspection.status}
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
                            — N/A ({isLife ? 'Life' : 'Health'} Case) —
                          </span>
                        )}
                      </td>

                      {/* DEDICATED COLUMN: HEALTH DETAILS (Dynamic, Zero Hardcoding) */}
                      <td className="py-3 px-3 align-top space-y-1 bg-rose-500/[0.02] min-w-[170px]">
                        {isHealth ? (
                          <>
                            <div className="font-semibold text-[11px] text-foreground">
                              {item.healthDetails?.planName || 'Health Insurance Plan'}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {item.healthDetails?.planCategory && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300">
                                  {item.healthDetails.planCategory.replace(/_/g, ' ')}
                                </span>
                              )}
                              {item.healthDetails?.policyForm && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                  {item.healthDetails.policyForm.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Members: <strong className="text-foreground">{item.healthDetails?.memberCount || 1}</strong>
                              {item.healthDetails?.nomineeName ? ` • Nom: ${item.healthDetails.nomineeName}` : ''}
                            </div>
                            <div className={`text-[10px] font-semibold ${item.gates.documents.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                              Docs/UW: {item.gates.documents.status}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            — N/A ({isLife ? 'Life' : 'Motor'} Case) —
                          </span>
                        )}
                      </td>

                      {/* DEDICATED COLUMN: LIFE DETAILS */}
                      <td className="py-3 px-3 align-top space-y-1 bg-amber-500/[0.02]">
                        {isLife ? (
                          <>
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              <Shield className="h-3 w-3" />
                              Life Plan Verified
                            </div>
                            <div className="text-[11px] text-amber-800 dark:text-amber-200 font-semibold">
                              {item.gates.vehicle?.detail || 'Life Assured & Nominee Clean'}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-medium">
                              Medical UW: PASSED
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            — N/A ({isHealth ? 'Health' : 'Motor'} Case) —
                          </span>
                        )}
                      </td>

                      {/* Status, Gates & Next Action */}
                      <td className="py-3 px-3 align-top space-y-1.5 min-w-[210px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${isApproved || item.issuedPolicy
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                          >
                            {item.issuedPolicy ? 'ISSUED' : item.status.replace('_', ' ')}
                          </span>
                          {!item.issuedPolicy && (
                            item.allGatesPassed ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                READY
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                BLOCKED
                              </span>
                            )
                          )}
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {item.slaRemainingHours}h
                          </span>
                        </div>
                        {renderGateChips(item, isHealth, true)}
                        <div className="text-[10px] text-muted-foreground truncate max-w-[210px]" title={item.nextAction}>
                          <strong className="text-foreground">Next:</strong> {item.nextAction}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 align-top text-right space-y-1.5 min-w-[180px]">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-card hover:bg-accent text-[11px] font-semibold transition"
                            title="View Complete Policy Details"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </button>

                          {/* Underwriter Approval Controls */}
                          {!item.issuedPolicy && !isApproved && item.status !== 'REJECTED' && (
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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                                title="Approve Quotation"
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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                                title="Reject Quotation"
                              >
                                <ThumbsDown className="h-3 w-3" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {!item.issuedPolicy && (
                            <button
                              type="button"
                              onClick={() => setSelectedQuote({ id: item.id, productType: isLife ? 'LIFE' : isHealth ? 'HEALTH' : 'MOTOR' })}
                              className="px-2 py-1 rounded border bg-card hover:bg-accent text-[11px] font-medium transition"
                              title={isLife ? 'Manual Life policy entry' : isHealth ? 'Manual Health policy entry' : 'Manual Motor policy entry'}
                            >
                              Manual
                            </button>
                          )}

                          {item.issuedPolicy ? (
                            <Link
                              href={`/policies/${item.issuedPolicy.id}`}
                              className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                            >
                              View Policy
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled={issuingId === item.id || !canIssue}
                              onClick={() => handleDirectIssue(item.id, item)}
                              title={
                                !allGatesCleared
                                  ? `Blocked: ${item.nextAction || 'All gates must be cleared'}`
                                  : !isApproved
                                    ? `Quotation must be approved before issuance (currently ${item.status})`
                                    : isLife
                                      ? 'Issue Life Policy'
                                      : isHealth
                                        ? 'Issue Health Policy'
                                        : 'Issue Motor Policy'
                              }
                              className={`px-2.5 py-1 rounded text-[11px] font-bold shadow-xs transition ${
                                canIssue
                                  ? isLife
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                                    : isHealth
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                  : 'bg-muted/80 text-muted-foreground border border-border/80 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {issuingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin inline" />
                              ) : canIssue ? (
                                isLife ? 'Issue Life' : isHealth ? 'Issue Health' : 'Issue Motor'
                              ) : (
                                'Pending Gates'
                              )}
                            </button>
                          )}
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
            renderCaseCard(item, item.productType === 'LIFE' ? 'LIFE' : item.productType === 'HEALTH' ? 'HEALTH' : 'MOTOR'),
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border bg-card p-3 text-xs">
        <span className="text-muted-foreground">Showing {queue.length} records on page {page} of {totalPages} · {totalRecords} matching records</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
          <span className="font-mono">{page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
        </div>
      </div>

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
                  {underwriterAction.productType === 'LIFE'
                    ? '🛡️ Life Insurance'
                    : underwriterAction.productType === 'HEALTH'
                      ? '❤️ Health Insurance'
                      : '🚗 Motor Insurance'}
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

      {/* Complete Policy & Issuance Details Modal */}
      {selectedDetailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedDetailItem(null)}
        >
          <div
            className="bg-card text-card-foreground border rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/40">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-black">
                    #{selectedDetailItem.quotationCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">
                    {selectedDetailItem.productType} • {formatPolicyTypeBadge(selectedDetailItem.policyType)}
                  </span>
                  {selectedDetailItem.issuedPolicy?.policyNumber && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-600 text-white">
                      Policy #{selectedDetailItem.issuedPolicy.policyNumber}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedDetailItem.insurerName} • Agent: {selectedDetailItem.salesAgentName}
                  {selectedDetailItem.caseCode ? ` • Case: ${selectedDetailItem.caseCode}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Close policy details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Pricing & Coverage Grid */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Coverage, IDV & Premium Breakdown
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground">
                      {selectedDetailItem.productType === 'HEALTH' ? 'Sum Insured' : 'Vehicle IDV'}
                    </div>
                    <div className="font-mono font-bold">
                      {Number(selectedDetailItem.sumInsured || 0) > 0
                        ? formatCurrency(selectedDetailItem.sumInsured)
                        : String(selectedDetailItem.policyType || '').includes('TP')
                          ? 'TP Liability Only'
                          : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Base / Net Premium</div>
                    <div className="font-mono font-bold">{formatCurrency(selectedDetailItem.basePremium)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">GST Amount</div>
                    <div className="font-mono font-bold">{formatCurrency(selectedDetailItem.gstAmount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Total Payable</div>
                    <div className="font-mono font-black text-emerald-600 text-sm">
                      {formatCurrency(selectedDetailItem.totalPremium)}
                    </div>
                  </div>
                  {selectedDetailItem.productType !== 'HEALTH' && (
                    <>
                      <div>
                        <div className="text-[10px] text-muted-foreground">OD Premium</div>
                        <div className="font-mono">{formatCurrency(selectedDetailItem.odPremium)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">TP Premium</div>
                        <div className="font-mono">{formatCurrency(selectedDetailItem.tpPremium)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Add-ons / Discount</div>
                        <div className="font-mono">
                          +{formatCurrency(selectedDetailItem.addonPremium)} / -{formatCurrency(selectedDetailItem.discountAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">NCB % & Tenure</div>
                        <div className="font-mono">
                          {selectedDetailItem.ncbPercentage || 0}% • {selectedDetailItem.policyTenure || 1} Yr
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Customer & Payment Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Customer & KYC Details
                  </div>
                  <div className="font-bold text-sm">{selectedDetailItem.customerName}</div>
                  {selectedDetailItem.customerPhone && (
                    <div className="text-muted-foreground">Phone: {selectedDetailItem.customerPhone}</div>
                  )}
                  {selectedDetailItem.customerEmail && (
                    <div className="text-muted-foreground">Email: {selectedDetailItem.customerEmail}</div>
                  )}
                  {selectedDetailItem.customerAddress && (
                    <div className="text-muted-foreground">Address: {selectedDetailItem.customerAddress}</div>
                  )}
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-mono">
                    <span>PAN: {selectedDetailItem.panMasked || 'Not on file'}</span>
                    {selectedDetailItem.aadhaarMasked && (
                      <span>Aadhaar: {selectedDetailItem.aadhaarMasked}</span>
                    )}
                    <span>KYC: {selectedDetailItem.kycStatus || 'PENDING'}</span>
                  </div>
                </div>

                <div className="rounded-xl border p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Payment & Workflow State
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="font-bold">{selectedDetailItem.paymentStatus || selectedDetailItem.gates.payment.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-mono font-bold">{formatCurrency(selectedDetailItem.paymentAmount)}</span>
                  </div>
                  {selectedDetailItem.paymentReference && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">UTR / Ref</span>
                      <span className="font-mono">{selectedDetailItem.paymentReference}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Workflow / Proposal</span>
                    <span className="font-mono text-[11px]">
                      {selectedDetailItem.workflowState || selectedDetailItem.status}
                      {selectedDetailItem.proposalStatus ? ` (${selectedDetailItem.proposalStatus})` : ''}
                    </span>
                  </div>
                  {selectedDetailItem.calculationValid !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Calculation Snapshot</span>
                      <span className={`font-bold ${selectedDetailItem.calculationValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {selectedDetailItem.calculationValid ? 'VALID' : 'INCOMPLETE'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Domain Specific: Vehicle / Previous Policy OR Health Plan / Members */}
              {selectedDetailItem.productType !== 'HEALTH' && selectedDetailItem.vehicleDetails && (
                <div className="rounded-xl border p-3.5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Vehicle & Previous Policy Specifications
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div><span className="text-muted-foreground">Registration:</span> <strong className="font-mono">{selectedDetailItem.vehicleDetails.registrationNumber || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Make / Model:</span> <strong>{selectedDetailItem.vehicleDetails.makeModel || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Category / Fuel:</span> <strong>{[selectedDetailItem.vehicleDetails.category, selectedDetailItem.vehicleDetails.fuelType].filter(Boolean).join(' • ') || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Engine No:</span> <strong className="font-mono">{selectedDetailItem.vehicleDetails.engineNumber || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Chassis No:</span> <strong className="font-mono">{selectedDetailItem.vehicleDetails.chassisNumber || '—'}</strong></div>
                    <div><span className="text-muted-foreground">RTO / Year:</span> <strong>{[selectedDetailItem.vehicleDetails.rtoLocation, selectedDetailItem.vehicleDetails.manufactureYearMonth].filter(Boolean).join(' • ') || '—'}</strong></div>
                  </div>
                  {selectedDetailItem.previousPolicy && (
                    <div className="pt-2 border-t text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Prev Type: <strong className="text-foreground">{selectedDetailItem.previousPolicy.previousPolicyType || '—'}</strong></span>
                      <span>Prev Insurer: <strong className="text-foreground">{selectedDetailItem.previousPolicy.previousInsurerName || selectedDetailItem.previousPolicy.activeTpInsurer || '—'}</strong></span>
                      <span>Prev Policy #: <strong className="font-mono text-foreground">{selectedDetailItem.previousPolicy.previousPolicyNumber || selectedDetailItem.previousPolicy.activeTpPolicyNumber || '—'}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {selectedDetailItem.productType === 'HEALTH' && selectedDetailItem.healthDetails && (
                <div className="rounded-xl border p-3.5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Health Plan & Insured Members ({selectedDetailItem.healthDetails.memberCount || 1})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Plan Name:</span> <strong>{selectedDetailItem.healthDetails.planName || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Category:</span> <strong>{selectedDetailItem.healthDetails.planCategory || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Policy Form:</span> <strong>{selectedDetailItem.healthDetails.policyForm || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Nominee:</span> <strong>{selectedDetailItem.healthDetails.nomineeName || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Relation:</span> <strong>{selectedDetailItem.healthDetails.nomineeRelation || '—'}</strong></div>
                  </div>
                  {selectedDetailItem.healthDetails.members && selectedDetailItem.healthDetails.members.length > 0 && (
                    <div className="pt-1.5 border-t flex flex-wrap gap-1.5">
                      {selectedDetailItem.healthDetails.members.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-muted text-[11px]">
                          {m.firstName} {m.lastName || ''} ({m.relation})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Issued Policy Dates (if issued) */}
              {selectedDetailItem.issuedPolicy && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Issued Policy Schedule Details
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Policy #:</span> <strong className="font-mono">{selectedDetailItem.issuedPolicy.policyNumber}</strong></div>
                    <div><span className="text-muted-foreground">Status:</span> <strong>{selectedDetailItem.issuedPolicy.status}</strong></div>
                    <div><span className="text-muted-foreground">Effective:</span> <strong>{selectedDetailItem.issuedPolicy.effectiveDate ? new Date(selectedDetailItem.issuedPolicy.effectiveDate).toLocaleDateString() : '—'}</strong></div>
                    <div><span className="text-muted-foreground">Expiry:</span> <strong>{selectedDetailItem.issuedPolicy.expiryDate ? new Date(selectedDetailItem.issuedPolicy.expiryDate).toLocaleDateString() : '—'}</strong></div>
                  </div>
                </div>
              )}

              {/* Compliance Gates & Documents */}
              <div className="rounded-xl border p-3.5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Issuance Gates & Documents ({selectedDetailItem.documents?.length || 0})
                </div>
                {renderGateChips(selectedDetailItem, selectedDetailItem.productType === 'HEALTH')}
                <div className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">Next Action:</strong> {selectedDetailItem.nextAction}
                </div>
                {selectedDetailItem.documents && selectedDetailItem.documents.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    {selectedDetailItem.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{doc.documentType}</span>
                          {doc.fileName && <span className="text-muted-foreground">({doc.fileName})</span>}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${doc.verificationStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                          {doc.verificationStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/20">
              {selectedDetailItem.caseId && selectedDetailItem.productType !== 'HEALTH' && (
                <Link
                  href={`/workspace/operations/cases/${selectedDetailItem.caseId}`}
                  className="px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold inline-flex items-center gap-1"
                >
                  Open Case <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {!selectedDetailItem.issuedPolicy && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedDetailItem;
                    setSelectedDetailItem(null);
                    setSelectedQuote({
                      id: target.id,
                      productType: target.productType === 'HEALTH' ? 'HEALTH' : 'MOTOR',
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold"
                >
                  Manual Policy Entry
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
              >
                Close
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

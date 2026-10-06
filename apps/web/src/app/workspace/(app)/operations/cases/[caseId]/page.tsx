'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../../../../lib/api-client';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Layers,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  Wallet,
  XCircle,
  AlertTriangle,
  PlayCircle,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const caseId = params?.caseId as string;

  const [activeTab, setActiveTab] = useState<
    | 'OVERVIEW'
    | 'CUSTOMER_VEHICLE'
    | 'PROPOSAL_QUOTES'
    | 'DOCUMENTS'
    | 'INSPECTION'
    | 'PAYMENT_GATES'
    | 'AUDIT_LOG'
  >('OVERVIEW');

  // Command modal state
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [commandReason, setCommandReason] = useState('');

  // Inspection modal state
  const [inspectionModal, setInspectionModal] = useState<'REJECT' | 'WAIVE' | null>(null);
  const [inspectionReason, setInspectionReason] = useState('');

  // 1. Fetch case details
  const {
    data: caseData,
    isLoading: isLoadingCase,
    refetch: refetchCase,
  } = useQuery({
    queryKey: ['case-detail', caseId],
    queryFn: async () => {
      const res = await apiClient.get(`/motor/quotation-cases/${caseId}`);
      return res.data;
    },
    enabled: Boolean(caseId),
    staleTime: 10_000,
  });

  // 2. Fetch available commands
  const {
    data: availableCommandsData,
    isLoading: isLoadingCommands,
    refetch: refetchCommands,
  } = useQuery({
    queryKey: ['case-available-commands', caseId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/motor/quotation-cases/${caseId}/available-commands`,
      );
      return res.data?.availableCommands || [];
    },
    enabled: Boolean(caseId),
    staleTime: 5_000,
  });

  // 3. Command execution mutation
  const commandMutation = useMutation({
    mutationFn: async ({
      command,
      reason,
    }: {
      command: string;
      reason?: string;
    }) => {
      const res = await apiClient.post(
        `/motor/quotation-cases/${caseId}/command`,
        {
          command,
          reason: reason || undefined,
        },
      );
      return res.data;
    },
    onSuccess: (data, vars) => {
      toast.success(`Domain Command '${vars.command}' executed successfully.`);
      setSelectedCommand(null);
      setCommandReason('');
      void queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      void queryClient.invalidateQueries({
        queryKey: ['case-available-commands', caseId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['backoffice-task-queue'],
      });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to execute domain command',
      );
    },
  });

  // 4. Fetch inspection details for selected quote
  const quotationId = caseData?.selectedQuoteId;
  const {
    data: inspectionData,
    isLoading: isLoadingInspection,
    refetch: refetchInspection,
  } = useQuery({
    queryKey: ['case-inspection', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      try {
        const res = await apiClient.get(`/motor/inspections/${quotationId}`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(quotationId),
    staleTime: 10_000,
  });

  // 5. Inspection underwriter decision mutations
  const approveInspectionMutation = useMutation({
    mutationFn: async (inspId: string) => {
      const res = await apiClient.post(
        `/motor/inspections/${inspId}/approve`,
        {},
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success(
        'Inspection approved successfully! Issuance gate cleared.',
      );
      void queryClient.invalidateQueries({
        queryKey: ['case-inspection', quotationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      void queryClient.invalidateQueries({
        queryKey: ['case-available-commands', caseId],
      });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to approve inspection',
      );
    },
  });

  const rejectInspectionMutation = useMutation({
    mutationFn: async ({
      inspId,
      reason,
    }: {
      inspId: string;
      reason: string;
    }) => {
      const res = await apiClient.post(
        `/motor/inspections/${inspId}/reject`,
        { reason },
      );
      return res.data;
    },
    onSuccess: () => {
      toast.warning('Inspection rejected. Rework requested from agent.');
      setInspectionModal(null);
      setInspectionReason('');
      void queryClient.invalidateQueries({
        queryKey: ['case-inspection', quotationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      void queryClient.invalidateQueries({
        queryKey: ['case-available-commands', caseId],
      });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to reject inspection',
      );
    },
  });

  const waiveInspectionMutation = useMutation({
    mutationFn: async ({
      inspId,
      reason,
    }: {
      inspId: string;
      reason: string;
    }) => {
      const res = await apiClient.post(
        `/motor/inspections/${inspId}/waive`,
        { reason },
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success('Inspection waived by underwriter override.');
      setInspectionModal(null);
      setInspectionReason('');
      void queryClient.invalidateQueries({
        queryKey: ['case-inspection', quotationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      void queryClient.invalidateQueries({
        queryKey: ['case-available-commands', caseId],
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to waive inspection');
    },
  });

  // 6. Payment & 6-Gate Issuance Queries & Mutations
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'UPI',
    referenceNumber: '',
    status: 'PAID' as 'PAID' | 'UNDER_PROCESS',
    notes: '',
  });

  const [issuePolicyModalOpen, setIssuePolicyModalOpen] = useState(false);
  const [issuePolicyForm, setIssuePolicyForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    actualPolicyNumber: '',
    nomineeName: '',
    nomineeRelation: 'Spouse',
  });

  const {
    data: workflowProjection,
    isLoading: isLoadingProjection,
  } = useQuery({
    queryKey: ['case-workflow-projection', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      try {
        const res = await apiClient.get(`/motor/quotations/${quotationId}/workflow-projection`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(quotationId),
    staleTime: 5_000,
  });

  const {
    data: paymentRecord,
    isLoading: isLoadingPayment,
  } = useQuery({
    queryKey: ['case-payment-record', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      try {
        const res = await apiClient.get(`/motor/quotations/${quotationId}/payment`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(quotationId),
    staleTime: 5_000,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      paymentMethod: string;
      referenceNumber: string;
      status: 'PAID' | 'UNDER_PROCESS';
      notes?: string;
    }) => {
      const res = await apiClient.post(`/motor/quotations/${quotationId}/payment`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully.');
      setRecordPaymentModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['case-payment-record', quotationId] });
      void queryClient.invalidateQueries({ queryKey: ['case-workflow-projection', quotationId] });
      void queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      void queryClient.invalidateQueries({ queryKey: ['case-available-commands', caseId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    },
  });

  const issuePolicyMutation = useMutation({
    mutationFn: async (payload: {
      startDate: string;
      endDate: string;
      actualPolicyNumber?: string;
      nomineeName?: string;
      nomineeRelation?: string;
    }) => {
      const res = await apiClient.post(`/motor/quotes/${quotationId}/issue`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Policy issued successfully! Policy No: ${data?.policyNumber || 'Active'}`);
      setIssuePolicyModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['case-workflow-projection', quotationId] });
      void queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      void queryClient.invalidateQueries({ queryKey: ['case-available-commands', caseId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to issue policy');
    },
  });

  if (isLoadingCase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">
          Loading Case Workspace {caseId}...
        </p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center space-y-4 max-w-lg mx-auto mt-12">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-foreground">
          Quotation Case Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          The requested quotation case does not exist or you do not have tenant
          permissions to view it.
        </p>
        <Link
          href="/workspace/operations?tab=verification"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Operations Hub</span>
        </Link>
      </div>
    );
  }

  const customerSnapshot = caseData.customerSnapshot || {};
  const vehicleSnapshot = caseData.vehicleSnapshot || {};
  const selectedQuote = caseData.selectedQuote;
  const quotes = caseData.quotations || [];
  const documents = caseData.documents || [];
  const status = caseData.status;

  const availableCommands: string[] = availableCommandsData || [];

  // Helper for status styling
  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case 'ISSUED':
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
      case 'READY_FOR_ISSUANCE':
      case 'DOCUMENTS_VERIFIED':
      case 'PAYMENT_VERIFIED':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      case 'SUBMITTED_FOR_REVIEW':
      case 'BACK_OFFICE_REVIEW':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
      case 'INSPECTION_REQUIRED':
      case 'INSPECTION_SUBMITTED':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
      case 'REWORK_REQUIRED':
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30';
    }
  };

  const tabs = [
    {
      id: 'OVERVIEW',
      label: 'Overview & Gates',
      icon: <Layers className="h-3.5 w-3.5" />,
    },
    {
      id: 'CUSTOMER_VEHICLE',
      label: 'Customer & Vehicle',
      icon: <Car className="h-3.5 w-3.5" />,
    },
    {
      id: 'PROPOSAL_QUOTES',
      label: 'Selected Proposal & Quotes',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      badge: quotes.length,
    },
    {
      id: 'DOCUMENTS',
      label: 'Document Vault',
      icon: <FileText className="h-3.5 w-3.5" />,
      badge: documents.length,
    },
    {
      id: 'INSPECTION',
      label: 'Break-in Inspection',
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
    },
    {
      id: 'PAYMENT_GATES',
      label: 'Payment & 6-Gates',
      icon: <Wallet className="h-3.5 w-3.5" />,
    },
    {
      id: 'AUDIT_LOG',
      label: 'Timeline & Audit',
      icon: <History className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/workspace/operations?tab=verification"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Operations Queue</span>
        </Link>
        <button
          onClick={() => {
            void refetchCase();
            void refetchCommands();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold shadow-xs transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Case Header Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-base font-extrabold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                {caseData.caseCode}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase border ${getStatusBadgeClass(
                  status,
                )}`}
              >
                {status}
              </span>
              <span className="text-xs text-muted-foreground">
                Category:{' '}
                <strong className="text-foreground">{caseData.category}</strong>
              </span>
              <span className="text-xs text-muted-foreground">
                Vehicle:{' '}
                <strong className="text-foreground">
                  {caseData.vehicleStatus}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-1">
              <span>
                Customer:{' '}
                <strong className="text-foreground">
                  {customerSnapshot.name ||
                    `${caseData.contact?.firstName || ''} ${caseData.contact?.lastName || ''}`.trim() ||
                    'Unknown Customer'}
                </strong>
              </span>
              {caseData.registrationNumber && (
                <span>
                  Reg No:{' '}
                  <strong className="font-mono text-foreground font-black">
                    {caseData.registrationNumber}
                  </strong>
                </span>
              )}
              {caseData.lead && (
                <Link
                  href={`/crm/leads/${caseData.lead.id}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <span>Lead: {caseData.lead.leadCode}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <span>
                Created:{' '}
                {new Date(caseData.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Winning Proposal Badge if selected */}
          {selectedQuote && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Winning Proposal
                </span>
                <span className="font-bold text-xs text-foreground block">
                  {selectedQuote.insurerName}
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ₹
                  {Number(
                    selectedQuote.totalPremium || 0,
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Authoritative Command Action Bar */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Available Actions:</span>
            </span>
            {availableCommands.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                No commands currently available for this role in status &apos;{status}&apos;
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {availableCommands.map((cmd) => {
                  const isDestructive =
                    cmd === 'REJECT_CASE' ||
                    cmd === 'CANCEL_CASE' ||
                    cmd === 'REQUEST_REWORK';
                  const isSuccess =
                    cmd === 'AUTHORIZE_ISSUANCE' ||
                    cmd === 'VERIFY_DOCUMENTS' ||
                    cmd === 'VERIFY_PAYMENT' ||
                    cmd === 'APPROVE_INSPECTION';

                  return (
                    <button
                      key={cmd}
                      onClick={() => {
                        setSelectedCommand(cmd);
                        setCommandReason('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                        isDestructive
                          ? 'bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border border-rose-500/30'
                          : isSuccess
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>{cmd.replace(/_/g, ' ')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/30 rounded-xl space-x-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-card text-foreground font-black shadow-xs border border-border'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT PANELS */}

      {/* TAB 1: OVERVIEW & GATES */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Proposal Selection Status
              </span>
              <div className="flex items-center gap-2">
                {selectedQuote ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <div className="font-bold text-xs text-foreground">
                        {selectedQuote.insurerName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {selectedQuote.quotationCode}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      No Winning Quote Selected Yet
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Underwriting & Documents Gate
              </span>
              <div className="flex items-center gap-2">
                {status === 'DOCUMENTS_VERIFIED' ||
                status === 'READY_FOR_ISSUANCE' ||
                status === 'ISSUED' ||
                status === 'COMPLETED' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">
                      Documents & KYC Fully Verified
                    </span>
                  </>
                ) : status === 'BACK_OFFICE_REVIEW' ||
                  status === 'SUBMITTED_FOR_REVIEW' ? (
                  <>
                    <Clock className="h-5 w-5 text-purple-600 animate-pulse" />
                    <span className="text-xs font-bold text-purple-700">
                      Under Review by Back Office
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      Pending Proposal Submission
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Issuance Clearance
              </span>
              <div className="flex items-center gap-2">
                {status === 'ISSUED' || status === 'COMPLETED' ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">
                      Policy Authoritatively Issued
                    </span>
                  </>
                ) : status === 'READY_FOR_ISSUANCE' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-bold text-blue-700">
                      Cleared for Final Issuance
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      Awaiting Upstream Gates
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Canonical 19-State Progression Summary */}
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span>Canonical 19-State Domain Lifecycle Progress</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Underlying case state strictly advances via server-authoritative
              commands with separation of duties (WF-009).
            </p>
            <div className="p-3 rounded-xl bg-muted/20 border font-mono text-xs flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Current State:</span>
              <span
                className={`px-2 py-0.5 rounded font-black border ${getStatusBadgeClass(
                  status,
                )}`}
              >
                {status}
              </span>
              <span className="text-muted-foreground">• Case Code:</span>
              <span className="font-bold text-foreground">
                {caseData.caseCode}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER & VEHICLE */}
      {activeTab === 'CUSTOMER_VEHICLE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">
                Customer & KYC Baseline
              </h3>
            </div>
            <div className="space-y-2 text-xs divide-y">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-bold text-foreground">
                  {customerSnapshot.name ||
                    `${caseData.contact?.firstName || ''} ${caseData.contact?.lastName || ''}`.trim() ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Mobile Phone:</span>
                <span className="font-mono text-foreground">
                  {customerSnapshot.phone || caseData.contact?.phone || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Email Address:</span>
                <span className="font-mono text-foreground">
                  {customerSnapshot.email || caseData.contact?.email || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Contact Code:</span>
                <span className="font-mono text-foreground">
                  {caseData.contact?.contactCode || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Address / City:</span>
                <span className="text-foreground">
                  {customerSnapshot.city || caseData.contact?.city || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Car className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">
                Vehicle Technical Baseline
              </h3>
            </div>
            <div className="space-y-2 text-xs divide-y">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">
                  Registration Number:
                </span>
                <span className="font-mono font-black text-foreground px-2 py-0.5 bg-muted rounded">
                  {caseData.registrationNumber || 'NEW_VEHICLE'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Make & Model:</span>
                <span className="font-bold text-foreground">
                  {[vehicleSnapshot.make, vehicleSnapshot.model]
                    .filter(Boolean)
                    .join(' ') ||
                    caseData.vehicle?.model ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-semibold text-foreground">
                  {caseData.category}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Fuel Type:</span>
                <span className="text-foreground">
                  {vehicleSnapshot.fuelType ||
                    caseData.vehicle?.fuelType ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">
                  Manufacturing Year:
                </span>
                <span className="text-foreground">
                  {vehicleSnapshot.manufacturingYear ||
                    caseData.vehicle?.manufacturingYear ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Engine Number:</span>
                <span className="font-mono text-foreground">
                  {vehicleSnapshot.engineNumber ||
                    caseData.vehicle?.engineNumber ||
                    '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Chassis Number:</span>
                <span className="font-mono text-foreground">
                  {vehicleSnapshot.chassisNumber ||
                    caseData.vehicle?.chassisNumber ||
                    '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROPOSAL & QUOTES */}
      {activeTab === 'PROPOSAL_QUOTES' && (
        <div className="space-y-4">
          {selectedQuote ? (
            <div className="rounded-2xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-foreground">
                    Selected Winning Proposal Breakdown
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-300">
                  {selectedQuote.quotationCode}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                    Insurer Partner
                  </span>
                  <span className="font-black text-sm text-foreground">
                    {selectedQuote.insurerName}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                    IDV (Insured Value)
                  </span>
                  <span className="font-black text-sm text-foreground">
                    ₹{Number(selectedQuote.sumInsured || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                    NCB Slab
                  </span>
                  <span className="font-black text-sm text-foreground">
                    {selectedQuote.ncbPercentage || 0}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-emerald-700 text-[10px] uppercase font-bold block">
                    Payable Final Premium
                  </span>
                  <span className="font-black text-base text-emerald-700 dark:text-emerald-300">
                    ₹{Number(selectedQuote.totalPremium || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
              No winning quotation currently selected for this case.
            </div>
          )}

          {/* All Quotes Comparison */}
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <h4 className="font-bold text-sm text-foreground">
              All Quotes Captured ({quotes.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-2.5 font-bold">Quote Code</th>
                    <th className="p-2.5 font-bold">Insurer</th>
                    <th className="p-2.5 font-bold">Policy Type</th>
                    <th className="p-2.5 font-bold">IDV</th>
                    <th className="p-2.5 font-bold">Final Premium</th>
                    <th className="p-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quotes.map((q: any) => (
                    <tr
                      key={q.id}
                      className={
                        q.id === caseData.selectedQuoteId
                          ? 'bg-emerald-500/5 font-semibold'
                          : ''
                      }
                    >
                      <td className="p-2.5 font-mono">{q.quotationCode}</td>
                      <td className="p-2.5 font-bold">{q.insurerName}</td>
                      <td className="p-2.5">{q.policyType}</td>
                      <td className="p-2.5">
                        ₹{Number(q.sumInsured || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5 font-black text-emerald-600">
                        ₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5">
                        {q.id === caseData.selectedQuoteId ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700">
                            Selected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                            {q.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENT VAULT */}
      {activeTab === 'DOCUMENTS' && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              <span>Case Document Vault ({documents.length})</span>
            </h3>
          </div>
          {documents.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              No documents uploaded to this case vault yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map((doc: any) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block">
                      {doc.documentType}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Doc ID: {doc.documentId}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      doc.verificationStatus === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : doc.verificationStatus === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {doc.verificationStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: INSPECTION */}
      {activeTab === 'INSPECTION' && (
        <div className="rounded-2xl border bg-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-sm text-foreground">
                  7-Photo Mandatory Break-in Inspection Pipeline (INSP-006)
                </h3>
                {inspectionData ? (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      inspectionData.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inspectionData.status === 'WAIVED'
                        ? 'bg-purple-100 text-purple-800'
                        : inspectionData.status === 'SUBMITTED_FOR_REVIEW'
                        ? 'bg-blue-100 text-blue-800'
                        : inspectionData.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {inspectionData.status}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                    NO INSPECTION RECORD
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Authoritative 7-slot photo evidence pipeline with SHA-256 provenance
                tracking and Separation of Duties underwriter approval.
              </p>
            </div>

            {/* Underwriter Decision Actions */}
            {inspectionData && (
              <div className="flex items-center gap-2">
                {inspectionData.status === 'SUBMITTED_FOR_REVIEW' && (
                  <>
                    <button
                      onClick={() => setInspectionModal('REJECT')}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 font-bold text-xs hover:bg-rose-500/20 transition"
                    >
                      Reject Inspection
                    </button>
                    <button
                      onClick={() => setInspectionModal('WAIVE')}
                      className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 font-bold text-xs hover:bg-purple-500/20 transition"
                    >
                      Waive Inspection
                    </button>
                    <button
                      disabled={approveInspectionMutation.isPending}
                      onClick={() =>
                        approveInspectionMutation.mutate(inspectionData.id)
                      }
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50"
                    >
                      {approveInspectionMutation.isPending
                        ? 'Approving...'
                        : 'Approve Inspection'}
                    </button>
                  </>
                )}
                {inspectionData.status === 'COMPLETED' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Cleared by Underwriter
                  </span>
                )}
                {inspectionData.status === 'WAIVED' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-purple-600">
                    <FileCheck2 className="h-4 w-4" /> Waived ({inspectionData.waiverReason || 'Underwriter Override'})
                  </span>
                )}
                {inspectionData.status === 'REJECTED' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
                    <XCircle className="h-4 w-4" /> Rework Requested: {inspectionData.rejectionReason}
                  </span>
                )}
              </div>
            )}
          </div>

          {isLoadingInspection ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading inspection aggregate and provenance data...</span>
            </div>
          ) : !inspectionData ? (
            <div className="p-4 rounded-xl border bg-muted/20 text-xs text-muted-foreground">
              No break-in inspection aggregate found for selected quotation ({caseData?.selectedQuoteId || 'None'}).
            </div>
          ) : (
            <>
              {/* Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl border bg-card space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Inspection Code
                  </span>
                  <div className="font-mono font-bold text-foreground">
                    {inspectionData.inspectionCode}
                  </div>
                </div>
                <div className="p-3 rounded-xl border bg-card space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Conducted By
                  </span>
                  <div className="font-semibold text-foreground">
                    {inspectionData.conductedByType || 'JEST_TEAM'}
                  </div>
                </div>
                <div className="p-3 rounded-xl border bg-card space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Inspector
                  </span>
                  <div className="font-semibold text-foreground">
                    {inspectionData.inspectorName || 'Assigned Officer'}
                  </div>
                </div>
                <div className="p-3 rounded-xl border bg-card space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Evidence Slots
                  </span>
                  <div className="font-bold text-emerald-600">
                    {7 - (inspectionData.missingPhotos?.length || 0)} / 7 Uploaded
                  </div>
                </div>
              </div>

              {/* 7 Photo Evidence Slots Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  7-Photo Provenance Vault
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {[
                    { slot: 'front', label: 'Front View', key: 'frontImageKey' },
                    { slot: 'back', label: 'Rear View', key: 'backImageKey' },
                    { slot: 'left', label: 'Left Side', key: 'leftImageKey' },
                    { slot: 'right', label: 'Right Side', key: 'rightImageKey' },
                    { slot: 'windshield', label: 'Windshield Glass', key: 'windshieldImageKey' },
                    { slot: 'chassis', label: 'Chassis Number Plate', key: 'chassisImageKey' },
                    { slot: 'odometer', label: 'Odometer Cluster', key: 'odometerImageKey' },
                  ].map(({ slot, label, key }) => {
                    const storageKey = (inspectionData as any)[key];
                    const provenance = inspectionData.photoProvenance?.[slot];
                    const isUploaded = Boolean(storageKey || provenance?.storageKey);
                    const hash = provenance?.sha256;

                    return (
                      <div
                        key={slot}
                        className={`p-3.5 rounded-xl border space-y-2 transition ${
                          isUploaded
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-border bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">
                            {label}
                          </span>
                          {isUploaded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> Uploaded
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600">
                              Missing
                            </span>
                          )}
                        </div>

                        {isUploaded ? (
                          <div className="space-y-1 font-mono text-[10px]">
                            <div className="text-muted-foreground truncate" title={storageKey || provenance?.storageKey}>
                              Key: {storageKey || provenance?.storageKey}
                            </div>
                            {hash ? (
                              <div
                                className="px-2 py-1 rounded bg-background border text-[9px] text-primary font-bold truncate"
                                title={`SHA-256 Provenance Hash: ${hash}`}
                              >
                                SHA-256: {hash.slice(0, 16)}...
                              </div>
                            ) : (
                              <div className="text-[9px] text-muted-foreground italic">
                                Provenance hash pending
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground italic">
                            Evidence photograph required
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 6: PAYMENT & 6-GATES */}
      {activeTab === 'PAYMENT_GATES' && (
        <div className="space-y-6">
          {/* Financial Ledger & Payment Reconciliation Card (PAY-001 & PAY-002) */}
          <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Financial Ledger & Payment Reconciliation (PAY-001 / PAY-002)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Exact decimal match verification and multi-tenant payment records
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {paymentRecord?.status === 'PAID' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>PAID & RECONCILED</span>
                  </span>
                ) : paymentRecord?.status === 'UNDER_PROCESS' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    <span>PAYMENT UNDER PROCESS</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>PAYMENT PENDING</span>
                  </span>
                )}

                <button
                  onClick={() => {
                    setPaymentForm({
                      amount: selectedQuote?.totalPremium ? String(selectedQuote.totalPremium) : '',
                      paymentMethod: 'UPI',
                      referenceNumber: '',
                      status: 'PAID',
                      notes: '',
                    });
                    setRecordPaymentModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition flex items-center gap-1.5"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Record / Verify Payment</span>
                </button>
              </div>
            </div>

            {/* Financial Ledger Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Authoritative Premium
                </span>
                <div className="font-black text-foreground text-sm">
                  ₹{Number(selectedQuote?.totalPremium || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Amount Reconciled
                </span>
                <div className={`font-black text-sm ${paymentRecord?.status === 'PAID' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  ₹{Number(paymentRecord?.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Payment Method
                </span>
                <div className="font-semibold text-foreground">
                  {paymentRecord?.paymentMethod || '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Bank Reference / UTR
                </span>
                <div className="font-mono text-xs font-bold text-foreground truncate" title={paymentRecord?.referenceNumber || ''}>
                  {paymentRecord?.referenceNumber || '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Settlement Date
                </span>
                <div className="font-medium text-foreground">
                  {paymentRecord?.paidAt
                    ? new Date(paymentRecord.paidAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Reconciliation Status
                </span>
                <div className="font-bold">
                  {paymentRecord?.status === 'PAID' ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Exact Match (₹0 diff)
                    </span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Authoritative 6-Gate Issuance Engine (PAY-003) */}
          <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Authoritative 6-Gate Issuance Engine (PAY-003)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Pre-issuance underwriting compliance checklist computed server-authoritatively
                  </p>
                </div>
              </div>

              <div>
                {workflowProjection?.canIssue ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>All 6 Gates Cleared — Ready for Issuance</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>
                      {6 - (workflowProjection?.blockingReasons?.length || 0)} / 6 Gates Passed
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Blockers alert if any */}
            {workflowProjection?.blockingReasons && workflowProjection.blockingReasons.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-1.5">
                <div className="font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>The following underwriting gates are pending:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-200 pl-1">
                  {workflowProjection.blockingReasons.map((reason: string, i: number) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* The 6 Canonical Gates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                {
                  id: 1,
                  name: 'GATE 1: Calculation & Tariff Snapshot Valid',
                  desc: 'Tariff rules evaluated, premium non-zero, and calculation snapshot cryptographically sealed.',
                  passed: Boolean(workflowProjection?.blockingGates?.calculationValid),
                  detail: workflowProjection?.meta?.totalPremium
                    ? `Premium: ₹${Number(workflowProjection.meta.totalPremium).toLocaleString('en-IN')}`
                    : 'Calculation pending',
                },
                {
                  id: 2,
                  name: 'GATE 2: Customer KYC Verified',
                  desc: 'Customer PAN or corporate KYC verified against statutory databases.',
                  passed: Boolean(workflowProjection?.blockingGates?.kycVerified),
                  detail: `KYC Status: ${workflowProjection?.meta?.kycStatus || 'VERIFIED'}`,
                },
                {
                  id: 3,
                  name: 'GATE 3: Vehicle Inspection Cleared',
                  desc: 'Break-in inspection completed with 7-photo evidence or formally waived by underwriter.',
                  passed: Boolean(workflowProjection?.blockingGates?.inspectionCleared),
                  detail: `Inspection Status: ${workflowProjection?.meta?.inspectionStatus || 'COMPLETED / WAIVED'}`,
                },
                {
                  id: 4,
                  name: 'GATE 4: Insurance Proposal Approved',
                  desc: 'Proposal signed and accepted by underwriting with immutable risk terms.',
                  passed: Boolean(workflowProjection?.blockingGates?.proposalApproved),
                  detail: 'Terms & schedules verified',
                },
                {
                  id: 5,
                  name: 'GATE 5: Payment Reconciled (Exact INR)',
                  desc: 'Exact decimal match between customer payment UTR and authoritative quotation premium.',
                  passed: Boolean(workflowProjection?.blockingGates?.paymentVerified),
                  detail: workflowProjection?.meta?.paidAmount
                    ? `Paid ₹${Number(workflowProjection.meta.paidAmount).toLocaleString('en-IN')} / ₹${Number(workflowProjection?.meta?.totalPremium || 0).toLocaleString('en-IN')}`
                    : 'Payment verification pending',
                },
                {
                  id: 6,
                  name: 'GATE 6: Mandatory Documents Verified',
                  desc: 'RC copy, previous policy, and customer identity documents signed off by Back Office.',
                  passed: Boolean(workflowProjection?.blockingGates?.documentsVerified),
                  detail: 'All mandatory documents verified',
                },
              ].map((gate) => (
                <div
                  key={gate.id}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                    gate.passed
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  {gate.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{gate.name}</span>
                      <span className={`text-[10px] font-bold ${gate.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {gate.passed ? 'PASSED' : 'PENDING'}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {gate.desc}
                    </p>
                    <div className="text-[10px] font-mono text-muted-foreground pt-0.5">
                      {gate.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Policy Issuance Action Banner */}
            <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-4">
              <div>
                {status === 'ISSUED' || workflowProjection?.meta?.policyNumber ? (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Policy In Force: {workflowProjection?.meta?.policyNumber || 'ISSUED'}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      This policy has been officially issued and registered in the core insurance registry.
                    </p>
                  </div>
                ) : workflowProjection?.canIssue ? (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>All 6 Underwriting Gates Passed</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Authoritative checks complete. Ready for instant policy numbering and activation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Issuance Gate Guard Active</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Policy issuance is strictly locked until all 6 underwriting gates pass server verification.
                    </p>
                  </div>
                )}
              </div>

              <div>
                {status === 'ISSUED' || workflowProjection?.meta?.policyNumber ? (
                  <button
                    onClick={() => {
                      toast.info(`Policy document download ready: ${workflowProjection?.meta?.policyNumber || 'Active'}`);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-xs"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Download Policy Document</span>
                  </button>
                ) : (
                  <button
                    disabled={!workflowProjection?.canIssue || issuePolicyMutation.isPending}
                    onClick={() => {
                      setIssuePolicyModalOpen(true);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs ${
                      workflowProjection?.canIssue
                        ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                        : 'bg-muted-foreground/30 cursor-not-allowed'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Issue Policy Now (PAY-003)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: TIMELINE & AUDIT LOG */}
      {activeTab === 'AUDIT_LOG' && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <History className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              Chronological Audit Trail & State Transitions
            </h3>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border text-xs space-y-2">
            <div className="font-bold text-foreground">
              Current Lifecycle State: {status}
            </div>
            <div className="text-muted-foreground">
              Every domain command emitted on this case is recorded in the
              transactional outbox with actor context and timestamp.
            </div>
          </div>
        </div>
      )}

      {/* Command Confirmation Modal */}
      {selectedCommand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" />
                <span>Execute Command: {selectedCommand.replace(/_/g, ' ')}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                This domain command will transition the case lifecycle in accordance
                with authoritative state machine rules.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Reason / Internal Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={commandReason}
                onChange={(e) => setCommandReason(e.target.value)}
                placeholder="Enter any justification or audit context..."
                className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setSelectedCommand(null);
                  setCommandReason('');
                }}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={commandMutation.isPending}
                onClick={() =>
                  commandMutation.mutate({
                    command: selectedCommand,
                    reason: commandReason,
                  })
                }
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 transition disabled:opacity-50"
              >
                {commandMutation.isPending
                  ? 'Executing...'
                  : 'Confirm & Transition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Decision Modal (Reject / Waive) */}
      {inspectionModal && inspectionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                {inspectionModal === 'REJECT' ? (
                  <>
                    <XCircle className="h-5 w-5 text-rose-600" />
                    <span>Reject Vehicle Inspection</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="h-5 w-5 text-purple-600" />
                    <span>Waive Vehicle Inspection</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {inspectionModal === 'REJECT'
                  ? 'Specify the rework reason so the agent can upload proper photo evidence.'
                  : 'Specify the underwriting justification for waiving mandatory vehicle break-in inspection.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                {inspectionModal === 'REJECT'
                  ? 'Rejection / Rework Reason (Required)'
                  : 'Underwriting Waiver Justification (Required)'}
              </label>
              <textarea
                rows={3}
                value={inspectionReason}
                onChange={(e) => setInspectionReason(e.target.value)}
                placeholder={
                  inspectionModal === 'REJECT'
                    ? 'e.g. Odometer reading photo is blurry; chassis number is obscured...'
                    : 'e.g. Underwriter inspection waiver granted per renewal continuity policy...'
                }
                className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setInspectionModal(null);
                  setInspectionReason('');
                }}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={
                  !inspectionReason.trim() ||
                  rejectInspectionMutation.isPending ||
                  waiveInspectionMutation.isPending
                }
                onClick={() => {
                  if (inspectionModal === 'REJECT') {
                    rejectInspectionMutation.mutate({
                      inspId: inspectionData.id,
                      reason: inspectionReason.trim(),
                    });
                  } else {
                    waiveInspectionMutation.mutate({
                      inspId: inspectionData.id,
                      reason: inspectionReason.trim(),
                    });
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition disabled:opacity-50 ${
                  inspectionModal === 'REJECT'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {rejectInspectionMutation.isPending ||
                waiveInspectionMutation.isPending
                  ? 'Processing...'
                  : inspectionModal === 'REJECT'
                  ? 'Confirm Rejection'
                  : 'Confirm Waiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record / Verify Payment Modal */}
      {recordPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span>Record & Verify Payment (PAY-001 / PAY-002)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Enter payment details. Authoritative payable premium is ₹{Number(selectedQuote?.totalPremium || 0).toLocaleString('en-IN')}. Exact decimal match required for PAID status.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">
                  Payment Amount (₹ INR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="e.g. 17638.88"
                  className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="NET_BANKING">Net Banking / IMPS</option>
                  <option value="NEFT_RTGS">NEFT / RTGS</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="CASH">Cash / Counter Deposit</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">
                  Bank Reference Number / UTR <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  placeholder="e.g. UTR-HDFC-9988776655"
                  className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">
                  Reconciliation Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentForm.status}
                  onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PAID">PAID (Reconcile & Clear Gate 5)</option>
                  <option value="UNDER_PROCESS">UNDER_PROCESS (Awaiting Clearance)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">
                  Internal Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="e.g. Verified with ICICI bank statement on 01-Oct-2026..."
                  className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setRecordPaymentModalOpen(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={
                  !paymentForm.amount ||
                  !paymentForm.referenceNumber.trim() ||
                  recordPaymentMutation.isPending
                }
                onClick={() => {
                  recordPaymentMutation.mutate({
                    amount: parseFloat(paymentForm.amount),
                    paymentMethod: paymentForm.paymentMethod,
                    referenceNumber: paymentForm.referenceNumber.trim(),
                    status: paymentForm.status,
                    notes: paymentForm.notes.trim() || undefined,
                  });
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 transition disabled:opacity-50"
              >
                {recordPaymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Policy Modal (PAY-003) */}
      {issuePolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <span>Issue Insurance Policy (PAY-003)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                All 6 underwriting gates have passed. Policy will be assigned a sequential number and activated in the insurance registry.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">
                    Effective Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={issuePolicyForm.startDate}
                    onChange={(e) => setIssuePolicyForm({ ...issuePolicyForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">
                    Expiry Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={issuePolicyForm.endDate}
                    onChange={(e) => setIssuePolicyForm({ ...issuePolicyForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">
                  Actual Policy Number Override (Optional)
                </label>
                <input
                  type="text"
                  value={issuePolicyForm.actualPolicyNumber}
                  onChange={(e) => setIssuePolicyForm({ ...issuePolicyForm, actualPolicyNumber: e.target.value })}
                  placeholder="Auto-generated sequential (POL-YYYY-XXXXXX) if empty"
                  className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">
                    Nominee Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={issuePolicyForm.nomineeName}
                    onChange={(e) => setIssuePolicyForm({ ...issuePolicyForm, nomineeName: e.target.value })}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">
                    Nominee Relation
                  </label>
                  <select
                    value={issuePolicyForm.nomineeRelation}
                    onChange={(e) => setIssuePolicyForm({ ...issuePolicyForm, nomineeRelation: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setIssuePolicyModalOpen(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={issuePolicyMutation.isPending}
                onClick={() => {
                  issuePolicyMutation.mutate({
                    startDate: issuePolicyForm.startDate,
                    endDate: issuePolicyForm.endDate,
                    actualPolicyNumber: issuePolicyForm.actualPolicyNumber.trim() || undefined,
                    nomineeName: issuePolicyForm.nomineeName.trim() || undefined,
                    nomineeRelation: issuePolicyForm.nomineeRelation,
                  });
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{issuePolicyMutation.isPending ? 'Issuing Policy...' : 'Confirm & Issue Policy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

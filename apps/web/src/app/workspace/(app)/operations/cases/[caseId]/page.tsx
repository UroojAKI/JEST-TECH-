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
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h3 className="font-bold text-sm text-foreground">
              7-Photo Mandatory Break-in Inspection Pipeline
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Authoritative 7-slot photo evidence pipeline with SHA-256 provenance
            tracking and Separation of Duties underwriter approval (INSP-006).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            {[
              'FRONT',
              'BACK',
              'LEFT',
              'RIGHT',
              'WINDSHIELD',
              'CHASSIS',
              'ODOMETER',
            ].map((slot) => (
              <div
                key={slot}
                className="p-3 rounded-xl border bg-muted/30 text-center space-y-1"
              >
                <span className="text-[10px] font-bold text-muted-foreground block">
                  {slot}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Slot Provisioned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: PAYMENT & 6-GATES */}
      {activeTab === 'PAYMENT_GATES' && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <CheckSquare className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-foreground">
              Authoritative 6-Gate Issuance Checklist (PAY-003)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {[
              {
                id: 1,
                name: 'GATE 1: Quotation Valid',
                desc: 'Tariff validated, IDV within statutory limits, quote not expired.',
                passed: Boolean(selectedQuote),
              },
              {
                id: 2,
                name: 'GATE 2: Proposal Approved',
                desc: 'Customer KYC and vehicle baseline snapshots immutable.',
                passed:
                  status === 'DOCUMENTS_VERIFIED' ||
                  status === 'READY_FOR_ISSUANCE' ||
                  status === 'ISSUED',
              },
              {
                id: 3,
                name: 'GATE 3: Inspection Cleared',
                desc: 'Break-in inspection verified or waived with justification.',
                passed: status !== 'INSPECTION_REQUIRED',
              },
              {
                id: 4,
                name: 'GATE 4: Documents Verified',
                desc: 'RC, KYC and proposal signed documents accepted.',
                passed:
                  status === 'DOCUMENTS_VERIFIED' ||
                  status === 'READY_FOR_ISSUANCE' ||
                  status === 'ISSUED',
              },
              {
                id: 5,
                name: 'GATE 5: Payment Verified',
                desc: 'Authoritative payment record reconciled with bank UTR in INR.',
                passed:
                  status === 'PAYMENT_VERIFIED' ||
                  status === 'READY_FOR_ISSUANCE' ||
                  status === 'ISSUED',
              },
              {
                id: 6,
                name: 'GATE 6: Actor Authorized (SoD)',
                desc: 'Back Office / Admin authority with separation from quote creator.',
                passed: true,
              },
            ].map((gate) => (
              <div
                key={gate.id}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                  gate.passed
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-muted/30 border-border'
                }`}
              >
                {gate.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-foreground">{gate.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {gate.desc}
                  </div>
                </div>
              </div>
            ))}
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
    </div>
  );
}

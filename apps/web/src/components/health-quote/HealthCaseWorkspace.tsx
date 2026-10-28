'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  HeartPulse,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { apiClient } from '../../lib/api-client';
import { healthApiError, healthQuotationRepository } from '../../repositories/health-quotation.repository';
import {
  NOMINEE_RELATIONS,
  PLAN_CATEGORIES,
  POLICY_FORMS,
  RELATIONS,
  RIDERS,
  TENURES,
  WAITING_PERIODS,
  inr,
  labelOf,
  previewPremium,
} from './healthFormConfig';
import { FieldLabel, YesNo, inputCls } from './HealthFields';

type RiderLine = { rider: string; sumInsured: string; premium: string };

const statusStyle: Record<string, string> = {
  MISSING: 'bg-rose-500/10 text-rose-600',
  UPLOADED: 'bg-amber-500/10 text-amber-600',
  VERIFIED: 'bg-emerald-500/10 text-emerald-600',
};

/** Hidden file input + button; uploads then attaches the file to the case / quote. */
function UploadButton({ label, onFile, busy }: { label: string; onFile: (file: File) => void; busy: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-bold hover:bg-accent disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        {label}
      </button>
    </>
  );
}

export function HealthCaseWorkspace({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const caseQuery = useQuery({ queryKey: ['health-case', caseId], queryFn: () => healthQuotationRepository.getCase(caseId) });
  const checklistQuery = useQuery({
    queryKey: ['health-checklist', caseId],
    queryFn: () => healthQuotationRepository.getChecklist(caseId),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['health-case', caseId] });
    queryClient.invalidateQueries({ queryKey: ['health-checklist', caseId] });
  };

  const upload = async (key: string, file: File, documentType: string, quotationId?: string) => {
    setUploadingKey(key);
    try {
      await healthQuotationRepository.uploadAndAttach(caseId, file, documentType, quotationId);
      toast.success(`${file.name} uploaded`);
      refresh();
    } catch (err) {
      toast.error(healthApiError(err, 'Upload failed'));
    } finally {
      setUploadingKey(null);
    }
  };

  const user = useAuthStore((s) => s.user);
  const isBackOfficeOrAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'BACK_OFFICE' ||
    Boolean(user?.roles?.includes('ADMIN' as any) || user?.roles?.includes('BACK_OFFICE' as any));

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'UPI',
    referenceNumber: '',
    status: (isBackOfficeOrAdmin ? 'PAID' : 'UNDER_PROCESS') as 'PAID' | 'UNDER_PROCESS',
    notes: '',
  });

  const selectMutation = useMutation({
    mutationFn: (quotationId: string) => healthQuotationRepository.selectQuote(caseId, quotationId),
    onSuccess: () => {
      toast.success('Quote selected');
      refresh();
    },
    onError: (err) => toast.error(healthApiError(err, 'Could not select quote')),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => healthQuotationRepository.recordPayment(caseId, payload),
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      setPaymentModalOpen(false);
      refresh();
    },
    onError: (err) => toast.error(healthApiError(err, 'Failed to record payment')),
  });

  const issuePolicyMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      const res = await apiClient.post(`/back-office/issue/${quotationId}`, {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Health Policy issued successfully! Policy No: ${data?.policy?.policyNumber || data?.policyNumber || 'Active'}`);
      refresh();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to issue health policy');
    },
  });

  const [editDetailsModalOpen, setEditDetailsModalOpen] = useState(false);

  const updateLeftoverMutation = useMutation({
    mutationFn: (payload: any) => healthQuotationRepository.updateLeftoverDetails(caseId, payload),
    onSuccess: () => {
      toast.success('Customer and KYC details updated successfully!');
      setEditDetailsModalOpen(false);
      refresh();
    },
    onError: (err) => {
      toast.error(healthApiError(err, 'Failed to update details'));
    },
  });

  if (caseQuery.isLoading) return <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Health proposal...</div>;
  if (caseQuery.isError || !caseQuery.data) return <div className="p-8 text-center text-xs text-rose-500">Health proposal not found.</div>;

  const hc = caseQuery.data;
  const checklist = checklistQuery.data;
  const canQuote = hc.status === 'OPEN' || hc.status === 'QUOTED';

  const selectedQuote = hc.selectedQuote || hc.quotations?.find((q: any) => q.id === hc.selectedQuoteId);
  const paymentRecord = selectedQuote?.motorPaymentRecord;
  const paymentStatus = paymentRecord?.status || 'NOT_DONE';

  const handleIssuePolicy = (quotationId: string, quoteCode?: string) => {
    const hasPan = Boolean(hc.contact?.panNumber);
    const hasAadhaar = Boolean(hc.contact?.aadhaarNumber);

    if (!hasPan || !hasAadhaar) {
      const missing = !hasPan && !hasAadhaar ? 'PAN and Aadhaar numbers' : !hasPan ? 'PAN number' : 'Aadhaar number';
      toast.error(`Customer ${missing} required before issuing Health policy. Please update leftover KYC entries.`);
      setEditDetailsModalOpen(true);
      return;
    }

    if (confirm(`Confirm issuance of official Health Policy for quotation ${quoteCode || quotationId}?`)) {
      issuePolicyMutation.mutate(quotationId);
    }
  };

  const openPaymentModal = (quote: any) => {
    const prem = quote?.healthMetadata?.premium?.totalPremium ?? quote?.totalPremium ?? 0;
    const existing = quote?.motorPaymentRecord;
    setPaymentForm({
      amount: existing?.amount ? String(existing.amount) : String(prem),
      paymentMethod: existing?.paymentMethod || 'UPI',
      referenceNumber: existing?.referenceNumber || '',
      status: isBackOfficeOrAdmin
        ? (existing?.status === 'PAID' ? 'PAID' : 'PAID')
        : 'UNDER_PROCESS',
      notes: existing?.notes || '',
    });
    setPaymentModalOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="p-5 rounded-2xl border bg-card flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black">{hc.caseCode}</h1>
            <p className="text-xs text-muted-foreground">
              {labelOf(PLAN_CATEGORIES, hc.planCategory)} • {labelOf(POLICY_FORMS, hc.policyForm)} • {hc.contact?.firstName} {hc.contact?.lastName}
              {hc.lead ? ` • ${hc.lead.leadCode}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedQuote && (
            <>
              {selectedQuote.policy ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" /> Policy Issued ({selectedQuote.policy.policyNumber})
                </span>
              ) : paymentStatus === 'PAID' ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Paid & Reconciled
                  </span>
                  {isBackOfficeOrAdmin && (
                    <button
                      type="button"
                      disabled={issuePolicyMutation.isPending}
                      onClick={() => handleIssuePolicy(selectedQuote.id, selectedQuote.quotationCode)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition disabled:opacity-50"
                    >
                      {issuePolicyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Issue Policy
                    </button>
                  )}
                </div>
              ) : paymentStatus === 'UNDER_PROCESS' ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Payment Under Verification
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => openPaymentModal(selectedQuote)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition shadow-sm"
                >
                  <Wallet className="h-3.5 w-3.5" /> Record Payment
                </button>
              )}
            </>
          )}
          <span className="px-3 py-1 rounded-full text-[11px] font-black bg-primary/10 text-primary">{hc.status}</span>
        </div>
      </div>

      {selectedQuote?.policy && (
        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-foreground">Official Health Insurance Policy Active</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                    {selectedQuote.policy.status || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Policy Number:{' '}
                  <Link
                    href={`/policies/${selectedQuote.policy.id}`}
                    className="font-mono text-foreground text-sm font-black hover:text-emerald-600 hover:underline inline-flex items-center gap-1"
                  >
                    {selectedQuote.policy.policyNumber}
                  </Link>
                  {' • '}
                  Insurer: <strong className="text-foreground">{selectedQuote.insurerName}</strong>
                </p>
              </div>
            </div>
            <div className="text-right text-xs bg-card/60 p-2.5 rounded-xl border border-border">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Policy Period</div>
              <div className="font-bold text-foreground">
                {selectedQuote.policy.effectiveDate || selectedQuote.policy.startDate
                  ? new Date(selectedQuote.policy.effectiveDate || selectedQuote.policy.startDate).toLocaleDateString('en-IN')
                  : '—'}{' '}
                to{' '}
                {selectedQuote.policy.expiryDate || selectedQuote.policy.endDate
                  ? new Date(selectedQuote.policy.expiryDate || selectedQuote.policy.endDate).toLocaleDateString('en-IN')
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC Alert Banner when PAN or Aadhaar is missing */}
      {(!hc.contact?.panNumber || !hc.contact?.aadhaarNumber) && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Mandatory KYC Required for Health Policy Issuance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customer {!hc.contact?.panNumber && !hc.contact?.aadhaarNumber ? 'PAN and Aadhaar numbers are missing' : !hc.contact?.panNumber ? 'PAN number is missing' : 'Aadhaar number is missing'}. IRDAI compliance strictly requires verified PAN and Aadhaar before an official health policy can be issued.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditDetailsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Leftover KYC Entries
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Card 1: Proposer & Leftover KYC Details */}
        <div className="p-4 rounded-2xl border bg-card space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-sm flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-primary" />
              Proposer & KYC
            </h2>
            <button
              type="button"
              onClick={() => setEditDetailsModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border bg-muted/40 hover:bg-muted text-[11px] font-bold transition"
            >
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          </div>

          <div className="space-y-0.5">
            <div className="font-bold text-foreground text-sm">
              {hc.contact?.firstName} {hc.contact?.lastName}
            </div>
            <div className="text-muted-foreground text-[11px] flex items-center gap-2 flex-wrap">
              {hc.contact?.phone && <span>📞 {hc.contact.phone}</span>}
              {hc.contact?.email && <span>✉️ {hc.contact.email}</span>}
            </div>
          </div>

          {/* KYC Status Badges */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div
              className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
                hc.contact?.panNumber ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center justify-between">
                <span>PAN</span>
                {hc.contact?.panNumber ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-rose-600" />
                )}
              </div>
              <div className="font-mono font-bold text-xs truncate">
                {hc.contact?.panNumber || <span className="text-rose-500 text-[11px] font-sans">Required</span>}
              </div>
            </div>

            <div
              className={`p-2 rounded-xl border flex flex-col gap-0.5 ${
                hc.contact?.aadhaarNumber ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center justify-between">
                <span>Aadhaar</span>
                {hc.contact?.aadhaarNumber ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-rose-600" />
                )}
              </div>
              <div className="font-mono font-bold text-xs truncate">
                {hc.contact?.aadhaarNumber ? (
                  `•••• ${String(hc.contact.aadhaarNumber).slice(-4)}`
                ) : (
                  <span className="text-rose-500 text-[11px] font-sans">Required</span>
                )}
              </div>
            </div>
          </div>

          {/* Address & Profile Details */}
          <div className="pt-2 border-t space-y-1 text-muted-foreground text-[11px]">
            <div>
              <span className="font-semibold text-foreground">Address:</span>{' '}
              {(hc.addressSnapshot as any)?.line1 || (hc.addressSnapshot as any)?.addressLine1
                ? [
                    (hc.addressSnapshot as any)?.line1 || (hc.addressSnapshot as any)?.addressLine1,
                    (hc.addressSnapshot as any)?.line2 || (hc.addressSnapshot as any)?.addressLine2,
                    (hc.addressSnapshot as any)?.city,
                    (hc.addressSnapshot as any)?.state,
                    (hc.addressSnapshot as any)?.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ')
                : 'Not specified'}
            </div>
            {(hc.occupation || hc.annualIncome) && (
              <div>
                <span className="font-semibold text-foreground">Profile:</span>{' '}
                {[hc.occupation, hc.annualIncome ? inr(hc.annualIncome) : null].filter(Boolean).join(' • ')}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Insured Members */}
        <div className="p-4 rounded-2xl border bg-card space-y-2">
          <h2 className="font-black text-sm">Insured Members ({hc.members.length})</h2>
          {hc.members.map((m: any) => (
            <div key={m.id} className="flex justify-between border-b last:border-0 py-1.5">
              <span className="font-bold">
                {m.firstName} {m.lastName ?? ''} <span className="text-muted-foreground font-normal">({labelOf(RELATIONS, m.relation)})</span>
              </span>
              <span className="text-muted-foreground">
                {String(m.dateOfBirth).slice(0, 10)} • {m.gender} {m.isSmoker ? '• Smoker' : ''}
              </span>
            </div>
          ))}
        </div>

        {/* Card 3: Proposal & Plan Details */}
        <div className="p-4 rounded-2xl border bg-card space-y-1.5">
          <h2 className="font-black text-sm">Proposal</h2>
          <p>
            <span className="text-muted-foreground">Nominee:</span> <b>{hc.nomineeName || 'Not Set'}</b> ({labelOf(NOMINEE_RELATIONS, hc.nomineeRelation)})
          </p>
          {hc.planDetails?.planName && (
            <p>
              <span className="text-muted-foreground">Plan:</span> <b>{hc.planDetails.planName}</b> ({hc.planDetails.uin})
            </p>
          )}
          {hc.planDetails?.sumInsured && (
            <p>
              <span className="text-muted-foreground">Sum insured:</span> <b>{inr(hc.planDetails.sumInsured)}</b>
            </p>
          )}
          {hc.planDetails?.derived && (
            <p>
              <span className="text-muted-foreground">Eldest age:</span> <b>{hc.planDetails.derived.eldestMemberAge}</b>
              {' • '}
              <span className="text-muted-foreground">Pre-existing disease:</span> <b>{hc.planDetails.derived.anyPreExistingDisease ? 'Yes' : 'No'}</b>
            </p>
          )}
          {(hc.planDetails?.warnings ?? []).map((w: string) => (
            <p key={w} className="text-amber-600 font-bold">
              ⚠ {w}
            </p>
          ))}
        </div>
      </div>

      <div className="p-5 rounded-2xl border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-sm">Quotes ({hc.quotations.length})</h2>
          {canQuote && !showQuoteForm && (
            <button
              type="button"
              onClick={() => setShowQuoteForm(true)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
            >
              <Plus className="h-4 w-4" /> Add Quote
            </button>
          )}
        </div>

        {showQuoteForm && (
          <AddQuoteForm
            healthCase={hc}
            onCancel={() => setShowQuoteForm(false)}
            onSaved={() => {
              setShowQuoteForm(false);
              refresh();
            }}
          />
        )}

        {hc.quotations.length === 0 && !showQuoteForm && (
          <div className="p-8 rounded-xl border border-dashed text-center space-y-3 bg-muted/10">
            <div className="p-3 rounded-full bg-primary/10 text-primary w-fit mx-auto">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Insurer Quotes Added Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Proposal case <b>{hc.caseCode}</b> is registered. In Health Insurance, brokers add one or more quotes from insurers (e.g. Star Health, HDFC ERGO, Care Health, Niva Bupa) to compare premiums and riders.
              </p>
            </div>
            {canQuote && (
              <button
                type="button"
                onClick={() => setShowQuoteForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add First Insurer Quote
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hc.quotations.map((q: any) => {
            const p = q.healthMetadata?.premium ?? {};
            const files = (checklist?.quoteDocuments ?? []).filter((d: any) => d.quotationId === q.id);
            const selected = hc.selectedQuoteId === q.id;
            return (
              <div key={q.id} className={`p-4 rounded-xl border space-y-2 text-xs ${selected ? 'border-emerald-500 bg-emerald-500/5' : ''}`}>
                <div className="flex justify-between">
                  <div>
                    <div className="font-black text-sm">{q.insurerName}</div>
                    <div className="text-muted-foreground">
                      {q.healthMetadata?.planName} • {q.quotationCode}
                    </div>
                  </div>
                  {selected && (
                    <span className="flex items-center gap-1 text-emerald-600 font-black">
                      <CheckCircle2 className="h-4 w-4" /> Selected
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Sum insured</dt>
                  <dd className="font-bold text-right">{inr(q.sumInsured)}</dd>
                  <dt className="text-muted-foreground">Base premium</dt>
                  <dd className="font-bold text-right">{inr(p.basePremium)}</dd>
                  <dt className="text-muted-foreground">Rider premium</dt>
                  <dd className="font-bold text-right">{inr(p.riderPremium)}</dd>
                  <dt className="text-muted-foreground">GST ({p.gstRate !== undefined ? Math.round(p.gstRate * 100) : 18}%)</dt>
                  <dd className="font-bold text-right">{inr(p.gstAmount)}</dd>
                  <dt className="text-muted-foreground">Total premium</dt>
                  <dd className="font-black text-right">{inr(p.totalPremium)}</dd>
                  <dt className="text-muted-foreground">Commission ({p.commissionPercent ?? 0}%)</dt>
                  <dd className="font-bold text-right">{inr(p.commissionAmount)}</dd>
                  <dt className="text-muted-foreground">Net payable</dt>
                  <dd className="font-bold text-right">{inr(p.netPayable)}</dd>
                </dl>
                {(q.healthMetadata?.riders ?? []).length > 0 && (
                  <p className="text-muted-foreground">
                    Riders: {q.healthMetadata.riders.map((r: any) => `${labelOf(RIDERS, r.rider)} (${inr(r.premium)})`).join(', ')}
                  </p>
                )}
                <div className="space-y-1">
                  {files.map((f: any) => (
                    <div key={f.id} className="flex items-center gap-1 text-[11px]">
                      <FileText className="h-3.5 w-3.5 text-primary" /> {f.document?.originalFileName}
                      <span className={`ml-auto px-2 rounded-full ${statusStyle[f.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UPLOADED']}`}>
                        {f.verificationStatus}
                      </span>
                    </div>
                  ))}
                </div>
                {selected && (
                  <div className="pt-2 border-t space-y-2">
                    {q.motorPaymentRecord?.status === 'PAID' ? (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Premium Paid & Reconciled
                          </span>
                          <span className="font-mono">{inr(Number(q.motorPaymentRecord.amount))}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                          <span>Mode: <b>{q.motorPaymentRecord.paymentMethod}</b></span>
                          <span>Ref: <b className="font-mono">{q.motorPaymentRecord.referenceNumber}</b></span>
                          {q.motorPaymentRecord.paidAt && (
                            <span>Date: <b>{new Date(q.motorPaymentRecord.paidAt).toLocaleDateString('en-IN')}</b></span>
                          )}
                        </div>
                      </div>
                    ) : q.motorPaymentRecord?.status === 'UNDER_PROCESS' ? (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-amber-600" /> Payment Under Verification
                          </span>
                          <span className="font-mono">{inr(Number(q.motorPaymentRecord.amount))}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                          <span>Mode: <b>{q.motorPaymentRecord.paymentMethod}</b></span>
                          <span>Ref: <b className="font-mono">{q.motorPaymentRecord.referenceNumber}</b></span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 flex items-center justify-between">
                        <span className="flex items-center gap-1 font-bold">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-600" /> Payment Pending
                        </span>
                        <span className="text-[10px] text-muted-foreground">Due: {inr(p.totalPremium || q.totalPremium)}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openPaymentModal(q)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {q.motorPaymentRecord?.status === 'PAID'
                        ? (isBackOfficeOrAdmin ? 'Update Reconciled Payment' : 'View Payment Details')
                        : q.motorPaymentRecord?.status === 'UNDER_PROCESS'
                          ? (isBackOfficeOrAdmin ? 'Verify & Mark Paid' : 'Update Payment Details')
                          : 'Record Payment'}
                    </button>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <UploadButton
                    label="Upload Quote"
                    busy={uploadingKey === q.id}
                    onFile={(file) => upload(q.id, file, 'QUOTE_DOCUMENT', q.id)}
                  />
                  {hc.status === 'QUOTED' && (
                    <button
                      type="button"
                      disabled={selectMutation.isPending}
                      onClick={() => selectMutation.mutate(q.id)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold disabled:opacity-50"
                    >
                      Select this quote
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedQuote && (
        <div className="p-5 rounded-2xl border bg-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-black text-sm">Premium Payment & Reconciliation</h2>
                <p className="text-xs text-muted-foreground">
                  Winning Plan: {selectedQuote.insurerName} ({selectedQuote.quotationCode}) • Sum Insured: {inr(selectedQuote.sumInsured)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {paymentStatus === 'PAID' && !selectedQuote.policy && isBackOfficeOrAdmin && (
                <button
                  type="button"
                  disabled={issuePolicyMutation.isPending}
                  onClick={() => handleIssuePolicy(selectedQuote.id, selectedQuote.quotationCode)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {issuePolicyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Issue Health Policy
                </button>
              )}
              <button
                type="button"
                onClick={() => openPaymentModal(selectedQuote)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm"
              >
                <Wallet className="h-4 w-4" />
                {paymentStatus === 'PAID'
                  ? (isBackOfficeOrAdmin ? 'Update Reconciled Payment' : 'View Payment Record')
                  : paymentStatus === 'UNDER_PROCESS'
                    ? (isBackOfficeOrAdmin ? 'Verify & Confirm Paid' : 'Update Payment Details')
                    : 'Record Payment'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-black">Authoritative Premium</div>
              <div className="font-black text-sm text-foreground">
                {inr(selectedQuote.healthMetadata?.premium?.totalPremium ?? selectedQuote.totalPremium)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-black">Payment Status</div>
              <div>
                {paymentStatus === 'PAID' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> PAID & RECONCILED
                  </span>
                ) : paymentStatus === 'UNDER_PROCESS' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600">
                    <Clock className="h-3 w-3" /> VERIFICATION PENDING
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600">
                    <AlertCircle className="h-3 w-3" /> PAYMENT PENDING
                  </span>
                )}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-black">Payment Method</div>
              <div className="font-bold text-foreground">
                {paymentRecord?.paymentMethod || '—'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-black">Ref / UTR Number</div>
              <div className="font-mono font-bold text-foreground truncate">
                {paymentRecord?.referenceNumber || '—'}
              </div>
            </div>
          </div>
          {paymentRecord?.notes && (
            <div className="text-[11px] text-muted-foreground p-2.5 rounded-xl bg-muted/20 border">
              <span className="font-bold text-foreground">Remarks:</span> {paymentRecord.notes}
            </div>
          )}
        </div>
      )}

      <div className="p-5 rounded-2xl border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-sm">Document Checklist</h2>
          {checklist && (
            <span className={`px-3 py-1 rounded-full text-[11px] font-black ${checklist.complete ? statusStyle.VERIFIED : statusStyle.MISSING}`}>
              {checklist.complete ? 'All required documents received' : `${checklist.missingRequired.length} required missing`}
            </span>
          )}
        </div>
        {checklist?.checklist.map((item: any) => (
          <div key={item.documentType} className="flex flex-wrap items-center gap-3 py-2 border-b last:border-0 text-xs">
            <div className="flex-1 min-w-[220px]">
              <div className="font-bold">
                {item.label} {item.required && <span className="text-rose-500">*</span>}
              </div>
              {item.condition && <div className="text-[10px] text-muted-foreground">{item.condition}</div>}
              {item.files.map((f: any) => (
                <div key={f.id} className="text-[10px] text-muted-foreground">
                  {f.document?.originalFileName}
                </div>
              ))}
            </div>
            {item.status === 'MISSING' && !item.required ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-muted text-muted-foreground">NOT UPLOADED</span>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${statusStyle[item.status]}`}>{item.status}</span>
            )}
            <UploadButton
              label="Upload"
              busy={uploadingKey === item.documentType}
              onFile={(file) => upload(item.documentType, file, item.documentType)}
            />
          </div>
        ))}
      </div>

      {selectedQuote && (
        <RecordPaymentModal
          healthCase={hc}
          selectedQuote={selectedQuote}
          initialForm={paymentForm}
          isBackOfficeOrAdmin={isBackOfficeOrAdmin}
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSubmit={(payload) => recordPaymentMutation.mutate(payload)}
          isPending={recordPaymentMutation.isPending}
        />
      )}

      <EditLeftoverDetailsModal
        healthCase={hc}
        isOpen={editDetailsModalOpen}
        onClose={() => setEditDetailsModalOpen(false)}
        onSubmit={(payload) => updateLeftoverMutation.mutate(payload)}
        isPending={updateLeftoverMutation.isPending}
      />
    </div>
  );
}

function RecordPaymentModal({
  healthCase,
  selectedQuote,
  initialForm,
  isBackOfficeOrAdmin,
  isOpen,
  onClose,
  onSubmit,
  isPending,
}: {
  healthCase: any;
  selectedQuote: any;
  initialForm: { amount: string; paymentMethod: string; referenceNumber: string; status: 'PAID' | 'UNDER_PROCESS'; notes: string };
  isBackOfficeOrAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initialForm);

  React.useEffect(() => {
    setForm(initialForm);
  }, [initialForm, isOpen]);

  if (!isOpen) return null;

  const quotePremium = selectedQuote?.healthMetadata?.premium?.totalPremium ?? selectedQuote?.totalPremium ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">Record / Verify Premium Payment</h3>
              <p className="text-[11px] text-muted-foreground">
                Case {healthCase.caseCode} • {selectedQuote.insurerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.referenceNumber?.trim()) {
              toast.error('Please enter the transaction reference / UTR number');
              return;
            }
            if (!form.amount || Number(form.amount) <= 0) {
              toast.error('Please enter a valid payment amount');
              return;
            }
            onSubmit({
              amount: Number(form.amount),
              paymentMethod: form.paymentMethod,
              referenceNumber: form.referenceNumber.trim(),
              status: form.status,
              notes: form.notes?.trim() || undefined,
            });
          }}
          className="p-6 space-y-4 overflow-y-auto text-xs"
        >
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Total Authoritative Premium</div>
              <div className="font-black text-base text-foreground mt-0.5">
                {inr(quotePremium)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Plan & Quote Code</div>
              <div className="font-semibold text-foreground text-xs mt-0.5">
                {selectedQuote.healthMetadata?.planName || selectedQuote.insurerName}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">{selectedQuote.quotationCode}</div>
            </div>
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1">
              Amount Paid (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={inputCls}
              placeholder="e.g. 15000"
              required
            />
            {Math.abs(Number(form.amount) - Number(quotePremium)) > 0.01 && (
              <p className="text-[10px] text-amber-600 mt-1">
                Note: Amount differs from quote total premium ({inr(quotePremium)}). Exact reconciliation is mandatory for PAID verification.
              </p>
            )}
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className={inputCls}
              required
            >
              <option value="UPI">UPI (Google Pay, PhonePe, Paytm, BHIM)</option>
              <option value="NET_BANKING">Net Banking / Direct Bank Transfer</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="CHEQUE">Cheque / Demand Draft</option>
              <option value="CASH">Cash Deposit</option>
            </select>
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1">
              Transaction Reference / UTR / Cheque No. <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.referenceNumber}
              onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              className={inputCls}
              placeholder="e.g. UTR / Bank Reference No / UPI Ref ID"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Used for audit trail and finance bank reconciliation.
            </p>
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1">
              Payment Verification Status <span className="text-rose-500">*</span>
            </label>
            {isBackOfficeOrAdmin ? (
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className={inputCls}
                required
              >
                <option value="PAID">PAID — Verified & Reconciled (Back Office Sign-off)</option>
                <option value="UNDER_PROCESS">UNDER_PROCESS — Payment Received, Awaiting Reconciliation</option>
              </select>
            ) : (
              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-600">
                  <Clock className="h-3.5 w-3.5" />
                  <span>UNDER_PROCESS (Agent Submission)</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  IRDAI Segregation of Duties: Sales agents submit payments for verification. Back Office / Accounts reconciles the UTR and verifies it as PAID.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block font-black text-[11px] mb-1">Internal Notes / Remarks</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
              placeholder="e.g. Paid from customer's personal HDFC account"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {form.status === 'PAID' ? 'Verify & Confirm Paid' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLeftoverDetailsModal({
  healthCase,
  isOpen,
  onClose,
  onSubmit,
  isPending,
}: {
  healthCase: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  isPending: boolean;
}) {
  const c = healthCase.contact || {};
  const addr = (healthCase.addressSnapshot as any) || {};

  const [form, setForm] = useState({
    panNumber: c.panNumber || '',
    aadhaarNumber: c.aadhaarNumber || '',
    email: c.email || '',
    phone: c.phone || '',
    nomineeName: healthCase.nomineeName || '',
    nomineeRelation: healthCase.nomineeRelation || 'SPOUSE',
    occupation: healthCase.occupation || '',
    annualIncome: healthCase.annualIncome ? String(healthCase.annualIncome) : '',
    addressLine1: addr.line1 || addr.addressLine1 || '',
    addressLine2: addr.line2 || addr.addressLine2 || '',
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.pincode || '',
  });

  React.useEffect(() => {
    if (isOpen) {
      const contactObj = healthCase.contact || {};
      const addrObj = (healthCase.addressSnapshot as any) || {};
      setForm({
        panNumber: contactObj.panNumber || (healthCase.customerSnapshot as any)?.panNumber || '',
        aadhaarNumber: contactObj.aadhaarNumber || (healthCase.customerSnapshot as any)?.aadhaarNumber || '',
        email: contactObj.email || '',
        phone: contactObj.phone || '',
        nomineeName: healthCase.nomineeName || '',
        nomineeRelation: healthCase.nomineeRelation || 'SPOUSE',
        occupation: healthCase.occupation || '',
        annualIncome: healthCase.annualIncome ? String(healthCase.annualIncome) : '',
        addressLine1: addrObj.line1 || addrObj.addressLine1 || '',
        addressLine2: addrObj.line2 || addrObj.addressLine2 || '',
        city: addrObj.city || '',
        state: addrObj.state || '',
        pincode: addrObj.pincode || '',
      });
    }
  }, [isOpen, healthCase]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const panClean = form.panNumber.trim().toUpperCase();
    if (panClean && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
      toast.error('Invalid PAN format (e.g. ABCDE1234F)');
      return;
    }
    const aadhaarClean = form.aadhaarNumber.replace(/\D/g, '');
    if (aadhaarClean && aadhaarClean.length !== 12) {
      toast.error('Aadhaar must be exactly 12 digits');
      return;
    }

    const payload: any = {
      panNumber: panClean || undefined,
      aadhaarNumber: aadhaarClean || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      nomineeName: form.nomineeName.trim() || undefined,
      nomineeRelation: form.nomineeRelation || undefined,
      occupation: form.occupation.trim() || undefined,
      annualIncome: form.annualIncome ? Number(form.annualIncome) : undefined,
      address: {
        addressLine1: form.addressLine1.trim() || undefined,
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
      },
    };

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">Edit Proposer & Leftover KYC Details</h3>
              <p className="text-[11px] text-muted-foreground">
                Case {healthCase.caseCode} • {healthCase.contact?.firstName} {healthCase.contact?.lastName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {/* Section 1: Mandatory IRDAI KYC */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Mandatory KYC Details (Required for Policy Issuance)
              </span>
              <span className="text-[10px] text-primary font-bold">IRDAI Compliance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[11px] mb-1">
                  PAN Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={form.panNumber}
                  onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase().slice(0, 10) })}
                  className={`${inputCls} font-mono`}
                  placeholder="e.g. ABCDE1234F"
                />
                <span className="text-[10px] text-muted-foreground">10-character alphanumeric PAN</span>
              </div>

              <div>
                <label className="block font-bold text-[11px] mb-1">
                  Aadhaar Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={form.aadhaarNumber}
                  onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  className={`${inputCls} font-mono`}
                  placeholder="e.g. 123456789012"
                />
                <span className="text-[10px] text-muted-foreground">12-digit numeric Aadhaar</span>
              </div>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="space-y-3 pt-1">
            <span className="font-black text-[11px] text-muted-foreground uppercase tracking-wider">
              Contact Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[11px] mb-1">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputCls}
                  placeholder="10-digit mobile number"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Nominee Details */}
          <div className="space-y-3 pt-1">
            <span className="font-black text-[11px] text-muted-foreground uppercase tracking-wider">
              Nominee Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[11px] mb-1">Nominee Full Name</label>
                <input
                  type="text"
                  value={form.nomineeName}
                  onChange={(e) => setForm({ ...form, nomineeName: e.target.value })}
                  className={inputCls}
                  placeholder="Full name of nominee"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">Nominee Relationship</label>
                <select
                  value={form.nomineeRelation}
                  onChange={(e) => setForm({ ...form, nomineeRelation: e.target.value })}
                  className={inputCls}
                >
                  {NOMINEE_RELATIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Address Details */}
          <div className="space-y-3 pt-1">
            <span className="font-black text-[11px] text-muted-foreground uppercase tracking-wider">
              Communication Address
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-[11px] mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={form.addressLine1}
                  onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                  className={inputCls}
                  placeholder="Flat/House No, Building, Street"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={form.addressLine2}
                  onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                  className={inputCls}
                  placeholder="Area, Landmark"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputCls}
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className={inputCls}
                  placeholder="State"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">Pincode</label>
                <input
                  type="text"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className={inputCls}
                  placeholder="6-digit PIN"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Profile & Financials */}
          <div className="space-y-3 pt-1">
            <span className="font-black text-[11px] text-muted-foreground uppercase tracking-wider">
              Profile & Financial Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[11px] mb-1">Occupation</label>
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Salaried, Self-Employed, Business"
                />
              </div>
              <div>
                <label className="block font-bold text-[11px] mb-1">Annual Income (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.annualIncome}
                  onChange={(e) => setForm({ ...form, annualIncome: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. 750000"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Leftover Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddQuoteForm({ healthCase, onCancel, onSaved }: { healthCase: any; onCancel: () => void; onSaved: () => void }) {
  const isRenewal = healthCase.policyForm === 'RENEWAL_PORTABILITY';
  const [form, setForm] = useState({
    insurerName: '',
    planName: healthCase.planDetails?.planName ?? '',
    uin: healthCase.planDetails?.uin ?? '',
    sumInsured: String(healthCase.planDetails?.sumInsured ?? ''),
    policyTenureYears: '1',
    basePremium: '',
    gstPercent: '18',
    waitingPeriod: '',
    medicalCheckupRequired: false,
    coPaymentPercent: '',
    commissionPercent: '',
    riderCommissionPercent: '',
    policyStartDate: '',
  });
  const [riders, setRiders] = useState<RiderLine[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });

  const gstRateVal = form.gstPercent === '' ? 18 : Number(form.gstPercent);
  const preview = previewPremium(
    Number(form.basePremium),
    riders.map((r) => Number(r.premium)),
    Number(form.commissionPercent),
    gstRateVal,
  );

  const save = async () => {
    const missing = [
      !form.insurerName && 'Insurer',
      !form.planName && 'Plan name',
      !form.uin && 'UIN',
      !form.sumInsured && 'Sum insured',
      form.basePremium === '' && 'Base premium',
      !isRenewal && !form.waitingPeriod && 'Waiting period',
      form.commissionPercent === '' && 'Commission / Discount %',
      riders.some((r) => !r.rider || !r.sumInsured || r.premium === '') && 'Rider details',
    ].filter(Boolean);
    if (missing.length) {
      toast.error(`Please complete: ${missing.join(', ')}`);
      return;
    }
    const num = (v: string) => (v === '' ? undefined : Number(v));
    setSaving(true);
    try {
      await healthQuotationRepository.addQuote(healthCase.id, {
        insurerName: form.insurerName,
        planName: form.planName,
        uin: form.uin,
        sumInsured: Number(form.sumInsured),
        policyTenureYears: Number(form.policyTenureYears),
        basePremium: Number(form.basePremium),
        medicalCheckupRequired: form.medicalCheckupRequired,
        ...(form.gstPercent !== '' ? { gstPercent: Number(form.gstPercent) } : {}),
        ...(form.waitingPeriod ? { waitingPeriod: form.waitingPeriod } : {}),
        ...(form.policyStartDate ? { policyStartDate: form.policyStartDate } : {}),
        ...(num(form.coPaymentPercent) !== undefined ? { coPaymentPercent: num(form.coPaymentPercent) } : {}),
        ...(num(form.commissionPercent) !== undefined ? { commissionPercent: num(form.commissionPercent) } : {}),
        ...(num(form.riderCommissionPercent) !== undefined ? { riderCommissionPercent: num(form.riderCommissionPercent) } : {}),
        ...(riders.length
          ? { riders: riders.map((r) => ({ rider: r.rider, sumInsured: Number(r.sumInsured), premium: Number(r.premium) })) }
          : {}),
      });
      toast.success('Quote added');
      onSaved();
    } catch (err) {
      toast.error(healthApiError(err, 'Failed to add quote'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border bg-background space-y-4 text-xs">
      <h3 className="font-black text-sm">New Quote — {isRenewal ? 'Renewal / Portability' : 'New Policy'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FieldLabel label="Insurer" required>
          <input className={inputCls} value={form.insurerName} onChange={set('insurerName')} />
        </FieldLabel>
        <FieldLabel label="Plan Name" required>
          <input className={inputCls} value={form.planName} onChange={set('planName')} />
        </FieldLabel>
        <FieldLabel label="UIN" required hint="As filed with IRDAI">
          <input className={inputCls} value={form.uin} onChange={set('uin')} />
        </FieldLabel>
        <FieldLabel label="Sum Insured" required>
          <input className={inputCls} type="number" min={0} value={form.sumInsured} onChange={set('sumInsured')} />
        </FieldLabel>
        <FieldLabel label="Policy Tenure" required>
          <select className={inputCls} value={form.policyTenureYears} onChange={set('policyTenureYears')}>
            {TENURES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Waiting Period Applicable" required={!isRenewal}>
          <select className={inputCls} value={form.waitingPeriod} onChange={set('waitingPeriod')}>
            <option value="">-- Select --</option>
            {WAITING_PERIODS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Base Premium" required>
          <input className={inputCls} type="number" min={0} value={form.basePremium} onChange={set('basePremium')} />
        </FieldLabel>
        <FieldLabel label="GST (%)" required hint="Default is 18%">
          <input
            className={inputCls}
            type="number"
            min={0}
            max={100}
            value={form.gstPercent}
            onChange={set('gstPercent')}
            placeholder="18"
          />
        </FieldLabel>
        <FieldLabel label="Policy Start Date">
          <input className={inputCls} type="date" value={form.policyStartDate} onChange={set('policyStartDate')} />
        </FieldLabel>
        <FieldLabel label="Pre-Policy Medical Check-up">
          <YesNo value={form.medicalCheckupRequired} onChange={(v) => setForm({ ...form, medicalCheckupRequired: v })} />
        </FieldLabel>
        <FieldLabel label="Commission / Discount (D%)" required>
          <input className={inputCls} type="number" min={0} max={100} value={form.commissionPercent} onChange={set('commissionPercent')} />
        </FieldLabel>
      </div>

      {!isRenewal && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-black">Riders &amp; Add-on Covers</h4>
            <button
              type="button"
              onClick={() => setRiders([...riders, { rider: '', sumInsured: '', premium: '' }])}
              className="flex items-center gap-1 px-3 py-1 rounded-lg border text-[11px] font-bold hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Add rider
            </button>
          </div>
          {riders.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <select
                className={inputCls}
                value={r.rider}
                onChange={(e) => setRiders(riders.map((x, idx) => (idx === i ? { ...x, rider: e.target.value } : x)))}
              >
                <option value="">-- Rider --</option>
                {RIDERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder="Rider sum insured"
                value={r.sumInsured}
                onChange={(e) => setRiders(riders.map((x, idx) => (idx === i ? { ...x, sumInsured: e.target.value } : x)))}
              />
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder="Rider premium"
                value={r.premium}
                onChange={(e) => setRiders(riders.map((x, idx) => (idx === i ? { ...x, premium: e.target.value } : x)))}
              />
              <button type="button" onClick={() => setRiders(riders.filter((_, idx) => idx !== i))} className="p-2 text-rose-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {riders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FieldLabel label="Co-payment Opted (%)" hint="Voluntary co-pay for premium discount">
                <input className={inputCls} type="number" min={0} max={100} value={form.coPaymentPercent} onChange={set('coPaymentPercent')} />
              </FieldLabel>
              <FieldLabel label="Rider Commission / Discount (%)" hint="Defaults to the main D%">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  max={100}
                  value={form.riderCommissionPercent}
                  onChange={set('riderCommissionPercent')}
                />
              </FieldLabel>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 rounded-xl bg-primary/5">
        {[
          ['Rider premium', preview.rider],
          ['Net premium', preview.net],
          [`GST (${form.gstPercent === '' ? 18 : form.gstPercent}%)`, preview.gst],
          ['Total premium', preview.total],
          ['Commission', preview.commission],
          ['Net payable', preview.netPayable],
        ].map(([label, value]) => (
          <div key={label as string}>
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className="font-black">{inr(value as number)}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border text-xs font-bold">
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex items-center gap-1 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Quote
        </button>
      </div>
    </div>
  );
}

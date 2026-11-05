'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Upload,
  User,
  Heart,
  Calendar,
  Building2,
  Trash2,
  ExternalLink,
  Award,
  Loader2,
  Activity,
  Layers,
} from 'lucide-react';
import { lifeQuotationRepository } from '../../repositories/life-quotation.repository';
import {
  PLAN_CATEGORIES,
  POLICY_FORMS,
  POLICY_TYPES,
  PREMIUM_PAYMENT_TYPES,
  PREMIUM_FREQUENCIES,
  STANDARD_RIDERS,
  calculateBmi,
  labelOf,
} from './lifeFormConfig';
import { FieldLabel, inputCls } from './LifeFields';

export function LifeCaseWorkspace({ caseId }: { caseId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'QUOTES' | 'DOCUMENTS' | 'PAYMENT_ISSUANCE' | 'DETAILS'>('QUOTES');

  // Modals
  const [isAddQuoteModalOpen, setIsAddQuoteModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [isRejectDocModalOpen, setIsRejectDocModalOpen] = useState(false);
  const [targetDocId, setTargetDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isIssuingPolicy, setIsIssuingPolicy] = useState(false);

  // New Quote Form State
  const [newQuote, setNewQuote] = useState({
    insurerName: 'HDFC Life Insurance Co.',
    productCode: 'CLICK2PROTECT_SUPER',
    sumInsured: 10000000,
    basePremium: 18000,
    discountAmount: 0,
    policyTermYears: 30,
    premiumPayingTermYears: 10,
    lifePolicyType: 'INDIVIDUAL_PURE_RISK',
    premiumPaymentType: 'LIMITED_PAY',
    premiumFrequency: 'ANNUAL',
    brokeragePercent: 25.0,
    riders: [] as Array<{
      riderType: string;
      sumAssured: number;
      termYears: number;
      pptYears: number;
      premium: number;
      description?: string;
    }>,
  });

  // Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'NET_BANKING',
    transactionRef: `TXN-LIFE-${Date.now().toString().slice(-6)}`,
  });

  // Query: Proposal Case
  const {
    data: lifeCase,
    isLoading: isLoadingCase,
    refetch: refetchCase,
  } = useQuery({
    queryKey: ['life-case', caseId],
    queryFn: () => lifeQuotationRepository.getCase(caseId),
  });

  // Query: Checklist
  const {
    data: checklist,
    refetch: refetchChecklist,
  } = useQuery({
    queryKey: ['life-case-checklist', caseId],
    queryFn: () => lifeQuotationRepository.getChecklist(caseId),
    enabled: Boolean(caseId),
  });

  // Selected Quotation
  const selectedQuote = useMemo(() => {
    if (!lifeCase || !lifeCase.quotations) return null;
    return lifeCase.quotations.find((q: any) => q.id === lifeCase.selectedQuoteId) || null;
  }, [lifeCase]);

  // Sync payment amount when selectedQuote changes
  React.useEffect(() => {
    if (selectedQuote) {
      setPaymentData((prev) => ({
        ...prev,
        amount: Number(selectedQuote.totalPremium || 0),
      }));
    }
  }, [selectedQuote]);

  // Quote Live Calculation
  const quoteCalculation = useMemo(() => {
    const base = Number(newQuote.basePremium || 0);
    const disc = Number(newQuote.discountAmount || 0);
    const netBase = Math.max(0, base - disc);
    const riderSum = newQuote.riders.reduce((s, r) => s + Number(r.premium || 0), 0);
    const subtotal = netBase + riderSum;

    // GST rate: 1.8% for Single Premium Annuity purchase price, 18.0% for risk
    const isSingleAnnuity =
      lifeCase?.planCategory === 'ANNUITY_PENSION' && newQuote.premiumPaymentType === 'SINGLE_PAY';
    const gstRate = isSingleAnnuity ? 0.018 : 0.18;
    const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
    const total = subtotal + gstAmount;

    return {
      netBase,
      riderSum,
      subtotal,
      gstRatePercent: (gstRate * 100).toFixed(1),
      gstAmount,
      total,
    };
  }, [newQuote, lifeCase]);

  // Mutation: Add Quote
  const addQuoteMutation = useMutation({
    mutationFn: (payload: any) => lifeQuotationRepository.addQuote(caseId, payload),
    onSuccess: () => {
      toast.success('Quotation added successfully!');
      setIsAddQuoteModalOpen(false);
      refetchCase();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add quotation');
    },
  });

  // Mutation: Select Winning Quote
  const selectQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => lifeQuotationRepository.selectQuote(caseId, quoteId),
    onSuccess: (updated) => {
      toast.success('Quotation selected as winning quote!');
      refetchCase();
      queryClient.invalidateQueries({ queryKey: ['life-case', caseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to select quotation');
    },
  });

  // Mutation: Record Payment
  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => lifeQuotationRepository.recordPayment(caseId, selectedQuote!.id, payload),
    onSuccess: () => {
      toast.success('Authoritative payment recorded successfully!');
      setIsRecordPaymentModalOpen(false);
      refetchCase();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to record payment');
    },
  });

  // Mutation: Verify Document
  const verifyDocMutation = useMutation({
    mutationFn: ({ docId, payload }: { docId: string; payload: any }) =>
      lifeQuotationRepository.verifyDocument(docId, payload),
    onSuccess: () => {
      toast.success('Document verification status updated!');
      refetchChecklist();
      refetchCase();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to verify document');
    },
  });

  // File Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingDoc(true);
      // 1. Upload to storage
      const uploaded = await lifeQuotationRepository.uploadFileToDocumentStore(file, {
        entityId: caseId,
        entityType: 'LIFE_QUOTATION_CASE',
      });

      // 2. Attach to Life Proposal Case
      await lifeQuotationRepository.attachDocument(caseId, {
        documentType: docType,
        fileName: file.name,
        fileKey: uploaded.fileKey || uploaded.id || `life-${Date.now()}`,
        mimeType: file.type || 'application/pdf',
        fileSize: file.size,
        quotationId: selectedQuote?.id || undefined,
      });

      toast.success(`${file.name} uploaded and attached successfully!`);
      refetchChecklist();
      refetchCase();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
      event.target.value = '';
    }
  };

  // Policy Issuance Handler
  const handleIssuePolicy = async () => {
    if (!selectedQuote) {
      toast.error('A winning quotation must be selected before policy issuance.');
      return;
    }

    try {
      setIsIssuingPolicy(true);
      const res = await lifeQuotationRepository.issuePolicy({
        quotationId: selectedQuote.id,
        policyType: 'LIFE',
        effectiveDate: new Date().toISOString(),
        payment: {
          amount: Number(selectedQuote.totalPremium),
          status: 'PAID',
          referenceNumber: selectedQuote.motorPaymentRecord?.referenceNumber || `TXN-LIFE-${Date.now().toString().slice(-6)}`,
        },
      });

      toast.success(`Policy ${res.policyNumber || ''} issued successfully!`);
      refetchCase();
      setActiveTab('PAYMENT_ISSUANCE');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to issue life insurance policy');
    } finally {
      setIsIssuingPolicy(false);
    }
  };

  // Live BMI of life case
  const caseBmi = useMemo(() => {
    if (!lifeCase) return null;
    return calculateBmi(lifeCase.weightKg, lifeCase.heightCm);
  }, [lifeCase]);

  if (isLoadingCase) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-semibold">Loading Life Insurance Proposal Case...</span>
      </div>
    );
  }

  if (!lifeCase) {
    return (
      <div className="p-12 text-center border rounded-2xl bg-card space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Proposal Case Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested Life Insurance proposal could not be retrieved.</p>
        <Link href="/sales/life-quotations" className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
          Return to Proposals
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/sales/life-quotations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Life Proposals</span>
        </Link>
        <button
          onClick={() => {
            refetchCase();
            refetchChecklist();
          }}
          className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground text-xs font-bold inline-flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Case Header */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {lifeCase.caseCode}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-muted text-foreground">
                {labelOf(PLAN_CATEGORIES, lifeCase.planCategory)}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  lifeCase.status === 'CONVERTED'
                    ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                    : lifeCase.status === 'ACCEPTED'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : lifeCase.status === 'QUOTES_GENERATED'
                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {lifeCase.status}
              </span>
            </div>

            <h1 className="text-2xl font-black text-foreground mt-2">
              {lifeCase.contact?.firstName} {lifeCase.contact?.lastName}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Life Assured: <span className="font-bold text-foreground">{lifeCase.lifeAssuredName}</span> • Proposer Relation:{' '}
              <span className="font-semibold">{lifeCase.proposerRelation || 'SELF'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedQuote && lifeCase.status !== 'CONVERTED' && (
              <button
                onClick={handleIssuePolicy}
                disabled={isIssuingPolicy}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:opacity-95 shadow-xs disabled:opacity-50"
              >
                {isIssuingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                <span>Issue Life Policy</span>
              </button>
            )}

            <button
              onClick={() => setIsAddQuoteModalOpen(true)}
              disabled={lifeCase.status === 'CONVERTED'}
              className="px-5 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold flex items-center gap-2 hover:opacity-90 shadow-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>Add Insurer Quote</span>
            </button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border mt-6 pt-2">
          {[
            { key: 'QUOTES', label: 'Quotation Matrix', count: lifeCase.quotations?.length || 0 },
            { key: 'DOCUMENTS', label: 'Documents & Verification', count: lifeCase.documents?.length || 0 },
            { key: 'PAYMENT_ISSUANCE', label: 'Payment & Policy Issuance' },
            { key: 'DETAILS', label: 'Proposal & Underwriting Details' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 border-b-2 text-xs font-bold transition flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUOTATION MATRIX                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'QUOTES' && (
        <div className="space-y-6">
          {/* Selected Quote Banner */}
          {selectedQuote ? (
            <div className="p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                      Selected Winning Quotation
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">{selectedQuote.quotationCode}</span>
                  </div>
                  <h3 className="text-lg font-black text-foreground mt-1">{selectedQuote.insurerName}</h3>
                  <p className="text-xs text-muted-foreground">
                    Sum Assured: ₹{Number(selectedQuote.sumInsured || 0).toLocaleString('en-IN')} • Tenure:{' '}
                    {selectedQuote.policyTenure} Years • PPT: {selectedQuote.premiumPayingTermYears || selectedQuote.policyTenure} Years
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Premium (incl. GST)</div>
                <div className="text-2xl font-black text-emerald-600">
                  ₹{Number(selectedQuote.totalPremium || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Base: ₹{Number(selectedQuote.netPremium || selectedQuote.basePremium || 0).toLocaleString('en-IN')} + GST: ₹
                  {Number(selectedQuote.gstAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-border bg-card/60 text-center space-y-1">
              <span className="text-xs font-bold text-foreground">No quotation selected yet</span>
              <p className="text-[11px] text-muted-foreground">
                Compare insurer quotes below and select the winning quote to proceed to document clearance and policy issuance.
              </p>
            </div>
          )}

          {/* Quotes Grid */}
          {!lifeCase.quotations || lifeCase.quotations.length === 0 ? (
            <div className="p-16 rounded-2xl border border-border bg-card text-center space-y-4">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">No Insurer Quotations Added</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Add quotes from insurers (e.g. HDFC Life, Tata AIA, ICICI Prudential, Max Life, SBI Life) to generate pricing options.
              </p>
              <button
                onClick={() => setIsAddQuoteModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add First Quotation</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lifeCase.quotations.map((quote: any) => {
                const isSelected = quote.id === lifeCase.selectedQuoteId;
                const isAccepted = quote.status === 'ACCEPTED';
                return (
                  <div
                    key={quote.id}
                    className={`p-5 rounded-2xl border bg-card transition-all flex flex-col justify-between shadow-xs ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div>
                      {/* Quote Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            <span className="font-black text-sm text-foreground">{quote.insurerName}</span>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">{quote.quotationCode}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isSelected ? 'SELECTED' : quote.status}
                        </span>
                      </div>

                      {/* Pricing Breakdown */}
                      <div className="py-4 space-y-2 border-b border-border">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Sum Assured</span>
                          <span className="font-bold text-foreground">
                            ₹{Number(quote.sumInsured || 0).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Policy Term / PPT</span>
                          <span className="font-bold text-foreground">
                            {quote.policyTenure}y / {quote.premiumPayingTermYears || quote.policyTenure}y
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Net Base Premium</span>
                          <span className="font-mono font-semibold">
                            ₹{Number(quote.netPremium || quote.basePremium || 0).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {quote.lifeRiders && quote.lifeRiders.length > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Riders ({quote.lifeRiders.length})</span>
                            <span className="font-mono font-semibold">
                              +₹
                              {quote.lifeRiders
                                .reduce((s: number, r: any) => s + Number(r.premium || 0), 0)
                                .toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">GST</span>
                          <span className="font-mono font-semibold">
                            ₹{Number(quote.gstAmount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                          <span className="font-black text-foreground">Total Premium</span>
                          <span className="font-mono font-black text-base text-primary">
                            ₹{Number(quote.totalPremium || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Line-item Riders pill list */}
                      {quote.lifeRiders && quote.lifeRiders.length > 0 && (
                        <div className="py-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                            Included Riders
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {quote.lifeRiders.map((r: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/5 text-primary border border-primary/10"
                              >
                                {r.riderType.replace(/_/g, ' ')} (₹{Number(r.premium).toLocaleString('en-IN')})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 mt-auto">
                      {isSelected ? (
                        <div className="w-full py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-black text-center flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Winning Quote Selected</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectQuoteMutation.mutate(quote.id)}
                          disabled={selectQuoteMutation.isPending || lifeCase.status === 'CONVERTED'}
                          className="w-full py-2 rounded-xl border border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs font-bold transition shadow-2xs disabled:opacity-50"
                        >
                          {selectQuoteMutation.isPending ? 'Selecting...' : 'Select as Winning Quote'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DOCUMENTS & VERIFICATION                                          */}
      {/* ========================================================================= */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-6">
          {/* Checklist Status Card */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Compliance Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      checklist?.complianceStatus === 'VERIFIED'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : checklist?.complianceStatus === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}
                  >
                    {checklist?.complianceStatus || 'PENDING'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-foreground mt-1">Underwriter Verification Checklist</h2>
                <p className="text-xs text-muted-foreground">
                  All mandatory KYC, age, and medical proof documents must be verified before policy issuance.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer hover:opacity-95 transition flex items-center gap-1.5 shadow-xs">
                  <Upload className="h-4 w-4" />
                  <span>{isUploadingDoc ? 'Uploading...' : 'Upload Document'}</span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploadingDoc}
                    onChange={(e) => handleFileUpload(e, 'PROPOSER_IDENTITY_PROOF')}
                  />
                </label>
              </div>
            </div>

            {/* Checklist items list */}
            {checklist?.missingDocuments && checklist.missingDocuments.length > 0 && (
              <div className="mt-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-900 dark:text-amber-200 text-xs">
                <span className="font-bold">Missing Required Documents:</span> {checklist.missingDocuments.join(', ')}
              </div>
            )}
          </div>

          {/* Uploaded Documents Table */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground mb-4">Attached Proposal Documents</h3>

            {!lifeCase.documents || lifeCase.documents.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">
                No documents uploaded yet. Click Upload Document above to attach PAN, Aadhaar, Age proof, or medical reports.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lifeCase.documents.map((doc: any) => (
                  <div key={doc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{doc.fileName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Type: <span className="font-semibold">{doc.documentType}</span> • Size:{' '}
                          {Math.round((doc.fileSize || 0) / 1024)} KB
                        </div>
                        {doc.rejectionReason && (
                          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                            Rejection Reason: {doc.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          doc.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : doc.verificationStatus === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}
                      >
                        {doc.verificationStatus}
                      </span>

                      {/* Underwriter Actions */}
                      {doc.verificationStatus !== 'VERIFIED' && (
                        <button
                          type="button"
                          onClick={() =>
                            verifyDocMutation.mutate({
                              docId: doc.id,
                              payload: { verificationStatus: 'VERIFIED' },
                            })
                          }
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition"
                        >
                          Verify
                        </button>
                      )}

                      {doc.verificationStatus !== 'REJECTED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetDocId(doc.id);
                            setIsRejectDocModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg border border-rose-500/30 text-rose-600 text-[11px] font-bold hover:bg-rose-500/10 transition"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAYMENT & POLICY ISSUANCE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'PAYMENT_ISSUANCE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Reconciliation Card */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Premium Payment Status</h3>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedQuote?.motorPaymentRecord?.status === 'PAID'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}
                >
                  {selectedQuote?.motorPaymentRecord?.status || 'AWAITING PAYMENT'}
                </span>
              </div>

              {selectedQuote ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Authoritative Payable Premium</span>
                    <span className="font-mono font-bold text-foreground">
                      ₹{Number(selectedQuote.totalPremium || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Reconciled Paid Amount</span>
                    <span className="font-mono font-bold text-emerald-600">
                      ₹{Number(selectedQuote.motorPaymentRecord?.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {selectedQuote.motorPaymentRecord?.referenceNumber && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">UTR / Transaction Reference</span>
                      <span className="font-mono text-foreground font-semibold">
                        {selectedQuote.motorPaymentRecord.referenceNumber}
                      </span>
                    </div>
                  )}

                  {selectedQuote.motorPaymentRecord?.status !== 'PAID' && (
                    <div className="pt-2">
                      <button
                        onClick={() => setIsRecordPaymentModalOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 transition"
                      >
                        Record Reconciled Payment
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Select a winning quotation to verify payable premium and record client payment.
                </div>
              )}
            </div>

            {/* Policy Issuance Multi-Gate Check */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Back-Office Issuance Gates</h3>
              </div>

              <div className="space-y-2.5">
                {/* Gate 1: Winning Quote Selection */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-border bg-muted/20">
                  <span className="font-semibold text-foreground">Winning Quotation Selected</span>
                  {selectedQuote ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>

                {/* Gate 2: Document Verification */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-border bg-muted/20">
                  <span className="font-semibold text-foreground">Mandatory Documents Cleared</span>
                  {checklist?.allMandatoryVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>

                {/* Gate 3: Payment Reconciled */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-border bg-muted/20">
                  <span className="font-semibold text-foreground">Exact Decimal Payment Reconciled</span>
                  {selectedQuote?.motorPaymentRecord?.status === 'PAID' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>

                {/* Issue Button */}
                <div className="pt-2">
                  <button
                    onClick={handleIssuePolicy}
                    disabled={
                      isIssuingPolicy ||
                      !selectedQuote ||
                      selectedQuote.motorPaymentRecord?.status !== 'PAID' ||
                      lifeCase.status === 'CONVERTED'
                    }
                    className="w-full py-2.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isIssuingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    <span>{lifeCase.status === 'CONVERTED' ? 'Policy Already Issued' : 'Issue Life Policy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PROPOSAL & UNDERWRITING DETAILS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'DETAILS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Proposer Info */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Proposer (Policyholder)</h3>
            <div className="text-base font-bold text-foreground">
              {lifeCase.contact?.firstName} {lifeCase.contact?.lastName}
            </div>
            <div className="text-xs text-muted-foreground">{lifeCase.contact?.phone} • {lifeCase.contact?.email}</div>
            <div className="text-xs font-semibold">
              PAN: <span className="font-mono">{lifeCase.contact?.panNumber || 'Not provided'}</span> • Aadhaar:{' '}
              <span className="font-mono">{lifeCase.contact?.aadhaarNumber || 'Not provided'}</span>
            </div>
            <div className="text-xs">
              Income: ₹{Number(lifeCase.annualIncome || 0).toLocaleString('en-IN')} p.a. • Occupation: {lifeCase.occupation}
            </div>
          </div>

          {/* Life Assured & Underwriting Info */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Life Assured Details</h3>
            <div className="text-base font-bold text-foreground">
              {lifeCase.lifeAssuredName} <span className="text-xs text-muted-foreground">({lifeCase.proposerRelation || 'SELF'})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Smoker Status: <span className="font-bold text-foreground">{lifeCase.smokerStatus}</span>
            </div>
            <div className="text-xs font-semibold">
              Height: {lifeCase.heightCm} cm • Weight: {lifeCase.weightKg} kg • BMI:{' '}
              <span className="font-mono font-bold">{caseBmi || 'N/A'}</span>
            </div>
            {lifeCase.hasPreExistingIllness && (
              <div className="text-xs text-amber-600 font-semibold">
                Medical Disclosure: {lifeCase.medicalHistoryDetails || 'Yes'}
              </div>
            )}
          </div>

          {/* Nominee Info */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nominee Designation</h3>
            <div className="text-base font-bold text-foreground">{lifeCase.nomineeName}</div>
            <div className="text-xs text-muted-foreground">
              Relation: {lifeCase.nomineeRelation} • DOB: {lifeCase.nomineeDob ? String(lifeCase.nomineeDob).slice(0, 10) : 'N/A'}
            </div>
            {lifeCase.appointeeName && (
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Minor Appointee</span>
                <div className="text-xs font-bold text-foreground mt-0.5">{lifeCase.appointeeName} ({lifeCase.appointeeRelation})</div>
              </div>
            )}
          </div>

          {/* Section A Metadata */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Category Specification Snapshot</h3>
            <pre className="p-3 rounded-xl bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto max-h-48">
              {JSON.stringify(lifeCase.categoryData || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD INSURER QUOTATION                                             */}
      {/* ========================================================================= */}
      {isAddQuoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">Add Insurer Quotation</h2>
                <p className="text-xs text-muted-foreground">Attach a new pricing option to proposal {lifeCase.caseCode}</p>
              </div>
              <button onClick={() => setIsAddQuoteModalOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldLabel label="Insurer Name" required>
                  <input
                    className={inputCls}
                    value={newQuote.insurerName}
                    onChange={(e) => setNewQuote({ ...newQuote, insurerName: e.target.value })}
                  />
                </FieldLabel>

                <FieldLabel label="Product Plan Code">
                  <input
                    className={inputCls}
                    value={newQuote.productCode}
                    onChange={(e) => setNewQuote({ ...newQuote, productCode: e.target.value })}
                  />
                </FieldLabel>

                <FieldLabel label="Sum Assured (Death Benefit)" required>
                  <input
                    className={inputCls}
                    type="number"
                    value={newQuote.sumInsured}
                    onChange={(e) => setNewQuote({ ...newQuote, sumInsured: Number(e.target.value) })}
                  />
                </FieldLabel>

                <FieldLabel label="Base Premium (before GST)" required>
                  <input
                    className={inputCls}
                    type="number"
                    value={newQuote.basePremium}
                    onChange={(e) => setNewQuote({ ...newQuote, basePremium: Number(e.target.value) })}
                  />
                </FieldLabel>

                <FieldLabel label="Customer Discount (INR)">
                  <input
                    className={inputCls}
                    type="number"
                    value={newQuote.discountAmount}
                    onChange={(e) => setNewQuote({ ...newQuote, discountAmount: Number(e.target.value) })}
                  />
                </FieldLabel>

                <FieldLabel label="Policy Term (Years)" required>
                  <input
                    className={inputCls}
                    type="number"
                    value={newQuote.policyTermYears}
                    onChange={(e) => setNewQuote({ ...newQuote, policyTermYears: Number(e.target.value) })}
                  />
                </FieldLabel>

                <FieldLabel label="Premium Paying Term (PPT)" required>
                  <input
                    className={inputCls}
                    type="number"
                    value={newQuote.premiumPayingTermYears}
                    onChange={(e) => setNewQuote({ ...newQuote, premiumPayingTermYears: Number(e.target.value) })}
                  />
                </FieldLabel>

                <FieldLabel label="Policy Structure" required>
                  <select
                    className={inputCls}
                    value={newQuote.lifePolicyType}
                    onChange={(e) => setNewQuote({ ...newQuote, lifePolicyType: e.target.value })}
                  >
                    {POLICY_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Payment Type" required>
                  <select
                    className={inputCls}
                    value={newQuote.premiumPaymentType}
                    onChange={(e) => setNewQuote({ ...newQuote, premiumPaymentType: e.target.value })}
                  >
                    {PREMIUM_PAYMENT_TYPES.map((ppt) => (
                      <option key={ppt.value} value={ppt.value}>
                        {ppt.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Installment Frequency" required>
                  <select
                    className={inputCls}
                    value={newQuote.premiumFrequency}
                    onChange={(e) => setNewQuote({ ...newQuote, premiumFrequency: e.target.value })}
                  >
                    {PREMIUM_FREQUENCIES.map((pf) => (
                      <option key={pf.value} value={pf.value}>
                        {pf.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
              </div>

              {/* Line-item Riders Section */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">Add Line-Item Riders (Optional)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewQuote({
                        ...newQuote,
                        riders: [
                          ...newQuote.riders,
                          {
                            riderType: 'CRITICAL_ILLNESS',
                            sumAssured: 2500000,
                            termYears: newQuote.policyTermYears,
                            pptYears: newQuote.premiumPayingTermYears,
                            premium: 2500,
                          },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-bold hover:bg-muted flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Rider</span>
                  </button>
                </div>

                {newQuote.riders.map((r, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-4 gap-2 p-2.5 rounded-xl border border-border bg-muted/20 mb-2 items-center">
                    <select
                      className={`${inputCls} text-[11px]`}
                      value={r.riderType}
                      onChange={(e) => {
                        const updated = [...newQuote.riders];
                        updated[rIdx].riderType = e.target.value;
                        setNewQuote({ ...newQuote, riders: updated });
                      }}
                    >
                      {STANDARD_RIDERS.map((sr) => (
                        <option key={sr.value} value={sr.value}>
                          {sr.label}
                        </option>
                      ))}
                    </select>

                    <input
                      className={`${inputCls} text-[11px]`}
                      type="number"
                      placeholder="Sum Assured"
                      value={r.sumAssured}
                      onChange={(e) => {
                        const updated = [...newQuote.riders];
                        updated[rIdx].sumAssured = Number(e.target.value);
                        setNewQuote({ ...newQuote, riders: updated });
                      }}
                    />

                    <input
                      className={`${inputCls} text-[11px]`}
                      type="number"
                      placeholder="Rider Premium"
                      value={r.premium}
                      onChange={(e) => {
                        const updated = [...newQuote.riders];
                        updated[rIdx].premium = Number(e.target.value);
                        setNewQuote({ ...newQuote, riders: updated });
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const updated = newQuote.riders.filter((_, idx) => idx !== rIdx);
                        setNewQuote({ ...newQuote, riders: updated });
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg justify-self-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Calculation Preview Box */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Net Base Premium</span>
                  <span className="font-mono">₹{quoteCalculation.netBase.toLocaleString('en-IN')}</span>
                </div>
                {quoteCalculation.riderSum > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Rider Premium</span>
                    <span className="font-mono">+₹{quoteCalculation.riderSum.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">GST ({quoteCalculation.gstRatePercent}%)</span>
                  <span className="font-mono">₹{quoteCalculation.gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-foreground pt-1.5 border-t border-primary/20">
                  <span>Authoritative Total Payable</span>
                  <span className="font-mono text-primary text-base">₹{quoteCalculation.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-3 bg-muted/10">
              <button
                type="button"
                onClick={() => setIsAddQuoteModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addQuoteMutation.mutate(newQuote)}
                disabled={addQuoteMutation.isPending}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 disabled:opacity-50"
              >
                {addQuoteMutation.isPending ? 'Attaching...' : 'Add Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD PAYMENT                                                    */}
      {/* ========================================================================= */}
      {isRecordPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">Record Authoritative Client Payment</h3>
              <button onClick={() => setIsRecordPaymentModalOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <FieldLabel label="Exact Reconciliation Amount (INR)" required>
                <input
                  className={inputCls}
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                />
              </FieldLabel>

              <FieldLabel label="Payment Method" required>
                <select
                  className={inputCls}
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                >
                  <option value="NET_BANKING">Net Banking / NEFT / RTGS</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                </select>
              </FieldLabel>

              <FieldLabel label="Transaction / UTR Reference" required>
                <input
                  className={inputCls}
                  value={paymentData.transactionRef}
                  onChange={(e) => setPaymentData({ ...paymentData, transactionRef: e.target.value })}
                />
              </FieldLabel>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => recordPaymentMutation.mutate(paymentData)}
                disabled={recordPaymentMutation.isPending}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95"
              >
                {recordPaymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJECT DOCUMENT (UNDERWRITER)                                      */}
      {/* ========================================================================= */}
      {isRejectDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">Reject Proposal Document</h3>
              <button onClick={() => setIsRejectDocModalOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <FieldLabel label="Mandatory Rejection Reason" required hint="Provide clear instructions to the agent/client">
                <textarea
                  className={`${inputCls} min-h-[80px]`}
                  placeholder="e.g. Unclear / blurry scan of PAN card; upload fresh color copy with visible signature."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </FieldLabel>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsRejectDocModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || verifyDocMutation.isPending}
                onClick={() => {
                  if (targetDocId) {
                    verifyDocMutation.mutate({
                      docId: targetDocId,
                      payload: {
                        verificationStatus: 'REJECTED',
                        rejectionReason: rejectionReason.trim(),
                      },
                    });
                    setIsRejectDocModalOpen(false);
                    setRejectionReason('');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building,
  User,
  Shield,
  FileText,
  DollarSign,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Eye,
  Trash2,
  Upload,
  ArrowRight,
  TrendingUp,
  Percent,
  Check,
  X,
  Loader2,
  RefreshCw,
  Award,
  Layers,
  FileCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loansRepository,
  LoanApplicationCase,
  LoanFacility,
  LoanLenderOffer,
  LoanDocument,
  LoanParty,
  LoanFacilityType,
  LoanPartyRole,
  LoanEnquiryStatus,
} from '../../repositories/loans.repository';
import { documentsRepository } from '../../repositories/documents.repository';
import {
  LOAN_CATEGORIES,
  STATUS_CONFIG,
  CATEGORY_FORM_FIELDS,
  CATEGORY_DOCUMENT_CHECKLISTS,
} from './loanFormConfig';

interface LoanCaseWorkspaceProps {
  caseId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export function LoanCaseWorkspace({
  caseId,
  onClose,
  onRefresh,
}: LoanCaseWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'FACILITIES' | 'APPLICANT' | 'PARTIES' | 'DOCUMENTS'>('FACILITIES');

  // Modals state
  const [isAddOfferOpen, setIsAddOfferOpen] = useState(false);
  const [targetFacilityId, setTargetFacilityId] = useState<string | null>(null);
  const [isAddFacilityOpen, setIsAddFacilityOpen] = useState(false);
  const [isAddAddOnOpen, setIsAddAddOnOpen] = useState(false);
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [isSanctionUploadOpen, setIsSanctionUploadOpen] = useState(false);
  const [targetOfferId, setTargetOfferId] = useState<string | null>(null);

  // Sanction Modal state
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [sanctionForm, setSanctionForm] = useState({
    sanctionDate: new Date().toISOString().slice(0, 10),
    sanctionedAmount: '',
    notes: '',
  });

  // Disburse Modal state
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    loanAccountNumber: '',
    disbursementDate: new Date().toISOString().slice(0, 10),
    disbursedAmount: '',
    utrNumber: '',
    bankName: '',
    notes: '',
  });

  // Offer Form state
  const [newOffer, setNewOffer] = useState({
    lenderName: '',
    sanctionedAmount: '',
    interestRate: '',
    rateType: 'FLOATING',
    tenureMonths: '',
    processingFeePercent: '0.50',
    otherCharges: '0',
    notes: '',
  });

  // Facility Form state
  const [newFacility, setNewFacility] = useState({
    facilityType: 'NEW_TERM_LOAN' as LoanFacilityType,
    requestedAmount: '',
    requestedTenureMonths: '',
    targetInterestRate: '',
  });

  // AddOn Form state
  const [newAddOn, setNewAddOn] = useState({
    addOnType: 'CREDIT_LIFE_INSURANCE',
    providerName: 'HDFC Life / SBI Life',
    sumInsured: '',
    premiumAmount: '',
    isBundledInDisbursement: true,
  });

  // Party Form state
  const [newParty, setNewParty] = useState({
    role: 'CO_APPLICANT' as LoanPartyRole,
    firstName: '',
    lastName: '',
    relationshipWithApplicant: 'SPOUSE',
    phone: '',
    email: '',
    panNumber: '',
    employmentType: 'SALARIED',
    monthlyIncome: '',
  });

  // Action loaders
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Fetch Loan Case by ID
  const {
    data: caseData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['loan-case', caseId],
    queryFn: () => loansRepository.getCaseById(caseId),
    enabled: Boolean(caseId),
  });

  // Safe Fallback Data
  const facilities = caseData?.facilities || [];
  const parties = caseData?.parties || [];
  const documents = caseData?.documents || [];
  const categoryMeta = caseData?.category ? LOAN_CATEGORIES[caseData.category] : null;
  const statusMeta = caseData?.status ? STATUS_CONFIG[caseData.status] : null;

  const borrowerName = caseData?.contact?.firstName
    ? `${caseData.contact.firstName} ${caseData.contact.lastName || ''}`.trim()
    : caseData?.customerSnapshot?.fullName || 'Borrower';
  const borrowerPhone = caseData?.contact?.phone || caseData?.customerSnapshot?.phone || '—';
  const borrowerEmail = caseData?.contact?.email || caseData?.customerSnapshot?.email || '—';
  const borrowerPan = caseData?.contact?.panNumber || caseData?.customerSnapshot?.panNumber || '—';

  const totalRequested = useMemo(() => {
    return facilities.reduce((sum, f) => sum + Number(f.requestedAmount || 0), 0);
  }, [facilities]);

  const totalSanctioned = useMemo(() => {
    return facilities.reduce((sum, f) => {
      const selected = f.lenderOffers?.find((o) => o.status === 'SELECTED' || o.id === f.selectedOfferId);
      return sum + Number(selected?.offeredAmount || 0);
    }, 0);
  }, [facilities]);

  const totalMonthlyEmi = useMemo(() => {
    return facilities.reduce((sum, f) => {
      const selected = f.lenderOffers?.find((o) => o.status === 'SELECTED' || o.id === f.selectedOfferId);
      return sum + Number(selected?.emiAmount || 0);
    }, 0);
  }, [facilities]);

  // Handle Offer Submission
  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFacilityId) return;
    if (!newOffer.lenderName || !newOffer.sanctionedAmount || !newOffer.interestRate || !newOffer.tenureMonths) {
      toast.error('Please fill all mandatory lender offer fields');
      return;
    }

    setIsActionLoading(true);
    try {
      const offeredAmount = parseFloat(String(newOffer.sanctionedAmount).replace(/,/g, ''));
      const feePct = parseFloat(String(newOffer.processingFeePercent).replace(/,/g, '')) || 0.5;
      const processingFee = Math.round((offeredAmount * feePct) / 100);

      await loansRepository.addLenderOffer(targetFacilityId, {
        lenderName: newOffer.lenderName.trim(),
        offeredAmount,
        offeredTenureMonths: parseInt(String(newOffer.tenureMonths).replace(/\D/g, ''), 10),
        interestRateType: newOffer.rateType,
        rateOfInterest: parseFloat(String(newOffer.interestRate).replace(/,/g, '')),
        processingFee,
        otherCharges: newOffer.otherCharges ? parseFloat(String(newOffer.otherCharges).replace(/,/g, '')) : 0,
        remarks: newOffer.notes.trim() || undefined,
      });

      toast.success('Competing lender offer logged successfully');
      setIsAddOfferOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add lender offer');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Select Winning Offer
  const handleSelectOffer = async (facilityId: string, offerId: string) => {
    setIsActionLoading(true);
    try {
      await loansRepository.selectLenderOffer(facilityId, offerId);
      toast.success('Winning lender offer selected!');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to select offer');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Issue Sanction
  const handleIssueSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await loansRepository.issueSanction(caseId, {
        sanctionDate: sanctionForm.sanctionDate,
        sanctionedAmount: sanctionForm.sanctionedAmount
          ? parseFloat(String(sanctionForm.sanctionedAmount).replace(/,/g, ''))
          : undefined,
        notes: sanctionForm.notes.trim() || undefined,
      });
      toast.success('Loan sanction issued successfully!');
      setIsSanctionModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to issue sanction');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Issue Loan / Disbursement
  const handleIssueLoanDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      await loansRepository.issueLoan(caseId, {
        loanAccountNumber: disburseForm.loanAccountNumber.trim() || undefined,
        disbursementDate: disburseForm.disbursementDate,
        disbursedAmount: disburseForm.disbursedAmount
          ? parseFloat(String(disburseForm.disbursedAmount).replace(/,/g, ''))
          : undefined,
        utrNumber: disburseForm.utrNumber.trim() || undefined,
        bankName: disburseForm.bankName.trim() || undefined,
        notes: disburseForm.notes.trim() || undefined,
      });
      toast.success('Loan issued and disbursed successfully!');
      setIsDisburseModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to issue loan');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Update Status
  const handleUpdateStatus = async (status: LoanEnquiryStatus) => {
    setIsActionLoading(true);
    try {
      await loansRepository.updateStatus(caseId, status);
      toast.success(`Loan case updated to ${status.replace(/_/g, ' ')}`);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update status');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Add Facility
  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacility.requestedAmount || !newFacility.requestedTenureMonths) {
      toast.error('Please specify amount and tenure');
      return;
    }

    setIsActionLoading(true);
    try {
      let fType = newFacility.facilityType;
      if ((fType as string) === 'OVERDRAFT' || (fType as string) === 'DROP_LINE_OD') {
        fType = 'OVERDRAFT_CASH_CREDIT';
      }

      await loansRepository.addFacility(caseId, {
        facilityType: fType,
        requestedAmount: parseFloat(String(newFacility.requestedAmount).replace(/,/g, '')),
        tenureMonths: parseInt(String(newFacility.requestedTenureMonths).replace(/\D/g, ''), 10),
        targetRoiPercentage: newFacility.targetInterestRate
          ? parseFloat(String(newFacility.targetInterestRate).replace(/,/g, ''))
          : undefined,
      });

      toast.success('New loan facility appended to case');
      setIsAddFacilityOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add facility');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Add AddOn
  const handleAddAddOn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFacilityId || !newAddOn.sumInsured || !newAddOn.premiumAmount) {
      toast.error('Please specify Sum Insured and Premium Amount');
      return;
    }

    setIsActionLoading(true);
    try {
      const isLife = newAddOn.addOnType === 'CREDIT_LIFE_INSURANCE';
      await loansRepository.configureAddOn(targetFacilityId, {
        creditLifeOpted: isLife,
        creditLifeSumAssured: isLife ? parseFloat(newAddOn.sumInsured) : undefined,
        creditLifePremium: isLife ? parseFloat(newAddOn.premiumAmount) : undefined,
        assetInsuranceOpted: !isLife,
        assetSumAssured: !isLife ? parseFloat(newAddOn.sumInsured) : undefined,
        assetPremium: !isLife ? parseFloat(newAddOn.premiumAmount) : undefined,
      });

      toast.success('Insurance cover add-on attached');
      setIsAddAddOnOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to attach add-on');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Add Party
  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParty.firstName || !newParty.phone) {
      toast.error('First Name and Phone are required');
      return;
    }

    setIsActionLoading(true);
    try {
      await loansRepository.addParty(caseId, {
        role: newParty.role,
        name: `${newParty.firstName.trim()} ${newParty.lastName.trim()}`.trim(),
        relationship: newParty.relationshipWithApplicant,
        mobileNumber: newParty.phone.replace(/\D/g, ''),
        email: newParty.email.trim() || undefined,
        panNumber: newParty.panNumber.trim().toUpperCase() || undefined,
        occupation: newParty.employmentType,
        monthlyIncome: newParty.monthlyIncome ? parseFloat(newParty.monthlyIncome) : undefined,
      });

      toast.success('Party added to loan case');
      setIsAddPartyOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add party');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Submit for Review
  const handleSubmitReview = async () => {
    setIsActionLoading(true);
    try {
      await loansRepository.submitForReview(caseId);
      toast.success('Loan case submitted for underwriting review');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit review');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Document Upload
  const handleUploadDocument = async (docType: string, file: File) => {
    setUploadingDocType(docType);
    try {
      const uploaded = await documentsRepository.uploadDocument(file, 'LOAN_CASE', caseId, {
        name: `${docType}_${file.name}`,
        category: 'LOAN_CHECKLIST',
      });

      await loansRepository.attachDocument(caseId, {
        documentId: uploaded.id,
        documentType: docType,
      });

      toast.success(`${docType} uploaded successfully`);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Document upload failed');
    } finally {
      setUploadingDocType(null);
    }
  };

  // Handle Sanction Letter Upload
  const handleUploadSanctionLetter = async (file: File) => {
    if (!targetOfferId) return;
    setIsActionLoading(true);
    try {
      const uploaded = await documentsRepository.uploadDocument(file, 'LOAN_OFFER', targetOfferId, {
        name: `SANCTION_LETTER_${file.name}`,
        category: 'SANCTION_LETTER',
      });

      await loansRepository.uploadSanctionLetter(targetOfferId, uploaded.id);
      toast.success('Sanction letter attached to offer');
      setIsSanctionUploadOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to attach sanction letter');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Document Verification
  const handleVerifyDocument = async (loanDocId: string, status: 'VERIFIED' | 'REJECTED') => {
    let rejectionReason: string | undefined;
    if (status === 'REJECTED') {
      const reason = window.prompt('Enter rejection reason for this document:');
      if (!reason) return;
      rejectionReason = reason;
    }

    try {
      await loansRepository.verifyDocument(loanDocId, { status, rejectionReason });
      toast.success(`Document marked as ${status}`);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update document status');
    }
  };

  // Handle Preview Document
  const handlePreviewDocument = async (docId: string, fileName?: string) => {
    let previewTab: Window | null = null;
    try {
      previewTab = window.open('', '_blank');
      if (previewTab) {
        previewTab.document.write(
          '<html><head><title>Loading Document...</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#f8fafc;}</style></head><body><div style="text-align:center;"><h2>Loading Preview...</h2><p style="color:#94a3b8;">Please wait while your document is being prepared.</p></div></body></html>'
        );
      }
    } catch {
      previewTab = null;
    }

    try {
      const blob = await documentsRepository.downloadDocument(docId);
      const typedBlob = new Blob([blob], {
        type: fileName?.endsWith('.pdf') ? 'application/pdf' : 'application/pdf',
      });
      const objectUrl = URL.createObjectURL(typedBlob);
      if (previewTab && !previewTab.closed) {
        previewTab.location.href = objectUrl;
      } else {
        window.open(objectUrl, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    } catch {
      if (previewTab && !previewTab.closed) previewTab.close();
      toast.error('Failed to open document preview');
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card border border-border p-6 rounded-xl shadow-xl flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs font-semibold text-foreground">Loading Loan Case Details...</span>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card border border-border p-6 rounded-xl shadow-xl text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-xs font-semibold text-foreground">Loan case record not found</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border px-6 py-4 bg-muted/40 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">
                  {caseData.caseCode}
                </span>
                {categoryMeta && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryMeta.badgeColor}`}>
                    {categoryMeta.name}
                  </span>
                )}
                {statusMeta && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                <span>
                  Borrower: <strong className="text-foreground">{borrowerName}</strong>
                </span>
                <span>•</span>
                <span className="font-mono">{borrowerPhone}</span>
                {caseData.agent?.agentCode && (
                  <>
                    <span>•</span>
                    <span>Agent: {caseData.agent.agentCode}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(caseData.status === 'DRAFT' || caseData.status === 'DOCUMENTS_PENDING') && (
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={isActionLoading}
                className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Submit to Underwriting
              </button>
            )}

            {caseData.status === 'SUBMITTED_FOR_REVIEW' && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('UNDERWRITING_IN_PROGRESS')}
                disabled={isActionLoading}
                className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <FileCheck className="h-3.5 w-3.5" />
                Begin Underwriting
              </button>
            )}

            {caseData.status === 'OFFER_SELECTED' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSanctionModalOpen(true)}
                  disabled={isActionLoading}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Award className="h-3.5 w-3.5" />
                  Issue Sanction
                </button>
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(true)}
                  disabled={isActionLoading}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Issue Loan / Disburse
                </button>
              </>
            )}

            {caseData.status === 'SANCTIONED' && (
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(true)}
                disabled={isActionLoading}
                className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Issue Loan / Disburse
              </button>
            )}

            {caseData.status === 'DISBURSED' && (
              <div className="px-3 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Disbursed
              </div>
            )}

            <button
              type="button"
              onClick={() => refetch()}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Disbursed Banner */}
        {caseData.status === 'DISBURSED' && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-full bg-emerald-600 text-white">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Loan Formally Issued & Disbursed
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 ml-2">
                  Account: <strong>{(caseData.categoryData as any)?.disbursementDetails?.loanAccountNumber || 'N/A'}</strong> | Bank: <strong>{(caseData.categoryData as any)?.disbursementDetails?.bankName || 'Disbursed'}</strong>
                </span>
              </div>
            </div>
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Disbursed Principal: ₹{Number((caseData.categoryData as any)?.disbursementDetails?.disbursedAmount || totalSanctioned || totalRequested).toLocaleString('en-IN')}
              {(caseData.categoryData as any)?.disbursementDetails?.utrNumber && (
                <span className="ml-2 font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                  UTR: {(caseData.categoryData as any).disbursementDetails.utrNumber}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Financial KPI Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border bg-muted/10 divide-x divide-border">
          <div className="px-5 py-3">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Requested Principal
            </div>
            <div className="text-base font-black text-foreground mt-0.5">
              ₹{totalRequested.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="px-5 py-3">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Sanctioned Value
            </div>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totalSanctioned > 0 ? `₹${totalSanctioned.toLocaleString('en-IN')}` : 'Pending Sanction'}
            </div>
          </div>
          <div className="px-5 py-3">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Selected Total EMI
            </div>
            <div className="text-base font-black text-foreground mt-0.5">
              {totalMonthlyEmi > 0 ? `₹${totalMonthlyEmi.toLocaleString('en-IN')}/mo` : '—'}
            </div>
          </div>
          <div className="px-5 py-3">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              CIBIL & Obligations
            </div>
            <div className="text-xs font-bold text-foreground mt-1 flex items-center gap-2">
              <span>Score: {caseData.cibilScore || 'N/A'}</span>
              <span>•</span>
              <span>EMIs: ₹{(caseData.existingEmiObligations || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-border px-6 pt-2 bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTab('FACILITIES')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'FACILITIES'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-4 w-4" />
            Facilities & Competing Lender Offers ({facilities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('APPLICANT')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'APPLICANT'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-4 w-4" />
            Borrower Profile & Asset Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PARTIES')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'PARTIES'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            Co-Borrowers & Guarantors ({parties.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'DOCUMENTS'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            Document Checklist ({documents.length})
          </button>
        </div>

        {/* Workspace Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: Facilities & Lender Offers */}
          {activeTab === 'FACILITIES' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Loan Facilities & Competing Bank Offers
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Log multi-lender quotes, run side-by-side comparison, and confirm selected sanction
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddFacilityOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border hover:bg-muted text-foreground flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Facility
                </button>
              </div>

              {facilities.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/5">
                  <p className="text-xs font-semibold text-foreground">No facilities logged</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click &quot;Add Facility&quot; to configure a Term Loan or Balance Transfer
                  </p>
                </div>
              ) : (
                facilities.map((facility, fIdx) => {
                  const selectedOffer =
                    facility.selectedOffer ||
                    facility.lenderOffers?.find((o) => o.status === 'SELECTED' || o.id === facility.selectedOfferId);
                  return (
                    <div
                      key={facility.id}
                      className="border border-border rounded-xl p-5 bg-card shadow-sm space-y-4"
                    >
                      {/* Facility Sub-Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-foreground">
                              Facility #{fIdx + 1}: {facility.facilityType.replace(/_/g, ' ')}
                            </span>
                            {selectedOffer && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Winner: {selectedOffer.lenderName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                            <span>
                              Requested:{' '}
                              <strong className="text-foreground">
                                ₹{Number(facility.requestedAmount).toLocaleString('en-IN')}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>Tenure: {facility.tenureMonths} Mos</span>
                            {facility.targetRoiPercentage && (
                              <>
                                <span>•</span>
                                <span>Target: {facility.targetRoiPercentage}%</span>
                              </>
                            )}
                            {facility.existingLenderName && (
                              <>
                                <span>•</span>
                                <span className="text-amber-700 dark:text-amber-300">
                                  BT from: {facility.existingLenderName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetFacilityId(facility.id);
                              setNewOffer({
                                ...newOffer,
                                sanctionedAmount: String(facility.requestedAmount),
                                tenureMonths: String(facility.tenureMonths),
                              });
                              setIsAddOfferOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Log Lender Offer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetFacilityId(facility.id);
                              setIsAddAddOnOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border hover:bg-muted text-foreground flex items-center gap-1"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Insurance Add-ons
                          </button>
                        </div>
                      </div>

                      {/* Offers List */}
                      <div>
                        <div className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                          <span>Competing Lender Offers ({facility.lenderOffers?.length || 0})</span>
                          <span className="text-[11px] text-muted-foreground font-normal">
                            All Processing Fees include statutory 18% GST
                          </span>
                        </div>

                        {!facility.lenderOffers || facility.lenderOffers.length === 0 ? (
                          <div className="p-4 text-center border border-dashed border-border/80 rounded-lg bg-muted/10 text-xs text-muted-foreground">
                            No lender quotes logged yet. Click &quot;Log Lender Offer&quot; to register quotes from HDFC, SBI, ICICI, etc.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {facility.lenderOffers.map((offer) => {
                              const isSelected =
                                offer.status === 'SELECTED' || offer.id === facility.selectedOfferId;
                              return (
                                <div
                                  key={offer.id}
                                  className={`border rounded-lg p-3.5 transition-all flex flex-col justify-between ${
                                    isSelected
                                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                                      : 'border-border bg-card'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h4 className="text-xs font-bold text-foreground">
                                          {offer.lenderName}
                                        </h4>
                                      </div>
                                      {isSelected ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                                          <Check className="h-3 w-3" /> Selected
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                          {offer.status}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-3 space-y-1.5 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Offered Principal:</span>
                                        <span className="font-bold text-foreground">
                                          ₹{Number(offer.offeredAmount).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rate:</span>
                                        <span className="font-semibold text-foreground">
                                          {offer.rateOfInterest}% ({offer.interestRateType || 'FLOATING'})
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tenure:</span>
                                        <span>{offer.offeredTenureMonths} Months</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Monthly EMI:</span>
                                        <span className="font-bold text-primary">
                                          ₹{Number(offer.emiAmount).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-muted-foreground">PF + 18% GST:</span>
                                        <span className="font-mono">
                                          ₹{Number(offer.totalChargesInclGst || 0).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 pt-2.5 border-t border-border/80 flex items-center justify-between gap-2">
                                    {!isSelected ? (
                                      <button
                                        type="button"
                                        onClick={() => handleSelectOffer(facility.id, offer.id)}
                                        className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                                      >
                                        <Award className="h-3 w-3" /> Select Winner
                                      </button>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                        Selected Offer
                                      </span>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                      {offer.sanctionLetterDocId ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handlePreviewDocument(
                                              offer.sanctionLetterDocId!,
                                              offer.sanctionLetterDoc?.originalFileName
                                            )
                                          }
                                          className="p-1 rounded hover:bg-muted text-primary"
                                          title="Preview Sanction Letter"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTargetOfferId(offer.id);
                                            setIsSanctionUploadOpen(true);
                                          }}
                                          className="px-2 py-1 text-[10px] font-medium rounded border border-border hover:bg-muted text-foreground flex items-center gap-1"
                                        >
                                          <Upload className="h-3 w-3" /> Sanction Doc
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Add-ons List */}
                      {facility.addOns && facility.addOns.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <div className="text-[11px] font-bold text-foreground mb-2">
                            Insurance & Collateral Add-ons
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {facility.addOns.map((addon) => (
                              <div
                                key={addon.id}
                                className="p-2.5 rounded-lg border border-border bg-muted/10 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {addon.creditLifeOpted ? 'Credit Life Loan Protection' : 'Property / Asset Insurance'}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    SI: ₹{Number(addon.creditLifeSumAssured || addon.assetSumAssured || 0).toLocaleString('en-IN')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-foreground font-mono">
                                    ₹{Number(addon.totalPremiumInclGst).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Borrower Profile & Category Specific Data */}
          {activeTab === 'APPLICANT' && (
            <div className="space-y-6">
              {/* Primary Borrower Data */}
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground border-b border-border pb-2">
                  Primary Borrower Profile & Financial Health
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Full Name</span>
                    <span className="font-semibold text-foreground">{borrowerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Mobile Phone</span>
                    <span className="font-mono text-foreground">{borrowerPhone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Email</span>
                    <span className="text-foreground">{borrowerEmail}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">PAN Number</span>
                    <span className="font-mono text-foreground font-semibold">
                      {borrowerPan}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Employer / Business</span>
                    <span className="text-foreground">{caseData.employerBusinessName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Occupation Nature</span>
                    <span className="text-foreground">{caseData.occupationType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Monthly Income</span>
                    <span className="font-semibold text-foreground">
                      ₹{Number(caseData.monthlyIncome || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Existing Monthly EMIs</span>
                    <span className="font-semibold text-foreground">
                      ₹{Number(caseData.existingEmiObligations || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">CIBIL Credit Score</span>
                    <span className="font-bold text-foreground">
                      {caseData.cibilScore || 'Not Pulled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Category Specific Data */}
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground border-b border-border pb-2">
                  {categoryMeta?.name} — Specific Collateral & Requirement Parameters
                </h4>

                {caseData.categoryData && Object.keys(caseData.categoryData).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    {Object.entries(caseData.categoryData).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg border border-border/60 bg-muted/10">
                        <span className="text-muted-foreground block text-[11px] capitalize">
                          {k.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="font-semibold text-foreground">
                          {typeof v === 'boolean'
                            ? v
                              ? 'Yes'
                              : 'No'
                            : typeof v === 'number'
                            ? v.toLocaleString('en-IN')
                            : String(v || '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No category-specific parameters captured.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Co-Borrowers & Guarantors */}
          {activeTab === 'PARTIES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Co-Applicants & Guarantors
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Parties liable for debt obligations or pledge of collateral
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddPartyOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Co-Borrower
                </button>
              </div>

              {parties.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/5">
                  <User className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-foreground">No joint parties registered</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click &quot;Add Co-Borrower&quot; to attach a joint applicant or financial guarantor
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parties.map((p) => (
                    <div
                      key={p.id}
                      className="border border-border rounded-lg p-4 bg-card shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Relationship: {p.relationship || 'Joint'}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {p.role.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground text-[10px] block">Mobile:</span>
                          <span className="font-mono">{p.mobileNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">PAN:</span>
                          <span className="font-mono font-semibold">{p.panNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">Occupation:</span>
                          <span>{p.occupation || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">Monthly Income:</span>
                          <span>₹{Number(p.monthlyIncome || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Document Checklist & Verification */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Mandatory Checklist for {categoryMeta?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload borrower KYC, income proofs, and asset title documents per underwriting criteria
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-foreground">
                  {documents.filter((d) => d.status === 'VERIFIED').length} /{' '}
                  {(CATEGORY_DOCUMENT_CHECKLISTS[caseData.category] || []).length} Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(CATEGORY_DOCUMENT_CHECKLISTS[caseData.category] || []).map((item) => {
                  const attached = documents.find((d) => d.documentType === item.id);
                  const isUploading = uploadingDocType === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3.5 transition-all flex flex-col justify-between ${
                        attached?.status === 'VERIFIED'
                          ? 'border-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/10'
                          : attached?.status === 'REJECTED'
                          ? 'border-rose-300 bg-rose-50/20 dark:bg-rose-950/10'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              {item.name}
                              {item.mandatory && (
                                <span className="text-[10px] text-destructive font-semibold">
                                  *
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {item.helpText}
                            </p>
                          </div>

                          {attached ? (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                attached.status === 'VERIFIED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : attached.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {attached.status}
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Missing
                            </span>
                          )}
                        </div>

                        {attached && (
                          <div className="mt-2 text-xs flex items-center justify-between text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                            <span className="truncate max-w-[200px] text-[11px] font-mono">
                              {attached.document?.originalFileName}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handlePreviewDocument(
                                    attached.documentId,
                                    attached.document?.originalFileName
                                  )
                                }
                                className="p-1 rounded hover:bg-muted text-primary"
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
                        <div>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadDocument(item.id, f);
                              }}
                            />
                            <span className="px-2.5 py-1 text-[11px] font-semibold rounded border border-border hover:bg-muted text-foreground inline-flex items-center gap-1">
                              {isUploading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Upload className="h-3 w-3" />
                              )}
                              {attached ? 'Re-Upload' : 'Upload'}
                            </span>
                          </label>
                        </div>

                        {attached && attached.status !== 'VERIFIED' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleVerifyDocument(attached.id, 'VERIFIED')}
                              className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifyDocument(attached.id, 'REJECTED')}
                              className="px-2 py-1 text-[10px] font-bold rounded bg-rose-600 text-white hover:bg-rose-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* MODAL: ADD COMPETING LENDER OFFER */}
        {/* ============================================================== */}
        {isAddOfferOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-foreground">
                  Log Competing Bank / NBFC Offer
                </h3>
                <button onClick={() => setIsAddOfferOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddOffer} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-foreground">Lender / Bank Name *</label>
                    <input
                      type="text"
                      required
                      value={newOffer.lenderName}
                      onChange={(e) => setNewOffer({ ...newOffer, lenderName: e.target.value })}
                      placeholder="e.g. HDFC Bank, ICICI Bank, State Bank of India"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Offered Principal (₹) *</label>
                    <input
                      type="number"
                      required
                      value={newOffer.sanctionedAmount}
                      onChange={(e) => setNewOffer({ ...newOffer, sanctionedAmount: e.target.value })}
                      placeholder="e.g. 4500000"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Approved Rate (% p.a.) *</label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={newOffer.interestRate}
                      onChange={(e) => setNewOffer({ ...newOffer, interestRate: e.target.value })}
                      placeholder="e.g. 8.50"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Rate Structure</label>
                    <select
                      value={newOffer.rateType}
                      onChange={(e) => setNewOffer({ ...newOffer, rateType: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    >
                      <option value="FLOATING">Floating (Repo Linked)</option>
                      <option value="FIXED">Fixed Rate</option>
                      <option value="HYBRID">Hybrid (Fixed then Floating)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Tenure (Months) *</label>
                    <input
                      type="number"
                      required
                      value={newOffer.tenureMonths}
                      onChange={(e) => setNewOffer({ ...newOffer, tenureMonths: e.target.value })}
                      placeholder="e.g. 240"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Processing Fee (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={newOffer.processingFeePercent}
                      onChange={(e) => setNewOffer({ ...newOffer, processingFeePercent: e.target.value })}
                      placeholder="e.g. 0.50"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Admin / Other Charges (₹)</label>
                    <input
                      type="number"
                      value={newOffer.otherCharges}
                      onChange={(e) => setNewOffer({ ...newOffer, otherCharges: e.target.value })}
                      placeholder="e.g. 3500"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddOfferOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Save Offer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: ADD LOAN FACILITY */}
        {/* ============================================================== */}
        {isAddFacilityOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-foreground">Add Loan Facility</h3>
                <button onClick={() => setIsAddFacilityOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddFacility} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Facility Type</label>
                  <select
                    value={newFacility.facilityType}
                    onChange={(e) => setNewFacility({ ...newFacility, facilityType: e.target.value as LoanFacilityType })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                  >
                    <option value="NEW_TERM_LOAN">New Term Loan</option>
                    <option value="BALANCE_TRANSFER">Balance Transfer</option>
                    <option value="TOP_UP">Top-Up Loan</option>
                    <option value="OVERDRAFT_CASH_CREDIT">Overdraft / Cash Credit (OD/CC)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Requested Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newFacility.requestedAmount}
                    onChange={(e) => setNewFacility({ ...newFacility, requestedAmount: e.target.value })}
                    placeholder="e.g. 1000000"
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Requested Tenure (Months) *</label>
                  <input
                    type="number"
                    required
                    value={newFacility.requestedTenureMonths}
                    onChange={(e) => setNewFacility({ ...newFacility, requestedTenureMonths: e.target.value })}
                    placeholder="e.g. 120"
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddFacilityOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Add Facility
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: ADD INSURANCE ADD-ON */}
        {/* ============================================================== */}
        {isAddAddOnOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-foreground">Configure Insurance Add-On</h3>
                <button onClick={() => setIsAddAddOnOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddAddOn} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Add-on Cover Type</label>
                  <select
                    value={newAddOn.addOnType}
                    onChange={(e) => setNewAddOn({ ...newAddOn, addOnType: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                  >
                    <option value="CREDIT_LIFE_INSURANCE">Credit Life Loan Protection</option>
                    <option value="PROPERTY_INSURANCE">Property / Asset Insurance</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Sum Insured (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newAddOn.sumInsured}
                    onChange={(e) => setNewAddOn({ ...newAddOn, sumInsured: e.target.value })}
                    placeholder="e.g. 5000000"
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Net Premium Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newAddOn.premiumAmount}
                    onChange={(e) => setNewAddOn({ ...newAddOn, premiumAmount: e.target.value })}
                    placeholder="e.g. 42000"
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    18% GST will be calculated automatically
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddAddOnOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Attach Cover
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: ADD CO-BORROWER / PARTY */}
        {/* ============================================================== */}
        {isAddPartyOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-foreground">Add Co-Applicant / Guarantor</h3>
                <button onClick={() => setIsAddPartyOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddParty} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">First Name *</label>
                    <input
                      type="text"
                      required
                      value={newParty.firstName}
                      onChange={(e) => setNewParty({ ...newParty, firstName: e.target.value })}
                      placeholder="First Name"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Last Name</label>
                    <input
                      type="text"
                      value={newParty.lastName}
                      onChange={(e) => setNewParty({ ...newParty, lastName: e.target.value })}
                      placeholder="Last Name"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Role</label>
                    <select
                      value={newParty.role}
                      onChange={(e) => setNewParty({ ...newParty, role: e.target.value as LoanPartyRole })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    >
                      <option value="CO_APPLICANT">Co-Applicant</option>
                      <option value="GUARANTOR">Guarantor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Relationship</label>
                    <input
                      type="text"
                      value={newParty.relationshipWithApplicant}
                      onChange={(e) => setNewParty({ ...newParty, relationshipWithApplicant: e.target.value })}
                      placeholder="e.g. Spouse, Father"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Mobile *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={newParty.phone}
                      onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                      placeholder="10 digit mobile"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">PAN</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={newParty.panNumber}
                      onChange={(e) => setNewParty({ ...newParty, panNumber: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono rounded border border-input bg-background"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddPartyOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Save Party
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: UPLOAD SANCTION LETTER */}
        {/* ============================================================== */}
        {isSanctionUploadOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-foreground">Upload Formal Sanction Letter</h3>
                <button onClick={() => setIsSanctionUploadOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs text-muted-foreground">
                  Select Bank / NBFC issued official sanction letter (PDF / JPG):
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadSanctionLetter(f);
                  }}
                  className="w-full text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: ISSUE SANCTION */}
        {/* ============================================================== */}
        {isSanctionModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-600" />
                    Issue Formal Loan Sanction
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Record formal lender sanction and move case to Sanctioned state
                  </p>
                </div>
                <button onClick={() => setIsSanctionModalOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleIssueSanction} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Sanction Date *</label>
                  <input
                    type="date"
                    required
                    value={sanctionForm.sanctionDate}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionDate: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Sanctioned Amount (₹)</label>
                  <input
                    type="number"
                    value={sanctionForm.sanctionedAmount}
                    placeholder={String(totalSanctioned || totalRequested)}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionedAmount: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Sanction Terms / Notes</label>
                  <textarea
                    rows={2}
                    value={sanctionForm.notes}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, notes: e.target.value })}
                    placeholder="Sanction conditions, pre-disbursement requirements..."
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsSanctionModalOpen(false)}
                    className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5"
                  >
                    {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    Confirm Sanction
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: ISSUE LOAN / DISBURSEMENT */}
        {/* ============================================================== */}
        {isDisburseModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Issue Loan / Execute Disbursement
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Record loan account reference, disbursement release, and UTR payment details
                  </p>
                </div>
                <button onClick={() => setIsDisburseModalOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleIssueLoanDisbursement} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Lender / Partner Bank</label>
                    <input
                      type="text"
                      value={disburseForm.bankName}
                      placeholder="e.g. HDFC Bank, SBI, Tata Capital"
                      onChange={(e) => setDisburseForm({ ...disburseForm, bankName: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Loan Account Number</label>
                    <input
                      type="text"
                      value={disburseForm.loanAccountNumber}
                      placeholder="e.g. HDFC-HL-2026-908"
                      onChange={(e) => setDisburseForm({ ...disburseForm, loanAccountNumber: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Disbursed Principal Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      value={disburseForm.disbursedAmount}
                      placeholder={String(totalSanctioned || totalRequested)}
                      onChange={(e) => setDisburseForm({ ...disburseForm, disbursedAmount: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Disbursement Date *</label>
                    <input
                      type="date"
                      required
                      value={disburseForm.disbursementDate}
                      onChange={(e) => setDisburseForm({ ...disburseForm, disbursementDate: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">UTR Number / Payment Ref</label>
                  <input
                    type="text"
                    value={disburseForm.utrNumber}
                    placeholder="e.g. HDFCN26110688741"
                    onChange={(e) => setDisburseForm({ ...disburseForm, utrNumber: e.target.value })}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Disbursement Remarks / Notes</label>
                  <textarea
                    rows={2}
                    value={disburseForm.notes}
                    onChange={(e) => setDisburseForm({ ...disburseForm, notes: e.target.value })}
                    placeholder="First tranche disbursed directly to builder escrow account..."
                    className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsDisburseModalOpen(false)}
                    className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="px-5 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                  >
                    {isActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    Confirm Loan Disbursement & Issuance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

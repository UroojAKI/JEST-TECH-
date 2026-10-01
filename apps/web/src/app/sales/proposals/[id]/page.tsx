'use client';

import React, { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { StatusBadge } from '../../../../components/ui/status-badge';
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  FileText,
  Lock,
  ArrowRight,
  Eye,
  Calendar,
  Loader2,
  Upload,
  XCircle,
  Building2,
  User,
} from 'lucide-react';
import { useProposalWorkspace } from '../../../../hooks/useProposals';
import { useAuth } from '../../../../hooks/useAuth';
import { formatCurrency } from '../../../../lib/formatters';
import { proposalsRepository } from '../../../../repositories/proposals.repository';
import { apiClient } from '../../../../lib/api-client';
import { toast } from 'sonner';

export default function ProposalWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const proposalId = (params?.id as string) || '';

  const {
    proposal,
    isLoading,
    isError,
    issuePolicy,
    isIssuing,
    reviewProposal,
    isReviewing,
  } = useProposalWorkspace(proposalId);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [reviewModal, setReviewModal] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = (user as any)?.role || 'AGENT';
  const isBackOfficeOrAdmin = userRole === 'ADMIN' || userRole === 'BACK_OFFICE';

  const documents = (proposal as any)?.documents || [];
  const mandatoryDocs = documents.filter((d: any) => d.mandatory);
  const uploadedMandatory = mandatoryDocs.filter((d: any) => Boolean(d.documentId));
  const progressPct = mandatoryDocs.length
    ? Math.round((uploadedMandatory.length / mandatoryDocs.length) * 100)
    : 100;

  const isApproved =
    proposal?.status === 'APPROVED' || proposal?.status === 'POLICY_ISSUED';
  const isReadyToIssue =
    progressPct === 100 &&
    isApproved &&
    proposal?.status !== 'POLICY_ISSUED' &&
    isBackOfficeOrAdmin;

  const handleUploadClick = (checklistItemId: string) => {
    setUploadingItemId(checklistItemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingItemId || !proposalId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('entityType', 'PROPOSAL');
      formData.append('entityId', proposalId);

      const uploadRes = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const documentId = uploadRes.data?.id || uploadRes.data?.document?.id;
      if (!documentId) {
        throw new Error('Document ID missing in upload response');
      }

      await proposalsRepository.attachDocument(
        proposalId,
        uploadingItemId,
        documentId,
      );

      toast.success(`Document '${file.name}' attached successfully!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadingItemId(null);
      window.location.reload();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to upload document',
      );
      setUploadingItemId(null);
    }
  };

  const handleIssuePolicyClick = async () => {
    try {
      await issuePolicy();
      toast.success(`Policy issued successfully for Proposal #${proposal?.proposalNumber || proposalId}!`);
      router.push('/policies');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to issue policy');
    }
  };

  const handleConfirmReview = () => {
    if (!reviewModal) return;
    reviewProposal(
      {
        approve: reviewModal === 'APPROVE',
        remarks: reviewRemarks.trim() || (reviewModal === 'APPROVE' ? 'Approved by underwriter' : 'Rejected'),
      },
      {
        onSuccess: () => {
          setReviewModal(null);
          setReviewRemarks('');
        },
      },
    );
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <span>Loading proposal workspace...</span>
        </div>
      </AppShell>
    );
  }

  if (isError || !proposal) {
    return (
      <AppShell>
        <div className="p-8 rounded-2xl border bg-card text-center space-y-3 mt-6 max-w-lg mx-auto">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-sm">Proposal Not Found</h3>
          <p className="text-xs text-muted-foreground">
            The requested proposal #{proposalId} could not be loaded or belongs to another organization.
          </p>
        </div>
      </AppShell>
    );
  }

  const quoteRef =
    (proposal as any).quotation?.quotationNumber ||
    proposal.quotationId ||
    'Quotation Record';

  return (
    <AppShell>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 1. Header & Underwriting State Machine Stepper */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-extrabold tracking-tight">
                Proposal #{proposal.proposalNumber || proposalId}
              </h1>
              <StatusBadge status={proposal.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Customer: <strong className="text-foreground">{proposal.contactName || 'Customer Prospect'}</strong></span>
              <span>Quote Reference: <strong className="text-primary font-bold">{quoteRef}</strong></span>
              <span>Product: <strong className="text-foreground">{proposal.productLine || 'Motor Comprehensive'}</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>Preview Policy Draft</span>
            </button>

            {/* Underwriter Review Controls for Back Office */}
            {isBackOfficeOrAdmin &&
              (proposal.status === 'SUBMITTED' ||
                proposal.status === 'UNDER_REVIEW') && (
                <>
                  <button
                    onClick={() => setReviewModal('REJECT')}
                    disabled={isReviewing}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setReviewModal('APPROVE')}
                    disabled={isReviewing}
                    className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Approve Proposal
                  </button>
                </>
              )}

            {/* Issue Policy Button */}
            {isBackOfficeOrAdmin && (
              <button
                disabled={!isReadyToIssue || isIssuing}
                onClick={handleIssuePolicyClick}
                className={`flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${
                  isReadyToIssue
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {isIssuing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : !isReadyToIssue ? (
                  <Lock className="h-3.5 w-3.5 mr-1" />
                ) : null}
                <span>
                  {isIssuing
                    ? 'Issuing Policy...'
                    : proposal.status === 'POLICY_ISSUED'
                    ? 'Policy Already Issued'
                    : 'Issue Policy Now'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* State Machine Stepper */}
        <div className="grid grid-cols-5 gap-2 text-center pt-2 text-xs border-t">
          {[
            { label: 'Draft', done: true, current: proposal.status === 'DRAFT' },
            {
              label: 'Submitted',
              done: proposal.status !== 'DRAFT',
              current: proposal.status === 'SUBMITTED',
            },
            {
              label: 'Under Review',
              done:
                proposal.status === 'UNDER_REVIEW' ||
                proposal.status === 'APPROVED' ||
                proposal.status === 'POLICY_ISSUED',
              current: proposal.status === 'UNDER_REVIEW',
            },
            {
              label: 'Approved',
              done:
                proposal.status === 'APPROVED' ||
                proposal.status === 'POLICY_ISSUED',
              current: proposal.status === 'APPROVED',
            },
            {
              label: 'Policy Issued',
              done: proposal.status === 'POLICY_ISSUED',
              current: proposal.status === 'POLICY_ISSUED',
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`p-2 rounded-lg border flex flex-col items-center space-y-0.5 ${
                s.current
                  ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                  : s.done
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold'
                  : 'bg-muted/20 text-muted-foreground'
              }`}
            >
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Mandatory Document Checklist Progress */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3 mt-4">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center space-x-2">
            <FileCheck className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Mandatory Document Checklist
            </h3>
          </div>
          <span className="text-xs font-bold text-primary">
            {progressPct}% Complete ({uploadedMandatory.length}/{mandatoryDocs.length})
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              progressPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
          {documents.length === 0 ? (
            <div className="p-4 rounded-xl border bg-muted/20 text-muted-foreground col-span-2 text-center">
              No document checklist items attached to this proposal.
            </div>
          ) : (
            documents.map((item: any) => {
              const isFulfilled = Boolean(item.documentId || item.verified);
              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg border bg-muted/10 flex justify-between items-center"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      {item.remarks || item.document?.name || 'Document Item'}
                    </span>
                    {item.document?.name && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {item.document.name}
                      </span>
                    )}
                  </div>

                  {isFulfilled ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 font-bold flex items-center shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Fulfilled
                    </span>
                  ) : (
                    <button
                      onClick={() => handleUploadClick(item.id)}
                      className="px-2.5 py-1 rounded text-[10px] bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex items-center gap-1 shrink-0"
                    >
                      <Upload className="h-3 w-3" />
                      <span>Upload</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Underwriting Risk Indicators & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Risk Assessment */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2">
            Underwriting Financial & Risk Indicators
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                Underwriting Risk Score
              </span>
              <div className="font-bold text-emerald-600">
                {proposal.riskScore != null ? `${proposal.riskScore}/100` : 'Standard Risk'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                Total Payable Premium
              </span>
              <div
                className="font-bold text-emerald-600"
                suppressHydrationWarning
              >
                {formatCurrency(proposal.totalPremium || 0)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                Document Attachments
              </span>
              <div className="font-bold text-foreground">
                {uploadedMandatory.length} / {mandatoryDocs.length} Verified
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                Claim History / NCB
              </span>
              <div className="font-bold text-emerald-600">
                {(proposal as any).quotation?.previousPolicy?.claimCount === 0
                  ? 'No Claims (NCB Applied)'
                  : 'Standard Portfolio'}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow & Assignment Metadata */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" /> Proposal Metadata & Audit
          </h3>
          <div className="space-y-2 text-xs">
            <div>
              Creation Date:{' '}
              <strong className="text-foreground">
                {proposal.createdAt
                  ? new Date(proposal.createdAt).toLocaleDateString()
                  : 'Active'}
              </strong>
            </div>
            <div>
              Submitted By:{' '}
              <strong className="text-foreground">
                {(proposal as any).submittedBy?.firstName
                  ? `${(proposal as any).submittedBy.firstName} ${(proposal as any).submittedBy.lastName || ''}`
                  : 'Sales Agent'}
              </strong>
            </div>
            <div>
              Current Workflow Action:{' '}
              <strong className="text-primary font-bold">
                {(proposal as any).workflowState?.nextAction || 'Underwriter Assessment'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Policy Draft Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-sm">
                  Policy Draft Schedule — {proposal.productLine || 'Motor Comprehensive'}
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Reference: {proposal.proposalNumber || proposalId}
                </span>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 hover:bg-accent rounded text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Insured Customer</span>
                  <div className="font-bold">{proposal.contactName || 'Customer Prospect'}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Underlying Quotation</span>
                  <div className="font-mono font-bold text-primary">{quoteRef}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Final Payable Premium</span>
                  <div className="font-bold text-emerald-600">{formatCurrency(proposal.totalPremium || 0)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Evidence Verified</span>
                  <div className="font-bold">{uploadedMandatory.length} of {mandatoryDocs.length} Mandatory Files</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-background text-[11px] text-muted-foreground font-mono">
                [JEST Policy CRM Authority Certificate: Validated for Issuance upon Underwriting Approval]
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Underwriter Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                {reviewModal === 'APPROVE' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>Approve Proposal Terms</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-rose-600" />
                    <span>Reject Proposal</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {reviewModal === 'APPROVE'
                  ? 'Confirm underwriting sign-off. This will clear the proposal approval gate for policy issuance.'
                  : 'Enter the underwriting rejection reason to return this proposal for agent rework.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                Underwriter Notes / Justification
              </label>
              <textarea
                rows={3}
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Enter remarks..."
                className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setReviewModal(null);
                  setReviewRemarks('');
                }}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={isReviewing}
                onClick={handleConfirmReview}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition disabled:opacity-50 ${
                  reviewModal === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isReviewing
                  ? 'Processing...'
                  : reviewModal === 'APPROVE'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

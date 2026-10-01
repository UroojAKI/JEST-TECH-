'use client';

import React, { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { StatusBadge } from '../../../components/ui/status-badge';
import {
  Upload,
  CheckCircle2,
  FileText,
  Send,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProposals, useProposalWorkspace } from '../../../hooks/useProposals';
import { proposalsRepository } from '../../../repositories/proposals.repository';
import { apiClient } from '../../../lib/api-client';

export default function AgentProposalsPage() {
  const searchParams = useSearchParams();
  const queryProposalId = searchParams.get('proposalId') || searchParams.get('id');

  const { proposals, isLoading: isLoadingList } = useProposals({
    page: 1,
    limit: 10,
  });
  const [selectedProposalId, setSelectedProposalId] = useState<string>(
    queryProposalId || '',
  );

  const activeId = selectedProposalId || proposals?.[0]?.id || '';

  const {
    proposal,
    isLoading: isLoadingProposal,
    isError,
  } = useProposalWorkspace(activeId);

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadButtonClick = (checklistItemId: string) => {
    setUploadingItemId(checklistItemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingItemId || !activeId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('entityType', 'PROPOSAL');
      formData.append('entityId', activeId);

      const uploadRes = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const documentId = uploadRes.data?.id || uploadRes.data?.document?.id;
      if (!documentId) {
        throw new Error('Document ID missing in upload response');
      }

      await proposalsRepository.attachDocument(
        activeId,
        uploadingItemId,
        documentId,
      );

      toast.success(`Document '${file.name}' attached successfully!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadingItemId(null);
      window.location.reload();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to upload document',
      );
      setUploadingItemId(null);
    }
  };

  const handleSubmit = async () => {
    if (!activeId) return;
    setIsSubmitting(true);
    try {
      await proposalsRepository.submitProposal(activeId);
      toast.success(
        `Proposal #${proposal?.proposalNumber || activeId} submitted for underwriting review!`,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to submit proposal for review',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const documents = (proposal as any)?.documents || [];
  const mandatoryDocs = documents.filter((d: any) => d.mandatory);
  const uploadedMandatory = mandatoryDocs.filter((d: any) => Boolean(d.documentId));
  const canSubmit =
    mandatoryDocs.length > 0 &&
    uploadedMandatory.length === mandatoryDocs.length &&
    proposal?.status === 'DRAFT';

  return (
    <AppShell>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Proposal Submission & Document Upload Checklist
          </h1>
          <p className="text-xs text-muted-foreground">
            Upload RC copy, previous policy, Aadhaar/PAN, and submit for underwriting review
          </p>
        </div>

        {/* Proposal Selector if multiple exist */}
        {proposals && proposals.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">Select Proposal:</span>
            <select
              value={activeId}
              onChange={(e) => setSelectedProposalId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border bg-background text-xs font-bold"
            >
              {proposals.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.proposalNumber} — {p.contactName || 'Customer'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoadingList || (activeId && isLoadingProposal) ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Loading proposal workspace...</span>
        </div>
      ) : !activeId || !proposal ? (
        <div className="p-8 rounded-2xl border bg-card text-center space-y-2 mt-4 max-w-xl mx-auto">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
          <h3 className="font-bold text-sm">No Active Proposal Found</h3>
          <p className="text-xs text-muted-foreground">
            Please select an existing quote to generate a proposal or create a new proposal from the sales pipeline.
          </p>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-5 text-xs max-w-3xl mt-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Proposal Number</span>
              <div className="font-mono font-extrabold text-base text-foreground">
                {proposal.proposalNumber}
              </div>
            </div>
            <StatusBadge status={proposal.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">
                Customer Full Name
              </label>
              <input
                type="text"
                readOnly
                value={
                  proposal.contactName ||
                  [
                    (proposal as any).contact?.firstName,
                    (proposal as any).contact?.lastName,
                  ]
                    .filter(Boolean)
                    .join(' ') ||
                  'Customer'
                }
                className="w-full p-2.5 rounded-lg border bg-muted font-bold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">
                Product Line & Tariffs
              </label>
              <input
                type="text"
                readOnly
                value={
                  (proposal as any).quotation?.productType ||
                  proposal.productLine ||
                  'Motor Comprehensive Policy'
                }
                className="w-full p-2.5 rounded-lg border bg-muted font-bold text-xs"
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase text-muted-foreground flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-primary" />
                Required Document Checklist ({uploadedMandatory.length} / {mandatoryDocs.length} Uploaded)
              </h4>
              <span className="text-[10px] font-bold text-muted-foreground">
                {canSubmit
                  ? 'All mandatory documents uploaded'
                  : `${mandatoryDocs.length - uploadedMandatory.length} document(s) remaining`}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="p-4 rounded-xl border bg-muted/20 text-muted-foreground text-center">
                No document requirements generated for this proposal yet.
              </div>
            ) : (
              documents.map((doc: any) => {
                const isUploaded = Boolean(doc.documentId);
                return (
                  <div
                    key={doc.id}
                    className={`p-3 rounded-xl border flex justify-between items-center transition ${
                      isUploaded ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/10 border-border'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-foreground flex items-center gap-2">
                        <span>{doc.remarks || doc.document?.name || 'Mandatory Document'}</span>
                        {doc.mandatory && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700">
                            Required
                          </span>
                        )}
                      </div>
                      {doc.document?.name && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          File: {doc.document.name}
                        </div>
                      )}
                    </div>

                    {isUploaded ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Uploaded
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUploadButtonClick(doc.id)}
                        className="px-3 py-1 rounded bg-primary text-primary-foreground font-bold text-[10px] shadow hover:bg-primary/90 flex items-center gap-1"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Upload File</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <button
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs flex items-center justify-center space-x-2 shadow-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>
              {isSubmitting
                ? 'Submitting Proposal...'
                : proposal.status === 'DRAFT'
                ? 'Submit Proposal for Underwriting Review'
                : `Proposal Status: ${proposal.status}`}
            </span>
          </button>
        </div>
      )}
    </AppShell>
  );
}

'use client';

import React, { useState } from 'react';
import {
  FileText,
  FileCheck,
  Download,
  Eye,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderArchive,
  Upload,
  X,
  Loader2,
  FileSpreadsheet,
  FileImage,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { PolicyDocumentItem } from '../../repositories/policies.repository';
import { documentsRepository } from '../../repositories/documents.repository';

interface PolicyDocumentsSectionProps {
  policyId: string;
  quotationId?: string | null;
  documents?: PolicyDocumentItem[];
  canUpload?: boolean;
  onDocumentUploaded?: () => void;
  className?: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  RC_FRONT: 'Registration Certificate (RC Front)',
  RC_BACK: 'Registration Certificate (RC Back)',
  PREVIOUS_POLICY: 'Previous Policy Copy',
  FORM_29: 'Form 29 (Notice of Transfer)',
  FORM_30: 'Form 30 (Application for Transfer)',
  SALE_DEED: 'Sale Deed / Ownership Proof',
  INVOICE: 'Tax / Vehicle Purchase Invoice',
  INSPECTION_REPORT: 'Vehicle Pre-Inspection Report',
  PUC: 'PUC Certificate',
  AADHAAR: 'Aadhaar Card (KYC)',
  PAN: 'PAN Card (KYC)',
  POLICY_DOCUMENT: 'Policy Contract / Certificate',
  PROPOSER_KYC: 'Proposer Identification / KYC',
  MEDICAL_RECORD: 'Medical History & Assessment',
  AGE_PROOF: 'Age Verification Document',
  INCOME_PROOF: 'Income Verification Document',
  QUOTE_DOCUMENT: 'Quotation Slip / Comparison',
  PAYMENT_RECEIPT: 'Section 64VB Payment Receipt',
  ENDORSEMENT_DOCUMENT: 'Policy Endorsement Document',
  OTHER: 'Support Document',
};

function formatDocumentType(rawType: string): string {
  if (!rawType) return 'Attached Document';
  const upper = rawType.toUpperCase().trim();
  if (DOCUMENT_TYPE_LABELS[upper]) return DOCUMENT_TYPE_LABELS[upper];
  return upper.replace(/_/g, ' ');
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName?: string, mimeType?: string | null) {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('image') || name.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
    return <FileImage className="h-5 w-5 text-purple-500 shrink-0" />;
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || name.match(/\.(xlsx|xls|csv)$/)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />;
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return <FileText className="h-5 w-5 text-rose-500 shrink-0" />;
  }
  return <File className="h-5 w-5 text-primary shrink-0" />;
}

export function PolicyDocumentsSection({
  policyId,
  documents = [],
  canUpload = false,
  onDocumentUploaded,
  className = '',
}: PolicyDocumentsSectionProps) {
  const [filterSource, setFilterSource] = useState<'ALL' | 'QUOTATION' | 'POLICY'>('ALL');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('POLICY_DOCUMENT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);

  const quotationDocsCount = documents.filter((d) => d.source === 'QUOTATION').length;
  const policyDocsCount = documents.filter((d) => d.source !== 'QUOTATION').length;

  const displayedDocs = documents.filter((d) => {
    if (filterSource === 'QUOTATION') return d.source === 'QUOTATION';
    if (filterSource === 'POLICY') return d.source !== 'QUOTATION';
    return true;
  });

  const handlePreview = async (doc: PolicyDocumentItem) => {
    const targetId = doc.documentId || doc.id;
    if (!targetId && doc.fileKey?.startsWith('http')) {
      window.open(doc.fileKey, '_blank');
      return;
    }
    if (!targetId) {
      toast.error('Document identifier not available for preview');
      return;
    }

    try {
      setIsPreviewing(doc.id);
      const blob = await documentsRepository.downloadDocument(targetId);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to preview document. You may try downloading directly.');
    } finally {
      setIsPreviewing(null);
    }
  };

  const handleDownload = async (doc: PolicyDocumentItem) => {
    const targetId = doc.documentId || doc.id;
    if (!targetId && doc.fileKey?.startsWith('http')) {
      window.open(doc.fileKey, '_blank');
      return;
    }
    if (!targetId) {
      toast.error('Document identifier not available for download');
      return;
    }

    try {
      setIsDownloading(doc.id);
      const blob = await documentsRepository.downloadDocument(targetId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || `document-${doc.documentType || 'file'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Document downloaded successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to download document');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please choose a file to upload');
      return;
    }

    setIsSubmittingUpload(true);
    try {
      await documentsRepository.uploadDocument(
        selectedFile,
        'POLICY',
        policyId,
        {
          category: uploadCategory,
          name: selectedFile.name,
        }
      );
      toast.success('Document uploaded to policy vault successfully');
      setSelectedFile(null);
      setIsUploadOpen(false);
      if (onDocumentUploaded) {
        onDocumentUploaded();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to upload document');
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border bg-card space-y-4 ${className}`}>
      {/* Header with Title, Source Filters, and Upload CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FolderArchive className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Uploaded Documents & Quotation Vault
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                {documents.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Verified underwriting documents from quotation creation and policy issuance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {/* Source Tabs */}
          <div className="flex bg-muted/40 p-0.5 rounded-lg border text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setFilterSource('ALL')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterSource === 'ALL'
                  ? 'bg-background shadow-xs text-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({documents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterSource('QUOTATION')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterSource === 'QUOTATION'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Quote Uploads ({quotationDocsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterSource('POLICY')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterSource === 'POLICY'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Policy Vault ({policyDocsCount})
            </button>
          </div>

          {/* Upload Button */}
          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Documents Grid */}
      {displayedDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedDocs.map((doc) => {
            const isQuoteDoc = doc.source === 'QUOTATION';
            const statusUpper = (doc.verificationStatus || 'VERIFIED').toUpperCase();

            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border bg-card hover:bg-muted/15 transition-all space-y-2.5 flex flex-col justify-between"
              >
                {/* Top: Icon + Title + Source Badge */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {getFileIcon(doc.fileName, doc.mimeType)}
                      <div className="min-w-0">
                        <h4
                          className="text-xs font-bold text-foreground truncate"
                          title={formatDocumentType(doc.documentType)}
                        >
                          {formatDocumentType(doc.documentType)}
                        </h4>
                        <p
                          className="text-[11px] text-muted-foreground font-mono truncate"
                          title={doc.fileName}
                        >
                          {doc.fileName || 'Attached file'}
                        </p>
                      </div>
                    </div>

                    {/* Source Badge */}
                    {isQuoteDoc ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0"
                        title="Uploaded during quotation creation"
                      >
                        <FileText className="h-2.5 w-2.5" />
                        <span>Quote Upload</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
                        title="Policy Vault Document"
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        <span>Policy Vault</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata Row: Size, Date, Verification */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                    <span>
                      {formatBytes(doc.fileSize)} •{' '}
                      {doc.createdAt
                        ? new Date(doc.createdAt).toLocaleDateString('en-IN')
                        : '—'}
                    </span>

                    {/* Verification Status Badge */}
                    <div className="flex items-center gap-1">
                      {statusUpper === 'VERIFIED' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Verified</span>
                        </span>
                      ) : statusUpper === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Rejected</span>
                        </span>
                      ) : statusUpper === 'WAIVED' ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                          <span>Waived</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                          <Clock className="h-3 w-3" />
                          <span>Pending Verification</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Preview & Download */}
                <div className="flex items-center gap-1.5 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => handlePreview(doc)}
                    disabled={isPreviewing === doc.id}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border bg-background hover:bg-muted text-foreground transition shadow-2xs disabled:opacity-50"
                    title="Preview in browser tab"
                  >
                    {isPreviewing === doc.id ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                      <Eye className="h-3 w-3 text-primary" />
                    )}
                    <span>Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={isDownloading === doc.id}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition shadow-2xs disabled:opacity-50"
                    title="Download file to device"
                  >
                    {isDownloading === doc.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center rounded-xl border border-dashed bg-muted/10 space-y-2">
          <FileCheck className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
          <div className="text-xs font-semibold text-foreground">
            {filterSource === 'QUOTATION'
              ? 'No quotation creation documents found for this policy.'
              : filterSource === 'POLICY'
              ? 'No documents currently stored in the policy contract vault.'
              : 'Zero documents uploaded for this quotation or policy.'}
          </div>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Documents captured during the motor/health quotation flow (e.g. RC copy, previous policy, customer KYC) will display here.
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload First Document</span>
            </button>
          )}
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold text-foreground">Attach Document to Policy</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setSelectedFile(null);
                }}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Document Classification *
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary"
                >
                  <option value="POLICY_DOCUMENT">Policy Contract / Schedule</option>
                  <option value="PROPOSAL_FORM">Proposal Form & Signed Declaration</option>
                  <option value="ENDORSEMENT_DOCUMENT">Policy Endorsement Paper</option>
                  <option value="RC_COPY">Registration Certificate (RC)</option>
                  <option value="PREVIOUS_POLICY">Previous Expiring Policy</option>
                  <option value="INVOICE">Tax / Commercial Invoice</option>
                  <option value="KYC_DOCUMENT">Customer Identification (Aadhaar / PAN)</option>
                  <option value="PAYMENT_RECEIPT">Section 64VB Payment Receipt</option>
                  <option value="OTHER">Other Operational Document</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  File Attachment (PDF, JPG, PNG, Max 10MB) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 border rounded-lg p-2 bg-background text-foreground"
                />
                {selectedFile && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Selected: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-muted text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUpload || !selectedFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow disabled:opacity-50"
                >
                  {isSubmittingUpload ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload to Vault</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


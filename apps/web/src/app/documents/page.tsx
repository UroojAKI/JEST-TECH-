'use client';

import React, { useState, useRef } from 'react';
import {
  FileText,
  Download,
  Search,
  Upload,
  Camera,
  Car,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsRepository } from '../../repositories/documents.repository';
import { AppShell } from '../../components/layout/app-shell';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    name: '',
    entityType: 'POLICY',
    entityId: '',
    category: 'POLICY_SCHEDULE',
    tags: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const queryClient = useQueryClient();

  const { data: serverDocsResponse, isLoading } = useQuery({
    queryKey: ['documents-list'],
    queryFn: () => documentsRepository.getAllDocuments({ limit: 100 }),
  });

  const staticDocs = [
    {
      id: '',
      name: 'POL-2026-000001-Schedule.pdf',
      category: 'POLICY_SCHEDULE',
      type: 'PDF Document',
      size: '245 KB',
      uploadedAt: 'Today, 14:30',
      policyNumber: 'POL-2026-000001',
      insured: 'Rahul Kumar',
    },
    {
      id: '',
      name: 'INS-000001-Evidence-Photos.zip',
      category: 'INSPECTION_PACK',
      type: '7-Photo Evidence Pack',
      size: '14.2 MB',
      uploadedAt: 'Today, 11:15',
      policyNumber: 'MQT-000001',
      insured: 'Amit Sharma',
    },
    {
      id: '',
      name: 'MH02CB1234-RC-SmartCard.pdf',
      category: 'RC_COPY',
      type: 'Registration Certificate',
      size: '512 KB',
      uploadedAt: 'Yesterday',
      policyNumber: 'POL-2026-000002',
      insured: 'Pooja Verma',
    },
    {
      id: '',
      name: 'KYC-PAN-Card-Verified.pdf',
      category: 'KYC',
      type: 'Identity Verification',
      size: '180 KB',
      uploadedAt: 'Yesterday',
      policyNumber: 'CUST-000021',
      insured: 'Rahul Kumar',
    },
  ];

  const serverDocs = (serverDocsResponse?.data || []).map((d: any) => ({
    id: d.id,
    name: d.originalFileName || d.name || 'Document',
    category: d.entityType || 'POLICY_SCHEDULE',
    type: d.mimeType || 'Document',
    size: d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : '150 KB',
    uploadedAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Recent',
    policyNumber: d.entityId ? `${d.entityType}-${d.entityId.substring(0, 8).toUpperCase()}` : 'N/A',
    insured: d.uploadedBy?.firstName ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName || ''}`.trim() : 'System',
  }));

  const docs = serverDocs.length > 0 ? serverDocs : staticDocs;

  const handleDownload = async (doc: any) => {
    try {
      if (doc.id) {
        toast.loading(`Downloading ${doc.name}...`, { id: 'download' });
        const blob = await documentsRepository.downloadDocument(doc.id);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success(`Downloaded ${doc.name}`, { id: 'download' });
      } else {
        toast.error(`Document file record ${doc.name} requires authoritative storage access.`, { id: 'download' });
      }
    } catch (e: any) {
      toast.error(`Failed to download ${doc.name}: ${e.message || 'Error'}`, { id: 'download' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!uploadForm.name) {
        setUploadForm((prev) => ({ ...prev, name: file.name }));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }
    if (!uploadForm.entityId.trim()) {
      toast.error('Entity ID (UUID) is required');
      return;
    }

    setIsUploading(true);
    try {
      await documentsRepository.uploadDocument(
        selectedFile,
        uploadForm.entityType,
        uploadForm.entityId.trim(),
        {
          name: uploadForm.name || selectedFile.name,
          category: uploadForm.category,
          tags: uploadForm.tags,
        }
      );
      toast.success('Document uploaded successfully to vault');
      await queryClient.invalidateQueries({ queryKey: ['documents-list'] });
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadForm({
        name: '',
        entityType: 'POLICY',
        entityId: '',
        category: 'POLICY_SCHEDULE',
        tags: '',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const filtered = docs.filter((d) => {
    const matchesCat = category === 'ALL' || d.category === category;
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.insured.toLowerCase().includes(search.toLowerCase()) ||
      d.policyNumber.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Document Vault & Evidence Repository
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Authoritative documents: Policy Schedules, RC copies, Inspection Evidence, and Customer KYC.
            </p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by filename, customer name, policy or quotation number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full sm:w-auto text-xs rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
          >
            <option value="ALL">All Document Types</option>
            <option value="POLICY_SCHEDULE">Policy Schedules & Certificates</option>
            <option value="INSPECTION_PACK">7-Photo Inspection Evidence</option>
            <option value="RC_COPY">Vehicle RC Copies</option>
            <option value="KYC">Customer KYC & Mandates</option>
          </select>
        </div>

        {/* Documents Grid / List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">Authoritative Files ({filtered.length})</div>
            <div className="text-xs text-muted-foreground">Immutable audit storage (Encrypted)</div>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-12 text-center flex items-center justify-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading documents repository...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">No documents matching your search filter</p>
              </div>
            ) : (
              filtered.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                      {doc.category === 'INSPECTION_PACK' ? (
                        <Camera className="h-5 w-5" />
                      ) : doc.category === 'RC_COPY' ? (
                        <Car className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span>{doc.name}</span>
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
                          {doc.size}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>Ref: <strong className="text-foreground">{doc.policyNumber}</strong></span>
                        <span>•</span>
                        <span>Party: <strong className="text-foreground">{doc.insured}</strong></span>
                        <span>•</span>
                        <span>{doc.uploadedAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-xs font-semibold text-foreground transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Upload className="h-4 w-4 text-primary" />
                <span>Upload Authoritative Document</span>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-4 space-y-4">
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Select File <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 border rounded-lg p-1.5 bg-background cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Document Title / Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Policy Schedule or RC Copy"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Entity Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={uploadForm.entityType}
                    onChange={(e) => setUploadForm({ ...uploadForm, entityType: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-xs"
                  >
                    <option value="POLICY">Policy</option>
                    <option value="CLAIM">Claim</option>
                    <option value="LEAD">Lead</option>
                    <option value="QUOTATION">Quotation</option>
                    <option value="CONTACT">Contact</option>
                    <option value="ACCOUNT">Account</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-xs"
                  >
                    <option value="POLICY_SCHEDULE">Policy Schedule</option>
                    <option value="INSPECTION_PACK">Inspection Pack</option>
                    <option value="RC_COPY">RC Copy</option>
                    <option value="KYC">KYC Document</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Entity ID (UUID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="UUID of the Policy, Claim, Lead, or Contact"
                  value={uploadForm.entityId}
                  onChange={(e) => setUploadForm({ ...uploadForm, entityId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs font-mono focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. verified, irda-filing, 2026"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-background text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  Clock,
  Wallet,
  Folder,
  MessageSquare,
  Calendar,
  Car,
  Users,
  StickyNote,
  Activity,
  BarChart3,
  Loader2,
  TrendingUp,
  CreditCard,
  CheckCircle,
  AlertCircle,
  FileUp,
  ChevronRight,
  Sparkles,
  Plus,
  Edit,
  Eye,
  X,
  History,
  ExternalLink,
  Download,
  Upload,
  FileImage,
  File,
} from 'lucide-react';
import { StatusBadge } from '../../ui/status-badge';
import { UnifiedChart } from '../../charts/unified-chart';
import { useCustomerWorkspace } from '../../../hooks/useCustomer360';
import { customerRepository } from '../../../repositories/customer.repository';
import { documentsRepository } from '../../../repositories/documents.repository';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';

export function CustomerTabsContainer({ customerId }: { customerId: string }) {
  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');
  const { workspace, isLoading, refetch } = useCustomerWorkspace(customerId);

  const profile = workspace?.profile || {};
  const policies = workspace?.policies || [];
  const claims = workspace?.claims || [];
  const quotations = workspace?.quotations || [];
  const vehicles = workspace?.vehicles || [];
  const familyMembers = workspace?.familyMembers || [];
  const timeline = workspace?.timeline || [];
  const analytics = workspace?.analytics || {};
  const leads = workspace?.leads || [];
  const documents = workspace?.documents || [];
  const payments = workspace?.payments || policies.flatMap((p: any) => p.payments || []);
  const renewals = workspace?.renewals || policies.flatMap((p: any) => p.renewals || []);

  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'LEADS', label: 'Leads', icon: <TrendingUp className="h-3.5 w-3.5" />, badge: leads.length },
    { id: 'POLICIES', label: 'Policies', icon: <ShieldCheck className="h-3.5 w-3.5" />, badge: policies.length },
    { id: 'QUOTATIONS', label: 'Quotations', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, badge: quotations.length },
    { id: 'CLAIMS', label: 'Claims', icon: <FileText className="h-3.5 w-3.5" />, badge: claims.length },
    { id: 'RENEWALS', label: 'Renewals', icon: <Clock className="h-3.5 w-3.5" />, badge: renewals.length },
    { id: 'PAYMENTS', label: 'Payments', icon: <Wallet className="h-3.5 w-3.5" />, badge: payments.length },
    { id: 'DOCUMENTS', label: 'Documents', icon: <Folder className="h-3.5 w-3.5" />, badge: documents.length },
    { id: 'COMMUNICATION', label: 'Communication', icon: <MessageSquare className="h-3.5 w-3.5" />, badge: timeline.length },
    { id: 'ACTIVITIES', label: 'Timeline', icon: <Calendar className="h-3.5 w-3.5" /> },
    { id: 'VEHICLES', label: 'Vehicles', icon: <Car className="h-3.5 w-3.5" />, badge: vehicles.length },
    { id: 'FAMILY', label: 'Family', icon: <Users className="h-3.5 w-3.5" />, badge: familyMembers.length },
    { id: 'NOTES', label: 'Notes', icon: <StickyNote className="h-3.5 w-3.5" /> },
    { id: 'ANALYTICS', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
        <span className="text-xs">Loading live customer records...</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/20 space-x-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-background shadow text-primary font-bold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Display Area */}
      <div className="p-6 text-xs space-y-4">
        {activeTab === 'OVERVIEW' && (
          <OverviewView
            profile={profile}
            analytics={analytics}
            policies={policies}
            leads={leads}
            timeline={timeline}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'LEADS' && <LeadsListView leads={leads} />}
        {activeTab === 'POLICIES' && <ExpandablePoliciesView policies={policies} />}
        {activeTab === 'QUOTATIONS' && <QuotationsListView quotations={quotations} />}
        {activeTab === 'CLAIMS' && <ClaimsLifecycleView claims={claims} />}
        {activeTab === 'RENEWALS' && <RenewalsListView renewals={renewals} policies={policies} />}
        {activeTab === 'PAYMENTS' && <PaymentsListView payments={payments} />}
        {activeTab === 'DOCUMENTS' && <DocumentsListView documents={documents} customerId={customerId} refetch={refetch} />}
        {activeTab === 'COMMUNICATION' && <CommunicationStreamView timeline={timeline} />}
        {activeTab === 'ACTIVITIES' && <CommunicationStreamView timeline={timeline} />}
        {activeTab === 'VEHICLES' && <VehicleCardsView vehicles={vehicles} customerId={customerId} refetch={refetch} />}
        {activeTab === 'FAMILY' && <FamilyTreePage familyMembers={familyMembers} />}
        {activeTab === 'NOTES' && (
          <NotesView
            customerId={customerId}
            notes={timeline.filter(
              (item: any) => item.title === 'INTERNAL_NOTE - INTERNAL',
            )}
            refetch={refetch}
          />
        )}
        {activeTab === 'ANALYTICS' && <CustomerAnalyticsView analytics={analytics} policies={policies} />}
      </div>
    </div>
  );
}

function OverviewView({
  profile,
  analytics,
  policies,
  leads,
  timeline,
  setActiveTab,
}: {
  profile: any;
  analytics: any;
  policies: any[];
  leads: any[];
  timeline: any[];
  setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Premium Paid</div>
          <div className="text-xl font-black text-foreground mt-1">
            ₹{Number(analytics.totalPremiumPaid || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Across all issued policies</div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Active Policies</div>
          <div className="text-xl font-black text-primary mt-1">
            {analytics.activePoliciesCount || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">In-force coverage</div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Open Claims</div>
          <div className="text-xl font-black text-amber-600 mt-1">
            {analytics.openClaimsCount || 0}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Under investigation / review</div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Health & Renewal</div>
          <div className="text-xl font-black text-emerald-600 mt-1">
            {analytics.healthScore || 100}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Customer retention index</div>
        </div>
      </div>

      {/* Two Column Layout: Policies & Leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Policies */}
        <div className="p-4 rounded-xl border bg-card space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Active & Recent Policies
            </h4>
            <button
              onClick={() => setActiveTab('POLICIES')}
              className="text-[10px] font-bold text-primary hover:underline"
            >
              View All ({policies.length})
            </button>
          </div>
          {policies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active policies found</p>
          ) : (
            <div className="space-y-2">
              {policies.slice(0, 3).map((p: any) => (
                <div key={p.id} className="p-2.5 rounded-lg bg-muted/20 border flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold font-mono">{p.policyNumber}</div>
                    <div className="text-[10px] text-muted-foreground">{p.policyType || 'Motor Policy'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}</div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Pipeline / Leads */}
        <div className="p-4 rounded-xl border bg-card space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Sales Pipeline & Leads
            </h4>
            <button
              onClick={() => setActiveTab('LEADS')}
              className="text-[10px] font-bold text-primary hover:underline"
            >
              View All ({leads.length})
            </button>
          </div>
          {leads.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active leads in pipeline</p>
          ) : (
            <div className="space-y-2">
              {leads.slice(0, 3).map((l: any) => (
                <div key={l.id} className="p-2.5 rounded-lg bg-muted/20 border flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-foreground">{l.title || 'Insurance Lead'}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{l.leadCode}</div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary">
                      {l.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeadsListView({ leads }: { leads: any[] }) {
  if (!leads || leads.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No sales leads found for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead: any) => (
        <Link key={lead.id} href={`/workspace/sales/leads/${lead.id}`} className="p-4 rounded-xl border bg-card flex justify-between items-center hover:border-primary/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                {lead.leadCode}
              </span>
              <span className="font-bold text-foreground text-sm">{lead.title || 'Lead'}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Source: {lead.source || 'Direct'} • Created: {new Date(lead.createdAt).toLocaleDateString('en-IN')}
            </p>
            <p className="text-[10px] text-muted-foreground">{lead.quotations?.length || 0} quotes · {lead.status}</p>
          </div>
          <div className="flex items-center space-x-3">
            {lead.estimatedValue && (
              <span className="font-bold text-sm">₹{Number(lead.estimatedValue).toLocaleString('en-IN')}</span>
            )}
            <StatusBadge status={lead.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RenewalsListView({ renewals, policies }: { renewals: any[]; policies: any[] }) {
  const allRenewals = [...renewals];
  if (allRenewals.length === 0 && policies.length > 0) {
    // Derive pending renewals from policies expiring within 60 days
    const now = new Date();
    policies.forEach((p: any) => {
      if (p.expiryDate) {
        const exp = new Date(p.expiryDate);
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (daysLeft <= 60 && daysLeft >= -30) {
          allRenewals.push({
            id: `derived-${p.id}`,
            policyNumber: p.policyNumber,
            previousExpiry: p.expiryDate,
            newExpiry: new Date(exp.setFullYear(exp.getFullYear() + 1)),
            premiumAmount: p.premiumAmount,
            status: daysLeft < 0 ? 'OVERDUE' : 'DUE_SOON',
            daysLeft,
          });
        }
      }
    });
  }

  if (allRenewals.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No active renewals or policies due for renewal.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allRenewals.map((r: any, idx: number) => (
        <div key={r.id || idx} className="p-4 rounded-xl border bg-card flex justify-between items-center">
          <div>
            <div className="font-bold text-sm text-foreground">
              Policy #{r.policyNumber || r.policy?.policyNumber || 'Renewal Task'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Expiry Date: {r.previousExpiry ? new Date(r.previousExpiry).toLocaleDateString('en-IN') : 'N/A'}
              {r.daysLeft !== undefined && ` (${r.daysLeft} days remaining)`}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="font-bold text-sm">₹{Number(r.premiumAmount || 0).toLocaleString('en-IN')}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              r.status === 'OVERDUE' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
            }`}>
              {r.status || 'SCHEDULED'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentsListView({ payments }: { payments: any[] }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No payment transactions recorded for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((p: any, idx: number) => (
        <div key={p.id || idx} className="p-4 rounded-xl border bg-card flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-foreground">
                TXN: {p.transactionId || 'OFFLINE-RECEIPT'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.quotationCode && p.quotationId ? <><Link href={`/sales/quotations/${p.quotationId}`} className="text-primary hover:underline">Quote: {p.quotationCode}</Link> · </> : ''}Method: {p.paymentMethod || 'Net Banking'} • Date: {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : 'Recorded'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm text-emerald-600">
              ₹{Number(p.amount || 0).toLocaleString('en-IN')}
            </div>
            <StatusBadge status={p.status || 'SUCCESS'} />
          </div>
        </div>
      ))}
    </div>
  );
}

function getCustomerDocIcon(fileName?: string, mimeType?: string | null) {
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('image') || name.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
    return <FileImage className="h-4 w-4 text-purple-500 shrink-0" />;
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || name.match(/\.(xlsx|xls|csv)$/)) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return <FileText className="h-4 w-4 text-rose-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-primary shrink-0" />;
}

function formatCustomerDocBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsListView({
  documents,
  customerId,
  refetch,
}: {
  documents: any[];
  customerId: string;
  refetch: () => void;
}) {
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{
    doc: any;
    url: string;
    mimeType: string;
  } | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('KYC');
  const [isUploading, setIsUploading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const handlePreview = async (doc: any) => {
    if (!doc?.id) {
      toast.error('Document identifier missing');
      return;
    }
    setIsPreviewing(doc.id);
    try {
      const blob = await documentsRepository.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      setPreviewState({
        doc,
        url,
        mimeType: doc.mimeType || blob.type || 'application/pdf',
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to preview document. Try downloading directly.');
    } finally {
      setIsPreviewing(null);
    }
  };

  const closePreview = () => {
    if (previewState?.url) {
      URL.revokeObjectURL(previewState.url);
    }
    setPreviewState(null);
  };

  const handleDownload = async (doc: any) => {
    if (!doc?.id) {
      toast.error('Document identifier missing');
      return;
    }
    setIsDownloading(doc.id);
    try {
      const blob = await documentsRepository.downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalFileName || doc.name || 'document';
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
    if (!uploadFile) {
      toast.error('Please choose a file to upload');
      return;
    }

    if (uploadFile.size > 50 * 1024 * 1024) {
      toast.error('File size exceeds 50MB limit');
      return;
    }

    setIsUploading(true);
    try {
      await documentsRepository.uploadDocument(uploadFile, 'CONTACT', customerId, {
        name: uploadFile.name,
        category: uploadCategory,
      });
      toast.success(`Document ${uploadFile.name} uploaded successfully!`);
      setUploadFile(null);
      setIsUploadOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = (documents || []).filter((doc: any) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    const name = (doc.name || doc.originalFileName || '').toLowerCase();
    const docNum = (doc.documentNumber || '').toLowerCase();
    const cat = (doc.category || doc.metadata?.category || '').toLowerCase();
    return name.includes(query) || docNum.includes(query) || cat.includes(query);
  });

  return (
    <div className="space-y-4">
      {/* Top action & filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Folder className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Customer Documents Vault
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                {documents?.length || 0}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Verified identity proofs, KYC, vehicle documents, and policy schedules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {documents && documents.length > 0 && (
            <input
              type="text"
              placeholder="Search documents..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border bg-background text-xs w-40 sm:w-48 outline-none focus:ring-1 focus:ring-primary"
            />
          )}
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:bg-primary/90 flex items-center gap-1.5 transition"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Document List / Empty state */}
      {filteredDocs.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground border border-dashed rounded-xl bg-card space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted/30 text-muted-foreground flex items-center justify-center mx-auto">
            <Folder className="h-6 w-6 opacity-60" />
          </div>
          <div>
            <div className="font-semibold text-xs text-foreground">
              {searchFilter ? 'No documents match your filter' : 'No customer documents uploaded yet'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto">
              Upload customer identification (Aadhaar, PAN, GST certificate), vehicle RC, or insurance documents.
            </p>
          </div>
          {!searchFilter && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload First Document</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredDocs.map((doc: any) => {
            const docName = doc.name || doc.originalFileName || 'Customer Document';
            const category = doc.category || doc.metadata?.category || (doc.entityType === 'POLICY' ? 'Policy Schedule' : 'KYC / Proof');
            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border bg-card hover:bg-accent/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                    {getCustomerDocIcon(doc.originalFileName || doc.name, doc.mimeType)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-xs truncate max-w-xs sm:max-w-md" title={docName}>
                        {docName}
                      </span>
                      {category && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                          {category}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      {doc.documentNumber && <span className="font-mono text-[10px]">{doc.documentNumber}</span>}
                      <span>•</span>
                      <span>{formatCustomerDocBytes(Number(doc.size || 0))}</span>
                      <span>•</span>
                      <span>Uploaded {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-IN') : 'Recent'}</span>
                      {doc.policyNumber && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-mono text-[10px]">Policy: {doc.policyNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <StatusBadge status={doc.verificationStatus || doc.status || 'VERIFIED'} />

                  {/* Preview Button */}
                  <button
                    type="button"
                    onClick={() => handlePreview(doc)}
                    disabled={isPreviewing === doc.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition disabled:opacity-50"
                    title="Preview document"
                  >
                    {isPreviewing === doc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    <span>Preview</span>
                  </button>

                  {/* Download Button */}
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={isDownloading === doc.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition disabled:opacity-50"
                    title="Download document to device"
                  >
                    {isDownloading === doc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold text-foreground">Upload Customer Document</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadFile(null);
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
                  className="w-full px-3 py-2 rounded-lg border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="KYC">KYC Document (Aadhaar / Passport / Voter ID)</option>
                  <option value="PAN">PAN Card</option>
                  <option value="GST">GST Registration Certificate</option>
                  <option value="RC">Vehicle Registration Certificate (RC)</option>
                  <option value="PREVIOUS_POLICY">Previous Policy Copy</option>
                  <option value="INVOICE">Vehicle / Asset Purchase Invoice</option>
                  <option value="PROPOSAL">Signed Proposal Form</option>
                  <option value="MEDICAL">Medical History / Test Report</option>
                  <option value="OTHER">Other Support Document</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Select File *
                </label>
                <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-accent/20 transition-colors">
                  <input
                    type="file"
                    id="customer-vault-file-upload"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadFile(f);
                    }}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  />
                  <label
                    htmlFor="customer-vault-file-upload"
                    className="cursor-pointer flex flex-col items-center gap-1.5"
                  >
                    <Upload className="h-6 w-6 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      {uploadFile ? uploadFile.name : 'Choose file to upload'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {uploadFile
                        ? `${formatCustomerDocBytes(uploadFile.size)} selected`
                        : 'PDF, JPG, PNG, DOCX up to 50MB'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setUploadFile(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/40">
              <div className="flex items-center gap-2.5 truncate max-w-lg">
                {getCustomerDocIcon(previewState.doc.originalFileName || previewState.doc.name, previewState.mimeType)}
                <div className="truncate">
                  <div className="font-bold text-xs text-foreground truncate">
                    {previewState.doc.name || previewState.doc.originalFileName}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatCustomerDocBytes(previewState.doc.size)} • {previewState.doc.documentNumber || previewState.mimeType}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(previewState.url, '_blank')}
                  className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-accent text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Open in new window"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(previewState.doc)}
                  className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Download copy"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition ml-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Preview Body */}
            <div className="flex-1 bg-muted/20 p-4 overflow-auto flex items-center justify-center">
              {previewState.mimeType?.startsWith('image/') ||
              previewState.doc.originalFileName?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img
                  src={previewState.url}
                  alt={previewState.doc.name || 'Document preview'}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-sm border bg-card"
                />
              ) : previewState.mimeType?.includes('pdf') ||
                previewState.doc.originalFileName?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewState.url}
                  title={previewState.doc.name}
                  className="w-full h-full rounded-lg border bg-card shadow-xs"
                />
              ) : (
                <div className="text-center p-8 bg-card rounded-2xl border max-w-md shadow-sm space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {previewState.doc.name || previewState.doc.originalFileName}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Direct in-browser preview is not supported for this file format ({previewState.mimeType}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewState.doc)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 inline-flex items-center gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download File to Device
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesView({
  customerId,
  notes,
  refetch,
}: {
  customerId: string;
  notes: any[];
  refetch: () => Promise<unknown>;
}) {
  const draftKey = `customer_note_draft_${customerId}`;
  const [newNote, setNewNote] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(draftKey) || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  const handleNoteChange = (val: string) => {
    setNewNote(val);
    if (typeof window !== 'undefined') {
      try {
        if (val) localStorage.setItem(draftKey, val);
        else localStorage.removeItem(draftKey);
      } catch {
        // storage disabled/quota
      }
    }
  };

  const addNote = useMutation({
    mutationFn: () => customerRepository.addCustomerNote(customerId, newNote),
    onSuccess: async () => {
      setNewNote('');
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }
      await refetch();
      toast.success('Note saved to the customer profile');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save note');
    },
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) addNote.mutate();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddNote} className="space-y-2">
        <textarea
          value={newNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="Add an internal note or interaction log about this customer (auto-saved as local draft)..."
          className="w-full p-3 rounded-xl border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
          rows={3}
        />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">
            {newNote ? '📝 Draft saved locally on this browser' : 'Auto-saves as local browser draft'}
          </span>
          <button
            type="submit"
            disabled={addNote.isPending || !newNote.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {addNote.isPending ? 'Saving…' : 'Add Note to Profile'}
          </button>
        </div>
      </form>

      <div className="space-y-2 pt-2">
        {notes.map((n: any) => (
          <div key={n.id} className="p-3 rounded-xl border bg-card space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span className="font-bold text-foreground">Team note</span>
              <span>{new Date(n.date).toLocaleDateString('en-IN')}</span>
            </div>
            <p className="text-xs text-foreground/90">{n.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandablePoliciesView({ policies }: { policies: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!policies || policies.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No active or historical policies found for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {policies.map((p) => (
        <div key={p.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div
            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <div className="font-bold text-sm text-foreground">
                  <Link href={`/policies/${p.id}`} onClick={(event) => event.stopPropagation()} className="hover:text-primary hover:underline">{p.policyNumber || 'Draft Policy'}</Link> • {p.policyType || 'General Policy'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Expires: {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN') : 'N/A'}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="font-bold text-sm">₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}</span>
              <StatusBadge status={p.status} />
            </div>
          </div>

          {expandedId === p.id && (
            <div className="p-4 bg-muted/20 border-t space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Sum Insured</span>
                  <div className="font-bold">₹{Number(p.sumInsured || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Premium</span>
                  <div className="font-bold">₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Effective Date</span>
                  <div className="font-bold">{p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-IN') : 'N/A'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Claims Associated</span>
                  <div className="font-bold text-primary">{p.claims?.length || 0} Claims</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ClaimsLifecycleView({ claims }: { claims: any[] }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No claims reported for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {claims.map((c) => (
        <div key={c.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-sm">
                <Link href={`/claims?claimId=${c.id}`} className="text-primary hover:underline">Claim #{c.claimNumber}</Link> • {c.lossType || 'Claim Incident'}
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Policy: {c.policy?.id ? <Link href={`/policies/${c.policy.id}`} className="text-primary hover:underline">{c.policy.policyNumber}</Link> : c.policy?.policyNumber || 'N/A'} • Amount: ₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <StatusBadge status={c.status} />
          </div>

          <div className="grid grid-cols-6 gap-2 text-center pt-2">
            {['REPORTED', 'UNDER_INVESTIGATION', 'APPROVED', 'SETTLED'].map((stage, idx) => (
              <div
                key={stage}
                className={`p-2 rounded-lg border text-[10px] font-bold ${
                  c.status === stage
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted/20 text-muted-foreground'
                }`}
              >
                {stage}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuotationsListView({ quotations }: { quotations: any[] }) {
  if (!quotations || quotations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No quotation proposals prepared for this customer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotations.map((q) => (
        <div key={q.id} className="p-4 rounded-xl border bg-card flex justify-between items-center gap-4">
          <div>
            <Link href={`/sales/quotations/${q.id}`} className="font-bold text-primary font-mono hover:underline">{q.quotationCode}</Link>
            <p className="text-xs font-semibold">{q.title || 'Motor Quotation'}</p>
            <p className="text-[10px] text-muted-foreground">
              Case {q.case?.id ? <Link href={`/workspace/operations/cases/${q.case.id}`} className="text-primary hover:underline">{q.case.caseCode}</Link> : '—'} · Inspection {q.motorInspection?.inspectionCode ? <Link href={`/workspace/operations/inspections/${q.id}`} className="text-primary hover:underline">{q.motorInspection.inspectionCode} {q.motorInspection.status}</Link> : 'NOT STARTED'} · Payment {q.motorPaymentRecord?.status || 'NOT DONE'} · Policy {q.policy?.id ? <Link href={`/policies/${q.policy.id}`} className="text-primary hover:underline">{q.policy.policyNumber}</Link> : 'NOT ISSUED'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="font-bold text-sm">₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}</span>
            <StatusBadge status={q.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VehicleCardsView({
  vehicles,
  customerId,
  refetch,
}: {
  vehicles: any[];
  customerId: string;
  refetch?: () => void;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<'QUOTES' | 'POLICIES' | 'CLAIMS' | 'RENEWALS'>('QUOTES');

  // Form states for Add Vehicle
  const [addForm, setAddForm] = useState({
    category: 'PRIVATE_CAR',
    registrationNumber: '',
    makeModel: '',
    fuelType: 'Petrol',
    manufactureYearMonth: '',
    engineNumber: '',
    chassisNumber: '',
    rtoLocation: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Edit Vehicle
  const [editForm, setEditForm] = useState({
    makeModel: '',
    fuelType: '',
    manufactureYearMonth: '',
    engineNumber: '',
    chassisNumber: '',
    rtoLocation: '',
  });

  const handleOpenAdd = () => {
    setAddForm({
      category: 'PRIVATE_CAR',
      registrationNumber: '',
      makeModel: '',
      fuelType: 'Petrol',
      manufactureYearMonth: '',
      engineNumber: '',
      chassisNumber: '',
      rtoLocation: '',
    });
    setIsAddOpen(true);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post(`/customers/${customerId}/vehicles`, addForm);
      toast.success('Vehicle asset registered successfully');
      setIsAddOpen(false);
      if (refetch) refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (v: any) => {
    setEditingVehicle(v);
    setEditForm({
      makeModel: v.makeModel || '',
      fuelType: v.fuelType || 'Petrol',
      manufactureYearMonth: v.manufactureYearMonth || '',
      engineNumber: v.engineNumber || '',
      chassisNumber: v.chassisNumber || '',
      rtoLocation: v.rtoLocation || '',
    });
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/customers/${customerId}/vehicles/${editingVehicle.id}`, editForm);
      toast.success('Vehicle specifications updated');
      setEditingVehicle(null);
      if (refetch) refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistory = async (vId: string) => {
    setHistoryVehicleId(vId);
    setHistoryLoading(true);
    setHistoryTab('QUOTES');
    try {
      const res = await apiClient.get(`/customers/${customerId}/vehicles/${vId}/history`);
      setHistoryData(res.data);
    } catch (err: any) {
      toast.error('Failed to load vehicle history');
      setHistoryVehicleId(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
        <div>
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            Customer Vehicle Asset Portfolio ({vehicles.length})
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Registered vehicle assets, policy affiliations, and lifetime lifecycle records
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-2xl bg-card space-y-3">
          <Car className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div className="space-y-1">
            <h4 className="font-bold text-foreground text-sm">No Vehicles Registered</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              This customer profile has no linked vehicle assets. Register an existing vehicle or start a new quotation.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors"
          >
            + Register First Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v: any, idx: number) => (
            <div
              key={v.id || idx}
              className="rounded-2xl border bg-card p-5 space-y-3.5 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-base text-foreground">
                      {v.registrationNumber || 'Unregistered / New'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                      {v.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground/80 mt-1">
                    {v.makeModel || `${v.make || ''} ${v.model || ''}`.trim() || 'Standard Specs'}
                  </p>
                </div>
                <StatusBadge status={v.policyStatus || v.status || 'ACTIVE'} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-muted/20 border text-muted-foreground">
                <div>
                  <span className="block text-[10px] text-muted-foreground/70">Fuel & Vintage</span>
                  <span className="font-semibold text-foreground">
                    {v.fuelType || 'Petrol'} {v.manufactureYearMonth ? `• ${v.manufactureYearMonth}` : ''}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground/70">Current Policy</span>
                  <span className="font-semibold text-foreground">
                    {v.policyNumber || 'In Quote Pipeline'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground/70">Insurer</span>
                  <span className="font-semibold text-foreground">{v.insurerName || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground/70">Expiry Date</span>
                  <span className="font-semibold text-foreground">
                    {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('en-IN') : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Quotes: <strong className="text-foreground">{v.quotationsCount ?? 0}</strong></span>
                  <span>•</span>
                  <span>Policies: <strong className="text-foreground">{v.policiesCount ?? 0}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/sales/quotations?openQuote=true&customerId=${customerId}&vehicleId=${v.id}&regNumber=${v.registrationNumber || ''}`}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    + New Quote
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(v)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                    title="Edit Specifications"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(v.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                    title="View Asset History"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Vehicle Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-muted/30">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Register Vehicle Asset
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateVehicle} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold block">Vehicle Category *</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background font-semibold"
                  >
                    <option value="PRIVATE_CAR">Private Car</option>
                    <option value="BIKE">Two Wheeler (Bike)</option>
                    <option value="GCV">Goods Carrying Vehicle (GCV)</option>
                    <option value="TRACTOR">Tractor</option>
                    <option value="AUTO">Three Wheeler / Auto</option>
                    <option value="TAXI">Taxi / Cab</option>
                    <option value="BUS_COACH">Bus / Coach</option>
                    <option value="MISC_CLASS_D">Special Vehicle (Class D)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold block">Registration Number</label>
                  <input
                    placeholder="e.g. KA03AB1234 or leave blank"
                    value={addForm.registrationNumber}
                    onChange={(e) => setAddForm({ ...addForm, registrationNumber: e.target.value.toUpperCase() })}
                    className="w-full p-2 rounded-lg border bg-background uppercase font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold block">Make & Model *</label>
                <input
                  required
                  placeholder="e.g. Hyundai Creta 1.5 SX"
                  value={addForm.makeModel}
                  onChange={(e) => setAddForm({ ...addForm, makeModel: e.target.value })}
                  className="w-full p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold block">Fuel Type</label>
                  <select
                    value={addForm.fuelType}
                    onChange={(e) => setAddForm({ ...addForm, fuelType: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="Electric">Electric</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold block">Mfg Year / Month</label>
                  <input
                    placeholder="MM/YYYY (e.g. 05/2022)"
                    value={addForm.manufactureYearMonth}
                    onChange={(e) => setAddForm({ ...addForm, manufactureYearMonth: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold block">Engine Number</label>
                  <input
                    placeholder="Engine #"
                    value={addForm.engineNumber}
                    onChange={(e) => setAddForm({ ...addForm, engineNumber: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold block">Chassis Number</label>
                  <input
                    placeholder="Chassis #"
                    value={addForm.chassisNumber}
                    onChange={(e) => setAddForm({ ...addForm, chassisNumber: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-lg border hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Registering…' : 'Register Vehicle Asset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-muted/30">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="h-4 w-4 text-primary" />
                Edit Vehicle: {editingVehicle.registrationNumber || editingVehicle.vehicleCode}
              </h3>
              <button onClick={() => setEditingVehicle(null)} className="p-1 rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateVehicle} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold block">Make & Model</label>
                <input
                  value={editForm.makeModel}
                  onChange={(e) => setEditForm({ ...editForm, makeModel: e.target.value })}
                  className="w-full p-2 rounded-lg border bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold block">Fuel Type</label>
                  <select
                    value={editForm.fuelType}
                    onChange={(e) => setEditForm({ ...editForm, fuelType: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="Electric">Electric</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold block">Mfg Year / Month</label>
                  <input
                    value={editForm.manufactureYearMonth}
                    onChange={(e) => setEditForm({ ...editForm, manufactureYearMonth: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold block">Engine Number</label>
                  <input
                    value={editForm.engineNumber}
                    onChange={(e) => setEditForm({ ...editForm, engineNumber: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold block">Chassis Number</label>
                  <input
                    value={editForm.chassisNumber}
                    onChange={(e) => setEditForm({ ...editForm, chassisNumber: e.target.value })}
                    className="w-full p-2 rounded-lg border bg-background font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="px-4 py-2 rounded-lg border hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Saving…' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Asset Complete History Modal */}
      {historyVehicleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-muted/30">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Asset Lifecycle History: {historyData?.vehicle?.registrationNumber || historyData?.vehicle?.vehicleCode || 'Vehicle Asset'}
              </h3>
              <button onClick={() => setHistoryVehicleId(null)} className="p-1 rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            {historyLoading ? (
              <div className="p-12 text-center text-muted-foreground flex justify-center items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Loading lifecycle records…</span>
              </div>
            ) : historyData ? (
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* History Tabs */}
                <div className="flex items-center gap-2 border-b pb-2">
                  <button
                    onClick={() => setHistoryTab('QUOTES')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      historyTab === 'QUOTES' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Quotations ({historyData.quotations?.length || 0})
                  </button>
                  <button
                    onClick={() => setHistoryTab('POLICIES')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      historyTab === 'POLICIES' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Policies ({historyData.policies?.length || 0})
                  </button>
                  <button
                    onClick={() => setHistoryTab('CLAIMS')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      historyTab === 'CLAIMS' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Claims ({historyData.claims?.length || 0})
                  </button>
                  <button
                    onClick={() => setHistoryTab('RENEWALS')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      historyTab === 'RENEWALS' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Renewals ({historyData.renewals?.length || 0})
                  </button>
                </div>

                {historyTab === 'QUOTES' && (
                  <div className="space-y-2">
                    {(!historyData.quotations || historyData.quotations.length === 0) ? (
                      <p className="text-muted-foreground py-4 text-center">No quotations generated for this vehicle asset.</p>
                    ) : (
                      historyData.quotations.map((q: any) => (
                        <div key={q.id} className="p-3 rounded-xl border bg-card flex justify-between items-center">
                          <div>
                            <span className="font-mono font-bold text-foreground">{q.quotationCode}</span>
                            <p className="text-[11px] text-muted-foreground">{q.title} • {q.insurerName || 'Insurer'}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-foreground">₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}</span>
                            <div className="mt-0.5"><StatusBadge status={q.status} /></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {historyTab === 'POLICIES' && (
                  <div className="space-y-2">
                    {(!historyData.policies || historyData.policies.length === 0) ? (
                      <p className="text-muted-foreground py-4 text-center">No policies issued for this vehicle asset.</p>
                    ) : (
                      historyData.policies.map((p: any) => (
                        <div key={p.id} className="p-3 rounded-xl border bg-card flex justify-between items-center">
                          <div>
                            <span className="font-mono font-bold text-foreground">{p.actualPolicyNumber || p.policyNumber}</span>
                            <p className="text-[11px] text-muted-foreground">{p.insurerName || 'Partner Insurer'} • Exp: {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-foreground">₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}</span>
                            <div className="mt-0.5"><StatusBadge status={p.status} /></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {historyTab === 'CLAIMS' && (
                  <div className="space-y-2">
                    {(!historyData.claims || historyData.claims.length === 0) ? (
                      <p className="text-muted-foreground py-4 text-center">Zero claims registered against this vehicle asset.</p>
                    ) : (
                      historyData.claims.map((c: any) => (
                        <div key={c.id} className="p-3 rounded-xl border bg-card flex justify-between items-center">
                          <div>
                            <span className="font-mono font-bold text-foreground">{c.claimNumber}</span>
                            <p className="text-[11px] text-muted-foreground">Incident: {new Date(c.incidentDate).toLocaleDateString('en-IN')}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-foreground">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</span>
                            <div className="mt-0.5"><StatusBadge status={c.status} /></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {historyTab === 'RENEWALS' && (
                  <div className="space-y-2">
                    {(!historyData.renewals || historyData.renewals.length === 0) ? (
                      <p className="text-muted-foreground py-4 text-center">No renewal records found for this vehicle asset.</p>
                    ) : (
                      historyData.renewals.map((r: any, rIdx: number) => (
                        <div key={rIdx} className="p-3 rounded-xl border bg-card flex justify-between items-center">
                          <div>
                            <span className="font-bold text-foreground">Renewal Cycle</span>
                            <p className="text-[11px] text-muted-foreground">Due: {r.renewalDueDate ? new Date(r.renewalDueDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-foreground">₹{Number(r.renewalPremium || 0).toLocaleString('en-IN')}</span>
                            <div className="mt-0.5"><StatusBadge status={r.renewalStatus || 'PENDING'} /></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function FamilyTreePage({ familyMembers }: { familyMembers: any[] }) {
  if (!familyMembers || familyMembers.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No family members or dependents added.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-sm">Family Members & Dependents</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {familyMembers.map((m: any, idx: number) => (
          <div key={idx} className="p-3 rounded-lg border bg-card">
            <div className="font-bold">{m.fullName || m.name} ({m.relationship || 'Dependent'})</div>
            <span className="text-[10px] text-muted-foreground">Age: {m.age || 'N/A'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunicationStreamView({ timeline }: { timeline: any[] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No logged customer communications or timeline activities.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {timeline.map((item: any, idx: number) => (
        <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-center">
          <div>
            <span className="font-bold text-primary">{item.title}</span>
            <p className="text-muted-foreground">{item.description}</p>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {new Date(item.date).toLocaleDateString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomerAnalyticsView({ analytics, policies }: { analytics: any; policies: any[] }) {
  const chartData = (policies || []).slice(0, 5).map((p: any) => ({
    name: p.policyNumber?.slice(-6) || 'Policy',
    Premium: Number(p.premiumAmount || 0),
  }));

  return (
    <div className="space-y-4">
      <h4 className="font-bold text-sm">Live Premium Allocation & Health Score</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 border rounded-xl bg-card">
          <span className="text-muted-foreground text-[10px] uppercase font-bold">Health Score</span>
          <div className="text-lg font-black text-emerald-600">{analytics.healthScore || 100} / 100</div>
        </div>
        <div className="p-3 border rounded-xl bg-card">
          <span className="text-muted-foreground text-[10px] uppercase font-bold">Renewal Probability</span>
          <div className="text-lg font-black text-primary">{analytics.renewalProbability || 95}%</div>
        </div>
        <div className="p-3 border rounded-xl bg-card">
          <span className="text-muted-foreground text-[10px] uppercase font-bold">Total Paid Premium</span>
          <div className="text-lg font-black text-foreground">₹{Number(analytics.totalPremiumPaid || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="p-3 border rounded-xl bg-card">
          <span className="text-muted-foreground text-[10px] uppercase font-bold">Claims Settled</span>
          <div className="text-lg font-black text-emerald-600">₹{Number(analytics.totalClaimsSettled || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <UnifiedChart
          type="BAR"
          data={chartData}
          dataKey="Premium"
          categoryKey="name"
          height={220}
          colors={['#10b981']}
        />
      )}
    </div>
  );
}

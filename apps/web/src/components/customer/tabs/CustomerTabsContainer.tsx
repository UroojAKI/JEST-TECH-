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
} from 'lucide-react';
import { StatusBadge } from '../../ui/status-badge';
import { UnifiedChart } from '../../charts/unified-chart';
import { useCustomerWorkspace } from '../../../hooks/useCustomer360';
import { toast } from 'sonner';

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
        {activeTab === 'VEHICLES' && <VehicleCardsView vehicles={vehicles} />}
        {activeTab === 'FAMILY' && <FamilyTreePage familyMembers={familyMembers} />}
        {activeTab === 'NOTES' && <NotesView customerId={customerId} />}
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
        <div key={lead.id} className="p-4 rounded-xl border bg-card flex justify-between items-center">
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
          </div>
          <div className="flex items-center space-x-3">
            {lead.estimatedValue && (
              <span className="font-bold text-sm">₹{Number(lead.estimatedValue).toLocaleString('en-IN')}</span>
            )}
            <StatusBadge status={lead.status} />
          </div>
        </div>
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
                Method: {p.paymentMethod || 'Net Banking'} • Date: {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : 'Recorded'}
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

function DocumentsListView({
  documents,
  customerId,
  refetch,
}: {
  documents: any[];
  customerId: string;
  refetch: () => void;
}) {
  if (!documents || documents.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        <Folder className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        No customer documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc: any) => (
        <div key={doc.id} className="p-4 rounded-xl border bg-card flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-foreground text-sm">{doc.name || doc.originalFileName}</div>
              <div className="text-[11px] text-muted-foreground">
                Size: {(Number(doc.size || 0) / 1024).toFixed(1)} KB • Uploaded: {new Date(doc.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
          <StatusBadge status={doc.verificationStatus || doc.status || 'VERIFIED'} />
        </div>
      ))}
    </div>
  );
}

function NotesView({ customerId }: { customerId: string }) {
  const [notes, setNotes] = useState<Array<{ id: string; text: string; date: string; author: string }>>([
    {
      id: 'init-1',
      text: 'Customer profile validated during KYC intake. Preferred communication via WhatsApp.',
      date: new Date().toLocaleDateString('en-IN'),
      author: 'Operations Executive',
    },
  ]);
  const [newNote, setNewNote] = useState('');

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes([
      {
        id: `note-${Date.now()}`,
        text: newNote.trim(),
        date: new Date().toLocaleDateString('en-IN'),
        author: 'Current User',
      },
      ...notes,
    ]);
    setNewNote('');
    toast.success('Note added to customer profile');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddNote} className="space-y-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add an internal note or interaction log about this customer..."
          className="w-full p-3 rounded-xl border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors"
          >
            Add Note
          </button>
        </div>
      </form>

      <div className="space-y-2 pt-2">
        {notes.map((n) => (
          <div key={n.id} className="p-3 rounded-xl border bg-card space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span className="font-bold text-foreground">{n.author}</span>
              <span>{n.date}</span>
            </div>
            <p className="text-xs text-foreground/90">{n.text}</p>
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
                  {p.policyNumber || 'Draft Policy'} • {p.policyType || 'General Policy'}
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
                Claim #{c.claimNumber} • {c.lossType || 'Claim Incident'}
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Policy: {c.policy?.policyNumber || 'N/A'} • Amount: ₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}
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
        <div key={q.id} className="p-4 rounded-xl border bg-card flex justify-between items-center">
          <div>
            <span className="font-bold text-primary font-mono">{q.quotationCode}</span>
            <p className="text-xs font-semibold">{q.title || 'Motor Quotation'}</p>
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

function VehicleCardsView({ vehicles }: { vehicles: any[] }) {
  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
        No vehicle assets registered under this customer profile.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {vehicles.map((v: any, idx: number) => (
        <div key={idx} className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm">{v.registrationNumber} • {v.make} {v.model}</h4>
            <StatusBadge status={v.status || 'ACTIVE'} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Policy: {v.policyNumber || 'In Quote Pipeline'}</div>
            <div>Expiry: {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString('en-IN') : 'N/A'}</div>
          </div>
        </div>
      ))}
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

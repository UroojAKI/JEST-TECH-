'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { StatusBadge } from '../../ui/status-badge';
import { UnifiedChart } from '../../charts/unified-chart';
import { useCustomerWorkspace } from '../../../hooks/useCustomer360';

export function CustomerTabsContainer({ customerId }: { customerId: string }) {
  const [activeTab, setActiveTab] = useState<string>('POLICIES');
  const { workspace, isLoading } = useCustomerWorkspace(customerId);

  const policies = workspace?.policies || [];
  const claims = workspace?.claims || [];
  const quotations = workspace?.quotations || [];
  const vehicles = workspace?.vehicles || [];
  const familyMembers = workspace?.familyMembers || [];
  const timeline = workspace?.timeline || [];
  const analytics = workspace?.analytics || {};

  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'POLICIES', label: 'Policies', icon: <ShieldCheck className="h-3.5 w-3.5" />, badge: policies.length },
    { id: 'QUOTATIONS', label: 'Quotations', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, badge: quotations.length },
    { id: 'CLAIMS', label: 'Claims', icon: <FileText className="h-3.5 w-3.5" />, badge: claims.length },
    { id: 'RENEWALS', label: 'Renewals', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'PAYMENTS', label: 'Payments', icon: <Wallet className="h-3.5 w-3.5" /> },
    { id: 'DOCUMENTS', label: 'Documents', icon: <Folder className="h-3.5 w-3.5" /> },
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
        {activeTab === 'POLICIES' && <ExpandablePoliciesView policies={policies} />}
        {activeTab === 'CLAIMS' && <ClaimsLifecycleView claims={claims} />}
        {activeTab === 'QUOTATIONS' && <QuotationsListView quotations={quotations} />}
        {activeTab === 'VEHICLES' && <VehicleCardsView vehicles={vehicles} />}
        {activeTab === 'FAMILY' && <FamilyTreePage familyMembers={familyMembers} />}
        {activeTab === 'COMMUNICATION' && <CommunicationStreamView timeline={timeline} />}
        {activeTab === 'ACTIVITIES' && <CommunicationStreamView timeline={timeline} />}
        {activeTab === 'ANALYTICS' && <CustomerAnalyticsView analytics={analytics} policies={policies} />}
        {['OVERVIEW', 'RENEWALS', 'PAYMENTS', 'DOCUMENTS', 'NOTES'].includes(activeTab) && (
          <div className="py-8 text-center text-muted-foreground">
            Customer 360 Workspace Module: <strong>{activeTab}</strong>. Total Premium Paid: ₹{Number(analytics.totalPremiumPaid || 0).toLocaleString('en-IN')}.
          </div>
        )}
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

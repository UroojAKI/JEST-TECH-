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
} from 'lucide-react';
import { StatusBadge } from '../../ui/status-badge';
import { UnifiedChart } from '../../charts/unified-chart';

export function CustomerTabsContainer({ customerId }: { customerId: string }) {
  const [activeTab, setActiveTab] = useState<string>('POLICIES');

  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'POLICIES', label: 'Policies', icon: <ShieldCheck className="h-3.5 w-3.5" />, badge: 2 },
    { id: 'QUOTATIONS', label: 'Quotations', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, badge: 1 },
    { id: 'CLAIMS', label: 'Claims', icon: <FileText className="h-3.5 w-3.5" />, badge: 1 },
    { id: 'RENEWALS', label: 'Renewals', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'PAYMENTS', label: 'Payments', icon: <Wallet className="h-3.5 w-3.5" /> },
    { id: 'DOCUMENTS', label: 'Documents', icon: <Folder className="h-3.5 w-3.5" />, badge: 4 },
    { id: 'COMMUNICATION', label: 'Communication', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'ACTIVITIES', label: 'Activities', icon: <Calendar className="h-3.5 w-3.5" /> },
    { id: 'VEHICLES', label: 'Vehicles', icon: <Car className="h-3.5 w-3.5" />, badge: 2 },
    { id: 'FAMILY', label: 'Family', icon: <Users className="h-3.5 w-3.5" /> },
    { id: 'NOTES', label: 'Notes', icon: <StickyNote className="h-3.5 w-3.5" /> },
    { id: 'ANALYTICS', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* 15 Tab Bar */}
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
            {t.badge !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Display Area */}
      <div className="p-6 text-xs space-y-4">
        {activeTab === 'POLICIES' && <ExpandablePoliciesView />}
        {activeTab === 'CLAIMS' && <ClaimsLifecycleView />}
        {activeTab === 'DOCUMENTS' && <FolderedDocumentsView />}
        {activeTab === 'VEHICLES' && <VehicleCardsView />}
        {activeTab === 'FAMILY' && <FamilyTreePage />}
        {activeTab === 'COMMUNICATION' && <CommunicationStreamView />}
        {activeTab === 'ANALYTICS' && <CustomerAnalyticsView />}
        {['OVERVIEW', 'QUOTATIONS', 'RENEWALS', 'PAYMENTS', 'ACTIVITIES', 'NOTES'].includes(activeTab) && (
          <div className="py-8 text-center text-muted-foreground">
            Active Workspace Module: <strong>{activeTab}</strong>. Rendering real-time backend data for Customer {customerId}.
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandablePoliciesView() {
  const [expandedId, setExpandedId] = useState<string | null>('pol-1');

  return (
    <div className="space-y-3">
      {[
        { id: 'pol-1', number: 'POL-001048', product: 'Motor Comprehensive (MH-12-AB-1234)', insurer: 'ICICI Lombard', premium: '₹45,000', idv: '₹8,50,000', status: 'ACTIVE', expiry: '2026-08-15' },
        { id: 'pol-2', number: 'POL-001050', product: 'Group Health Optima', insurer: 'HDFC ERGO', premium: '₹1,20,000', idv: '₹10,000,000', status: 'LAPSED', expiry: '2026-06-30' },
      ].map((p) => (
        <div key={p.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div
            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <div className="font-bold text-sm text-foreground">{p.number} • {p.product}</div>
                <div className="text-[11px] text-muted-foreground">Insurer: {p.insurer} • Expires: {p.expiry}</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="font-bold text-sm">{p.premium}</span>
              <StatusBadge status={p.status} />
            </div>
          </div>

          {expandedId === p.id && (
            <div className="p-4 bg-muted/20 border-t space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Sum Insured / IDV</span><div className="font-bold">{p.idv}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Net Premium</span><div className="font-bold">{p.premium}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">GST (18%)</span><div className="font-bold">₹8,100</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Claims History</span><div className="font-bold text-emerald-600">1 Claim (Settled)</div></div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-[11px]">Renew Policy</button>
                <button className="px-3 py-1.5 rounded border bg-background font-semibold hover:bg-accent text-[11px]">Download Policy PDF</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ClaimsLifecycleView() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold text-sm">Claim #CLM-000492 • Motor Rear Collision</h4>
            <span className="text-[11px] text-muted-foreground">Policy: POL-001048 • Surveyor: Anand Kumar</span>
          </div>
          <StatusBadge status="UNDER_REVIEW" />
        </div>

        {/* Claim Lifecycle Progress Stepper */}
        <div className="grid grid-cols-6 gap-2 text-center pt-2">
          {['Reported', 'Surveyor Appointed', 'Assessment', 'Approved', 'Payment', 'Closed'].map((stage, idx) => (
            <div key={stage} className={`p-2 rounded-lg border ${idx < 3 ? 'bg-primary/10 text-primary border-primary/20 font-bold' : 'bg-muted/20 text-muted-foreground'}`}>
              <div className="text-[10px]">{stage}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FolderedDocumentsView() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {['KYC & Identity', 'Policy Copies', 'Claim Files', 'Proposals & Quotes'].map((folder) => (
        <div key={folder} className="p-4 rounded-xl border bg-card hover:border-primary cursor-pointer transition-colors flex items-center space-x-3">
          <Folder className="h-6 w-6 text-primary" />
          <div>
            <div className="font-bold text-xs">{folder}</div>
            <span className="text-[10px] text-muted-foreground">2 Files</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function VehicleCardsView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-sm">MH-12-AB-1234 • Honda City (ZX Petrol)</h4>
          <StatusBadge status="ACTIVE" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Engine #: EN-992810</div>
          <div>Chassis #: CH-88271029</div>
          <div>IDV Value: ₹8,50,000</div>
          <div>Manufacturing Year: 2024</div>
        </div>
      </div>
    </div>
  );
}

function FamilyTreePage() {
  return (
    <div className="space-y-3">
      <h4 className="font-bold text-sm">Family Members & Dependents</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border bg-card"><div className="font-bold">Sunita Mehta (Spouse)</div><span className="text-[10px] text-muted-foreground">Nominee (100% Share)</span></div>
        <div className="p-3 rounded-lg border bg-card"><div className="font-bold">Aarav Mehta (Son)</div><span className="text-[10px] text-muted-foreground">Dependent (Age 12)</span></div>
      </div>
    </div>
  );
}

function CommunicationStreamView() {
  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg border bg-card flex justify-between items-center">
        <div>
          <span className="font-bold text-emerald-600">WhatsApp Outbound</span>
          <p className="text-muted-foreground">Sent renewal quote for POL-001048.</p>
        </div>
        <span className="text-[10px] text-muted-foreground">2 hours ago</span>
      </div>
    </div>
  );
}

function CustomerAnalyticsView() {
  const GWP_DATA = [
    { year: '2024', GWP: 85000 },
    { year: '2025', GWP: 145000 },
    { year: '2026', GWP: 245000 },
  ];

  return (
    <div className="space-y-4">
      <h4 className="font-bold text-sm">Customer LTV & Premium Trajectory</h4>
      <UnifiedChart type="BAR" data={GWP_DATA} dataKey="GWP" categoryKey="year" height={220} colors={['#10b981']} />
    </div>
  );
}

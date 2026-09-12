'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, Minus,
  Users, FileText, Shield, DollarSign,
  RefreshCw, AlertTriangle, BarChart3,
  Clock, CheckCircle, Phone, Target, Activity, UserCheck,
  Plus, Copy, Car, ShieldCheck, AlertCircle, FileCheck,
  Layers, ChevronRight, Eye, Calendar, Sparkles
} from 'lucide-react';

import { MotorQuoteWizard } from '../leads/motor-quote/MotorQuoteWizard';
import { QuoteCard } from '../leads/motor-quote/QuoteCard';
import { InspectionDialog } from '../leads/motor-quote/InspectionDialog';
import { MotorProposalWizard } from '../leads/motor-quote/MotorProposalWizard';
import { PolicyCompletionDialog } from '../leads/motor-quote/PolicyCompletionDialog';
import type { VehicleCategory, SavedMotorQuote } from '../leads/motor-quote/motorFormTypes';

interface DynamicWorkspaceProps {
  roleLabel: string;
  roleIcon?: React.ReactNode;
  fallbackRole?: string;
  customContent?: React.ReactNode;
}

function KpiCard({ title, value, subtitle, trend, trendValue, color = 'primary' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    emerald: 'text-emerald-600 bg-emerald-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
  };
  const valueColorMap: Record<string, string> = {
    primary: 'text-primary',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600',
  };

  return (
    <div className="p-4 rounded-2xl border bg-card text-card-foreground shadow-xs hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-muted-foreground'
          }`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`text-2xl font-black mt-2 tracking-tight ${valueColorMap[color]}`}>
        {value}
      </div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-1 font-medium">{subtitle}</div>}
    </div>
  );
}

export function DynamicWorkspace({ roleLabel, roleIcon, fallbackRole, customContent }: DynamicWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'QUOTATIONS' | 'INSPECTIONS' | 'POLICIES' | 'RENEWALS' | 'CLAIMS'>('OVERVIEW');
  const [quoteFilter, setQuoteFilter] = useState<'ALL' | 'PENDING_INSPECTION' | 'PAYMENT_PENDING' | 'READY_TO_ISSUE' | 'ISSUED'>('ALL');

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<VehicleCategory | null>(null);
  const [cloneQuoteData, setCloneQuoteData] = useState<{ vehicleDetails?: any; proposerDetails?: any } | null>(null);
  const [inspectionQuoteId, setInspectionQuoteId] = useState<string | null>(null);
  const [proposalQuote, setProposalQuote] = useState<SavedMotorQuote | null>(null);
  const [completionQuote, setCompletionQuote] = useState<SavedMotorQuote | null>(null);

  // 1. Telemetry / Dashboard KPIs
  const { data: dashboard, isLoading: dashLoading, isError: dashError, refetch } = useQuery({
    queryKey: ['dashboard-dynamic', roleLabel],
    queryFn: async () => {
      const simulatedRole = fallbackRole || roleLabel.toUpperCase().replace(/ DASHBOARD| HUB/g, '').replace(/ /g, '_');
      const res = await apiClient.get('/dashboard', { params: { role: simulatedRole } });
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // 2. Contacts
  const { data: contactsData = [] } = useQuery({
    queryKey: ['workspace-recent-contacts'],
    queryFn: async () => {
      const res = await apiClient.get('/contacts', { params: { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' } });
      const items = res.data?.data || res.data?.items || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60 * 1000,
  });
  const contacts = Array.isArray(contactsData) ? contactsData : [];

  // 3. Leads
  const { data: leads = [] } = useQuery({
    queryKey: ['workspace-recent-leads'],
    queryFn: async () => {
      const res = await apiClient.get('/leads', { params: { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' } });
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60 * 1000,
  });

  // 4. Policies
  const { data: policies = [] } = useQuery({
    queryKey: ['workspace-recent-policies'],
    queryFn: async () => {
      const res = await apiClient.get('/policies', { params: { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' } });
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60 * 1000,
  });

  // 5. Quotations
  const { data: quotationsData = [] } = useQuery({
    queryKey: ['workspace-quotations'],
    queryFn: async () => {
      const res = await apiClient.get('/quotations', { params: { limit: 20, sortBy: 'createdAt', sortOrder: 'desc' } });
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 30 * 1000,
  });
  const quotations: SavedMotorQuote[] = Array.isArray(quotationsData) ? quotationsData : [];

  // 6. Renewals
  const { data: renewalsData = [] } = useQuery({
    queryKey: ['workspace-renewals-upcoming'],
    queryFn: async () => {
      const res = await apiClient.get('/policies/renewals/upcoming', { params: { range: '30_DAYS' } });
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60 * 1000,
  });
  const renewals = Array.isArray(renewalsData) ? renewalsData : [];

  // 7. Claims
  const { data: claimsData = [] } = useQuery({
    queryKey: ['workspace-claims'],
    queryFn: async () => {
      const res = await apiClient.get('/claims', { params: { limit: 10 } });
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60 * 1000,
  });
  const claims = Array.isArray(claimsData) ? claimsData : [];

  // Filtered quotations
  const filteredQuotes = quotations.filter((q: any) => {
    if (quoteFilter === 'PENDING_INSPECTION') return q.status === 'PENDING_INSPECTION' || q.workflowState === 'INSPECTION_REQUIRED';
    if (quoteFilter === 'PAYMENT_PENDING') return q.status === 'READY_FOR_PROPOSAL' || q.status === 'PAYMENT_UNDER_PROCESS';
    if (quoteFilter === 'READY_TO_ISSUE') return q.status === 'PAYMENT_DONE' || q.status === 'PENDING_ISSUANCE' || q.issuanceStatus === 'ISSUANCE_PENDING';
    if (quoteFilter === 'ISSUED') return q.status === 'CONVERTED_TO_POLICY' || q.status === 'ISSUED' || q.policy;
    return true;
  });

  const inspectionNeededQuotes = quotations.filter((q: any) => q.status === 'PENDING_INSPECTION' || q.workflowState === 'INSPECTION_REQUIRED');
  const readyToIssueQuotes = quotations.filter((q: any) => q.status === 'PAYMENT_DONE' || q.status === 'PENDING_ISSUANCE' || q.issuanceStatus === 'ISSUANCE_PENDING');

  const handleOpenWizard = (category?: VehicleCategory, cloneData?: { vehicleDetails?: any; proposerDetails?: any }) => {
    setInitialCategory(category || null);
    setCloneQuoteData(cloneData || null);
    setIsWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {roleIcon && (
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              {roleIcon}
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">JestPolizy Unified CRM Workspace</div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">{roleLabel}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">End-to-end motor policy lifecycle • Zero back-office dependency</p>
          </div>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <Link
            href="/crm/contacts"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border bg-card text-xs font-bold hover:bg-muted transition-colors"
          >
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            + New Customer
          </Link>
          <Link
            href="/crm/leads"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border bg-card text-xs font-bold hover:bg-muted transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            + New Lead
          </Link>
          <button
            onClick={() => handleOpenWizard()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-md hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            + Create Quotation
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Active Leads" value={leads.length} subtitle="Pipeline inflow" color="primary" />
        <KpiCard title="Total Quotes" value={quotations.length} subtitle="Active proposals" color="sky" />
        <KpiCard title="Pending Inspections" value={inspectionNeededQuotes.length} subtitle="Action required" color="amber" />
        <KpiCard title="Ready to Issue" value={readyToIssueQuotes.length} subtitle="Payment confirmed" color="emerald" />
        <KpiCard title="Issued Policies" value={policies.length} subtitle="In-force portfolio" color="violet" />
        <KpiCard title="Renewals (30D)" value={renewals.length} subtitle="Retention target" color="rose" />
      </div>

      {/* Unified Pipeline Navigation Tabs */}
      <div className="flex items-center gap-2 border-b overflow-x-auto pb-1 text-xs font-bold">
        {[
          { key: 'OVERVIEW', label: 'All Overview', icon: <Layers className="h-4 w-4" /> },
          { key: 'QUOTATIONS', label: `Quotations (${quotations.length})`, icon: <FileText className="h-4 w-4" /> },
          { key: 'INSPECTIONS', label: `Inspections (${inspectionNeededQuotes.length})`, icon: <ShieldCheck className="h-4 w-4" /> },
          { key: 'POLICIES', label: `Issued Policies (${policies.length})`, icon: <Shield className="h-4 w-4" /> },
          { key: 'RENEWALS', label: `Renewals Hub (${renewals.length})`, icon: <Calendar className="h-4 w-4" /> },
          { key: 'CLAIMS', label: `Claims (${claims.length})`, icon: <AlertCircle className="h-4 w-4" /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap border-b-2 ${
              activeTab === t.key
                ? 'border-primary text-primary bg-primary/5 font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {customContent}

          {/* Action Alerts: Ready to Issue & Inspections Required */}
          {(readyToIssueQuotes.length > 0 || inspectionNeededQuotes.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {readyToIssueQuotes.length > 0 && (
                <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>Ready for Instant Policy Issuance ({readyToIssueQuotes.length})</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-500/20 px-2 py-0.5 rounded">
                      Payment Verified
                    </span>
                  </div>
                  <div className="space-y-2">
                    {readyToIssueQuotes.slice(0, 3).map((q: any) => (
                      <div key={q.id} className="flex items-center justify-between p-2.5 rounded-xl bg-background/80 border text-xs">
                        <div>
                          <div className="font-bold text-foreground">{q.proposerDetails?.customerName || q.contact?.firstName || 'Customer'}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{q.quotationCode} • ₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}</div>
                        </div>
                        <button
                          onClick={() => setCompletionQuote(q)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          Complete & Issue Policy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectionNeededQuotes.length > 0 && (
                <div className="p-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-300">
                      <ShieldCheck className="h-4 w-4 text-amber-600" />
                      <span>Inspections Required ({inspectionNeededQuotes.length})</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-500/20 px-2 py-0.5 rounded">
                      Break-in / Expired
                    </span>
                  </div>
                  <div className="space-y-2">
                    {inspectionNeededQuotes.slice(0, 3).map((q: any) => (
                      <div key={q.id} className="flex items-center justify-between p-2.5 rounded-xl bg-background/80 border text-xs">
                        <div>
                          <div className="font-bold text-foreground">{q.proposerDetails?.customerName || 'Customer'}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{q.quotationCode} • {q.registrationNumber || 'Vehicle'}</div>
                        </div>
                        <button
                          onClick={() => setInspectionQuoteId(q.id)}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          Conduct Inspection
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Three-column layout: Recent Customers + Recent Leads + Recent Policies */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Customers */}
            <div className="p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black text-foreground">Recent Customers</h3>
                  </div>
                  <Link href="/crm/contacts" className="text-[10px] font-bold text-primary hover:underline">
                    View All ({contacts.length})
                  </Link>
                </div>
                <div className="space-y-2">
                  {contacts.length > 0 ? contacts.slice(0, 5).map((contact: any) => {
                    const name = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Customer';
                    return (
                      <Link
                        key={contact.id}
                        href={`/crm/contacts/${contact.id}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-xs block group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {name}
                          </div>
                          <div className="text-muted-foreground font-mono text-[10px]">
                            {contact.contactCode || contact.phone || 'REG-ID'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {contact.agentCode ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-primary/10 text-primary border border-primary/20">
                              {contact.agentCode}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground bg-muted/40">
                              Direct
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  }) : (
                    <div className="text-center py-6 text-xs text-muted-foreground">No recent customers</div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Agent Code Tracking</span>
                <span className="font-bold text-emerald-600">Active</span>
              </div>
            </div>

            {/* Leads */}
            <div className="p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black text-foreground">Recent Leads</h3>
                  </div>
                  <Link href="/crm/leads" className="text-[10px] font-bold text-primary hover:underline">
                    View All ({Array.isArray(leads) ? leads.length : 0})
                  </Link>
                </div>
                <div className="space-y-2">
                  {Array.isArray(leads) && leads.length > 0 ? leads.slice(0, 5).map((lead: any) => (
                    <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-foreground truncate">
                          {lead.contact?.firstName || ''} {lead.contact?.lastName || lead.title || 'Lead'}
                        </div>
                        <div className="text-muted-foreground font-mono text-[10px]">{lead.leadCode}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                        lead.status === 'CONVERTED' || lead.status === 'POLICY_ISSUED' ? 'bg-emerald-500/10 text-emerald-600' :
                        lead.status === 'LOST' ? 'bg-rose-500/10 text-rose-600' :
                        'bg-amber-500/10 text-amber-600'
                      }`}>{lead.status || 'ACTIVE'}</span>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-xs text-muted-foreground">No recent leads</div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Pipeline Inflow</span>
                <span className="font-bold text-primary">Live</span>
              </div>
            </div>

            {/* Policies */}
            <div className="p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black text-foreground">Recent Policies</h3>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">{Array.isArray(policies) ? policies.length : 0} shown</span>
                </div>
                <div className="space-y-2">
                  {Array.isArray(policies) && policies.length > 0 ? policies.slice(0, 5).map((policy: any) => (
                    <div key={policy.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-foreground font-mono truncate">{policy.policyNumber}</div>
                        <div className="text-muted-foreground text-[10px] truncate">{policy.insurerName || 'Insurance Co.'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-primary">₹{Number(policy.premiumAmount || policy.totalPremium || 0).toLocaleString('en-IN')}</div>
                        <div className="text-muted-foreground text-[10px] font-bold text-emerald-600">{policy.status}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-xs text-muted-foreground">No recent policies</div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Book of Business</span>
                <span className="font-bold text-emerald-600">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUOTATIONS (MULTI-QUOTE HUB) */}
      {activeTab === 'QUOTATIONS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border bg-card">
            <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
              {[
                { id: 'ALL', label: 'All Quotes' },
                { id: 'PENDING_INSPECTION', label: 'Inspection Required' },
                { id: 'PAYMENT_PENDING', label: 'Payment Pending' },
                { id: 'READY_TO_ISSUE', label: 'Ready to Issue' },
                { id: 'ISSUED', label: 'Policy Issued' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setQuoteFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    quoteFilter === f.id
                      ? 'bg-primary text-primary-foreground font-black'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenWizard()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              New Quotation
            </button>
          </div>

          {filteredQuotes.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border bg-card/50">
              <Car className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="font-bold text-sm text-foreground">No quotations match the selected filter</p>
              <p className="text-xs text-muted-foreground mt-1">Create a new quote or adjust filter criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuotes.map((quote: any, idx: number) => (
                <QuoteCard
                  key={quote.id || quote.quotationCode || idx}
                  quote={quote}
                  onUploadQuote={(id) => toast.success(`Document uploaded for quote #${id.slice(-6)}`)}
                  onConductInspection={setInspectionQuoteId}
                  onCompleteProposal={setProposalQuote}
                  onIssuePolicy={setCompletionQuote}
                  onAddComparisonQuote={(q) => handleOpenWizard(q.vehicleCategory, { vehicleDetails: q.vehicleDetails, proposerDetails: q.proposerDetails })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INSPECTIONS QUEUE */}
      {activeTab === 'INSPECTIONS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-card flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground">Vehicle Inspection Desk</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Quotations flagged for break-in, policy gap over 90 days, or SAOD inspection</p>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
              {inspectionNeededQuotes.length} Pending Sign-Off
            </span>
          </div>

          {inspectionNeededQuotes.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border bg-card/50">
              <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-emerald-600" />
              <p className="font-bold text-sm text-foreground">All vehicle inspections are up to date!</p>
              <p className="text-xs text-muted-foreground mt-1">No outstanding vehicle inspection requests</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inspectionNeededQuotes.map((quote: any, idx: number) => (
                <QuoteCard
                  key={quote.id || idx}
                  quote={quote}
                  onUploadQuote={() => {}}
                  onConductInspection={setInspectionQuoteId}
                  onCompleteProposal={setProposalQuote}
                  onIssuePolicy={setCompletionQuote}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ISSUED POLICIES TABLE */}
      {activeTab === 'POLICIES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-card flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground">Issued Policies Portfolio</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Authoritative active policies issued across all channels</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
              {policies.length} Policies Active
            </span>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="p-3.5">Policy Number</th>
                    <th className="p-3.5">Insured Proposer</th>
                    <th className="p-3.5">Insurer</th>
                    <th className="p-3.5">Effective Dates</th>
                    <th className="p-3.5 text-right">Premium</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {policies.length > 0 ? policies.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-foreground">{p.policyNumber}</td>
                      <td className="p-3.5 font-semibold text-foreground">{p.contact?.firstName || p.contactName || 'Insured'}</td>
                      <td className="p-3.5 text-muted-foreground">{p.insurerName || 'Insurance Co.'}</td>
                      <td className="p-3.5 text-muted-foreground font-mono text-[11px]">
                        {p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-IN') : 'Today'} - {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN') : '+1 Year'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-primary">₹{Number(p.premiumAmount || p.totalPremium || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                          {p.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                        No issued policies found. Complete quotation proposals to issue policies.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RENEWALS HUB */}
      {activeTab === 'RENEWALS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-card flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground">Renewals & Retention Hub</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Policies due for expiry within 30 days • Scheduled retention campaigns</p>
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
              {renewals.length} Renewals Due
            </span>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="p-3.5">Policy Number</th>
                    <th className="p-3.5">Customer / Contact</th>
                    <th className="p-3.5">Expiry Date</th>
                    <th className="p-3.5">Urgency</th>
                    <th className="p-3.5 text-right">Renewal Premium</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {renewals.length > 0 ? renewals.map((r: any) => (
                    <tr key={r.id || r.policyId} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-foreground">{r.policyNumber}</td>
                      <td className="p-3.5 font-semibold text-foreground">{r.customerName || r.proposerName || 'Customer'}</td>
                      <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('en-IN') : 'Soon'}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          {r.daysRemaining ? `${r.daysRemaining} days left` : 'Due Soon'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-bold text-primary">₹{Number(r.premiumAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenWizard()}
                          className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors"
                        >
                          Generate Renewal Quote
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                        No upcoming renewals due in the next 30 days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CLAIMS TRACKER */}
      {activeTab === 'CLAIMS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-card flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground">Motor Claims Tracking</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Live status of customer claims from survey through settlement</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
              {claims.length} Active Claims
            </span>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="p-3.5">Claim ID</th>
                    <th className="p-3.5">Policy Number</th>
                    <th className="p-3.5">Date of Incident</th>
                    <th className="p-3.5">Claim Amount</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {claims.length > 0 ? claims.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-foreground">{c.claimNumber || c.id.slice(0, 8)}</td>
                      <td className="p-3.5 font-mono text-muted-foreground">{c.policyNumber || 'POL-...'}</td>
                      <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{c.incidentDate ? new Date(c.incidentDate).toLocaleDateString('en-IN') : 'Recent'}</td>
                      <td className="p-3.5 font-bold text-foreground">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 uppercase">
                          {c.status || 'SUBMITTED'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">
                        No claims filed currently.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Workflow Modals */}
      <MotorQuoteWizard
        isOpen={isWizardOpen}
        initialCategory={initialCategory || undefined}
        cloneQuoteData={cloneQuoteData}
        onClose={() => setIsWizardOpen(false)}
        onSaved={(saved) => {
          void refetch();
          setIsWizardOpen(false);
          if (saved?.workflowState === 'INSPECTION_REQUIRED' || saved?.status === 'PENDING_INSPECTION' || saved?.status === 'INSPECTION_REQUIRED') {
            setInspectionQuoteId(saved.id);
            toast.info(`Quotation ${saved?.quotationCode || ''} requires vehicle inspection. Opening capture...`);
          } else {
            toast.success(`Quotation ${saved?.quotationCode || ''} created!`);
          }
        }}
      />

      {inspectionQuoteId && (
        <InspectionDialog
          isOpen
          quotationId={inspectionQuoteId}
          onClose={() => setInspectionQuoteId(null)}
          onSuccess={() => {
            setInspectionQuoteId(null);
            void refetch();
          }}
        />
      )}

      {proposalQuote && (
        <MotorProposalWizard
          isOpen
          quote={proposalQuote}
          onClose={() => setProposalQuote(null)}
          onSuccess={(updated) => {
            setProposalQuote(null);
            void refetch();
            if (updated?.status === 'PENDING_ISSUANCE' || updated?.status === 'PAYMENT_DONE') {
              setCompletionQuote(updated);
            }
          }}
        />
      )}

      {completionQuote && (
        <PolicyCompletionDialog
          isOpen
          quote={completionQuote}
          onClose={() => setCompletionQuote(null)}
          onSuccess={() => {
            setCompletionQuote(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

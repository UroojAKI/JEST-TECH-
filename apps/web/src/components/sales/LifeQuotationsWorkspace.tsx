'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Plus,
  Search,
  RefreshCw,
  Users,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Car,
  HeartPulse,
  Heart,
  Award,
  Loader2,
  X,
} from 'lucide-react';
import { lifeQuotationRepository } from '../../repositories/life-quotation.repository';
import { apiClient } from '../../lib/api-client';
import { PLAN_CATEGORIES, POLICY_FORMS, labelOf } from '../life-quote/lifeFormConfig';

export function LifeQuotationsWorkspace() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'OPEN'>('ALL');

  // Customer Selector Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Fetch Life Quotation Cases
  const {
    data: apiCases = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['life-cases-all'],
    queryFn: async () => {
      try {
        const res = await lifeQuotationRepository.listCases();
        return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : res?.items || [];
      } catch (error) {
        return [];
      }
    },
  });

  // Customer search query for modal
  const { data: customersData = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers-search', customerSearchQuery],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/customers', { params: { search: customerSearchQuery, limit: 50 } });
        return Array.isArray(res.data) ? res.data : res.data?.data || res.data?.items || [];
      } catch {
        return [];
      }
    },
    enabled: isCustomerModalOpen,
  });

  const filteredCases = useMemo(() => {
    let result = apiCases;

    if (activeTab === 'OPEN') {
      result = result.filter(
        (c: any) =>
          c.status === 'DRAFT' ||
          c.status === 'PROPOSAL_CREATED' ||
          c.status === 'QUOTES_GENERATED' ||
          c.status === 'ACCEPTED',
      );
    }

    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (c: any) =>
          String(c.caseCode || '').toLowerCase().includes(term) ||
          String(c.lifeAssuredName || '').toLowerCase().includes(term) ||
          String(c.contact?.firstName || '').toLowerCase().includes(term) ||
          String(c.contact?.lastName || '').toLowerCase().includes(term) ||
          String(c.contact?.phone || '').includes(term),
      );
    }

    return result;
  }, [apiCases, searchQuery, activeTab]);

  return (
    <div className="space-y-6 pb-12">
      {/* Product Line Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Link
          href="/sales/quotations"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Car className="h-4 w-4" />
          <span>Motor Quotations</span>
        </Link>
        <Link
          href="/sales/health-quotations"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <HeartPulse className="h-4 w-4 text-emerald-500" />
          <span>Health Insurance Proposals</span>
        </Link>
        <Link
          href="/sales/life-quotations"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition bg-primary text-primary-foreground shadow-xs"
        >
          <Shield className="h-4 w-4 text-amber-300" />
          <span>Life Insurance Proposals</span>
        </Link>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl border border-border bg-card shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Life CRM
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground mt-2">Life Insurance Proposals</h1>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Manage your Term, Savings, ULIP, Child, and Annuity proposal cases, quotations, and policy issuance.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground transition"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => router.push('/sales/life-quotations/new')}
            className="px-5 py-2.5 rounded-xl bg-foreground text-background font-bold text-xs flex items-center gap-2 hover:opacity-90 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Life Proposal</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold">Total Proposals</span>
          </div>
          <div className="text-xl font-black mt-1 text-foreground">{apiCases.length}</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold">Quotes Attached</span>
          </div>
          <div className="text-xl font-black mt-1 text-foreground">
            {apiCases.reduce((sum: number, c: any) => sum + (c.quotations?.length || 0), 0)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold">In Progress</span>
          </div>
          <div className="text-xl font-black mt-1 text-foreground">
            {apiCases.filter((c: any) => c.status !== 'CONVERTED' && c.status !== 'CANCELLED').length}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Award className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-bold">Policies Issued</span>
          </div>
          <div className="text-xl font-black mt-1 text-foreground">
            {apiCases.filter((c: any) => c.status === 'CONVERTED').length}
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`pb-1 border-b-2 transition ${
              activeTab === 'ALL' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            }`}
          >
            All Proposals
          </button>
          <button
            onClick={() => setActiveTab('OPEN')}
            className={`pb-1 border-b-2 transition ${
              activeTab === 'OPEN' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            }`}
          >
            Open & Active
          </button>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search proposal code, customer name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-sm font-bold text-foreground">No Life Proposals Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'No proposals matched your search query. Try another term.'
              : 'Create your first Life Insurance proposal case to start comparing insurer quotes.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push('/sales/life-quotations/new')}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Life Proposal</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCases.map((lc: any) => (
            <div
              key={lc.id}
              onClick={() => router.push(`/sales/life-quotations/${lc.id}`)}
              className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all flex flex-col gap-4 cursor-pointer shadow-xs group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-foreground group-hover:text-primary transition">
                      {lc.caseCode}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-muted text-foreground">
                      {labelOf(PLAN_CATEGORIES, lc.planCategory)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-foreground mt-1.5">
                    {lc.contact?.firstName} {lc.contact?.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Life Assured: <span className="font-semibold text-foreground">{lc.lifeAssuredName}</span> •{' '}
                    {lc.contact?.phone || 'No phone'}
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    lc.status === 'CONVERTED'
                      ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                      : lc.status === 'ACCEPTED'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : lc.status === 'QUOTES_GENERATED'
                          ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                  }`}
                >
                  {lc.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3 mt-auto">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Policy Form</div>
                  <div className="font-semibold text-foreground">{labelOf(POLICY_FORMS, lc.policyForm)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Smoker / Health</div>
                  <div className="font-semibold text-foreground">
                    {lc.smokerStatus === 'SMOKER' ? 'Smoker' : 'Non-Smoker'} • {lc.heightCm}cm, {lc.weightKg}kg
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Nominee: {lc.nomineeName || 'Pending'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{lc.quotations?.length || 0} Quotes Attached</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Selector Modal (Optional) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-sm font-bold">Select Customer for Life Proposal</h2>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Search customer by name, mobile, or email..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingCustomers ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Searching customers...</span>
                </div>
              ) : customersData && customersData.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {customersData.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        router.push(
                          `/sales/life-quotations/new?customerId=${c.id}&contactId=${c.contactId || c.id}`,
                        )
                      }
                      className="flex flex-col text-left p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">
                          {c.firstName} {c.lastName}
                        </span>
                        {c.customerCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {c.customerCode}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {c.mobile || c.phone} {c.email ? `• ${c.email}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-xs space-y-3">
                  <p>No matching customers found.</p>
                  <button
                    onClick={() => {
                      setIsCustomerModalOpen(false);
                      router.push('/sales/life-quotations/new');
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                  >
                    Start Proposal for New Customer Directly
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


'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { HeartPulse, Plus, Search, RefreshCw, Users, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { labelOf, PLAN_CATEGORIES, POLICY_FORMS } from '../health-quote/healthFormConfig';

export function HealthQuotationsWorkspace() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'OPEN'>('ALL');
  
  // Contact Selector Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const { data: apiCases = [], isLoading, refetch } = useQuery({
    queryKey: ['health-cases-all'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/health/quotation-cases');
        return Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || res.data || []);
      } catch (error) {
        return [];
      }
    },
  });

  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['contacts-search', customerSearchQuery],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/contacts', { params: { search: customerSearchQuery, limit: 5 } });
        return Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
      } catch {
        return [];
      }
    },
    enabled: isCustomerModalOpen,
  });

  const filteredCases = useMemo(() => {
    let result = apiCases;
    
    // Filter by tab
    if (activeTab === 'OPEN') {
      result = result.filter((c: any) => c.status === 'OPEN' || c.status === 'QUOTED');
    }

    // Filter by search query
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter((c: any) => 
        String(c.caseCode || '').toLowerCase().includes(term) ||
        String(c.contact?.firstName || '').toLowerCase().includes(term) ||
        String(c.contact?.lastName || '').toLowerCase().includes(term) ||
        String(c.contact?.phone || '').includes(term)
      );
    }
    
    return result;
  }, [apiCases, searchQuery, activeTab]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-xl border bg-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Health CRM</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">Health Proposals</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">Manage your health insurance proposals, members, and quotes.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refetch()} className="p-2.5 rounded-md border bg-background hover:bg-muted text-muted-foreground">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setIsCustomerModalOpen(true)} className="px-5 py-2.5 rounded-md bg-foreground text-background font-semibold text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Proposal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2"><HeartPulse className="h-4 w-4" /><span className="text-xs">Total Cases</span></div>
          <div className="text-lg font-bold mt-1">{apiCases.length}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="text-xs">Total Quotes</span></div>
          <div className="text-lg font-bold mt-1">
            {apiCases.reduce((sum: number, c: any) => sum + (c.quotations?.length || 0), 0)}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /><span className="text-xs">Open Cases</span></div>
          <div className="text-lg font-bold mt-1">{apiCases.filter((c: any) => c.status === 'OPEN').length}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs">Selected Quotes</span></div>
          <div className="text-lg font-bold mt-1">{apiCases.filter((c: any) => c.status === 'SELECTED').length}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-4 text-sm font-semibold">
          <button onClick={() => setActiveTab('ALL')} className={`pb-1 border-b-2 ${activeTab === 'ALL' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>All Cases</button>
          <button onClick={() => setActiveTab('OPEN')} className={`pb-1 border-b-2 ${activeTab === 'OPEN' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>Open & Quoted</button>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search case code, customer name..." className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm" />
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div className="text-center py-16 rounded-xl border bg-card/50">
          <HeartPulse className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No health cases found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCases.map((hc: any) => (
            <div key={hc.id} className="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors flex flex-col gap-4 cursor-pointer" onClick={() => router.push(`/sales/health-quotations/${hc.id}`)}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-lg">{hc.caseCode}</h3>
                  <div className="text-sm font-semibold mt-1">
                    {hc.contact?.firstName} {hc.contact?.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hc.contact?.phone} {hc.contact?.email ? `• ${hc.contact.email}` : ''}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                  hc.status === 'SELECTED' ? 'bg-emerald-500/10 text-emerald-600' :
                  hc.status === 'QUOTED' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-primary/10 text-primary'
                }`}>
                  {hc.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3 mt-auto">
                <div>
                  <div className="text-muted-foreground mb-0.5">Plan Type</div>
                  <div className="font-bold">{labelOf(PLAN_CATEGORIES, hc.planCategory)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-0.5">Policy Form</div>
                  <div className="font-bold">{labelOf(POLICY_FORMS, hc.policyForm)}</div>
                </div>
                <div className="col-span-2 flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {hc.members?.length || 0} Members
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-primary">
                    <FileText className="h-3.5 w-3.5" />
                    {hc.quotations?.length || 0} Quotes attached
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-xl border shadow-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">Select Customer for Proposal</h2>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-1 rounded-md hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  autoFocus
                  value={customerSearchQuery} 
                  onChange={(e) => setCustomerSearchQuery(e.target.value)} 
                  placeholder="Search by name, phone, or email..." 
                  className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm" 
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingContacts ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Searching customers...</span>
                </div>
              ) : contactsData && contactsData.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {contactsData.map((c: any) => (
                    <button 
                      key={c.id} 
                      onClick={() => router.push(`/sales/health-quotations/new?contactId=${c.id}`)}
                      className="flex flex-col text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-semibold">{c.firstName} {c.lastName}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{c.phone} {c.email ? `• ${c.email}` : ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No customers found. Please create the customer in the CRM first.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

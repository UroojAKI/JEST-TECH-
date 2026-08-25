'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import { Car, Plus, Search, RefreshCw, FileSpreadsheet, Award, AlertTriangle, History } from 'lucide-react';

import { MotorQuoteWizard } from '../leads/motor-quote/MotorQuoteWizard';
import { QuoteCard } from '../leads/motor-quote/QuoteCard';
import { InspectionDialog } from '../leads/motor-quote/InspectionDialog';
import { MotorProposalWizard } from '../leads/motor-quote/MotorProposalWizard';
import type { VehicleCategory, SavedMotorQuote } from '../leads/motor-quote/motorFormTypes';
import { MotorProductCards } from '../workspaces/sales/MotorProductCards';

export function MotorQuotationsWorkspace() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'RENEWALS'>('ACTIVE');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<VehicleCategory | null>(null);
  const [cloneQuoteData, setCloneQuoteData] = useState<{ vehicleDetails?: any; proposerDetails?: any } | null>(null);
  const [inspectionQuoteId, setInspectionQuoteId] = useState<string | null>(null);
  const [proposalQuote, setProposalQuote] = useState<SavedMotorQuote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localQuotes, setLocalQuotes] = useState<SavedMotorQuote[]>([]);

  useEffect(() => {
    const loadLocal = () => {
      try {
        const raw = localStorage.getItem('jest_motor_quotes_global');
        if (raw) {
          const parsed = JSON.parse(raw);
          const validQuotes = parsed.filter((q: any) => !q.id?.toString().startsWith('temp-'));
          setLocalQuotes(validQuotes);
          if (validQuotes.length !== parsed.length) localStorage.setItem('jest_motor_quotes_global', JSON.stringify(validQuotes));
        }
      } catch (error) {
        console.error('Failed to parse local motor quotes', error);
      }
    };
    loadLocal();
    window.addEventListener('storage', loadLocal);
    return () => window.removeEventListener('storage', loadLocal);
  }, []);

  const { data: apiQuotes = [], isLoading, refetch } = useQuery({
    queryKey: ['motor-quotations-all'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/quotations', { params: { productType: 'MOTOR' } });
        const list = res.data?.data || res.data?.items || res.data || [];
        return (Array.isArray(list) ? list : []).map((item: any) => ({
          id: item.id,
          quotationCode: item.quotationCode,
          vehicleCategory: item.motorMetadata?.vehicleCategory || item.vehicleCategory || 'PRIVATE_CAR',
          policyType: item.motorMetadata?.policyType || item.policyType || 'PACKAGE',
          registrationNumber: item.motorMetadata?.registrationNumber || item.registrationNumber || '',
          insurerName: item.insurerName || 'Partner Insurer',
          totalPremium: Number(item.totalPremium || 0),
          idv: Number(item.sumInsured || 0),
          ncbPercentage: Number(item.ncbPercentage || 0),
          status:
            item.workflowState === 'PAYMENT_DONE' ? 'PENDING_ISSUANCE' :
            item.workflowState === 'PAYMENT_UNDER_PROCESS' ? 'PAYMENT_UNDER_PROCESS' :
            item.workflowState === 'INSPECTION_REQUIRED' ? 'PENDING_INSPECTION' :
            item.issuanceStatus === 'ISSUED' ? 'ISSUED' :
            item.motorMetadata?.workflowStatus || item.status || 'DRAFT',
          createdAt: item.createdAt || new Date().toISOString(),
          policyStartDate: item.motorMetadata?.policyDetails?.policyStartDate,
          policyEndDate: item.motorMetadata?.policyDetails?.policyEndDate,
          proposerDetails: item.motorMetadata?.proposerDetails,
          vehicleDetails: item.motorMetadata?.vehicleDetails,
          policyDetails: item.motorMetadata?.policyDetails,
          leadId: item.leadId,
        } as SavedMotorQuote));
      } catch (error) {
        console.error(error);
        return [];
      }
    },
  });

  const allQuotes = useMemo(() => {
    const seen = new Set<string>();
    return [...localQuotes, ...(Array.isArray(apiQuotes) ? apiQuotes : [])]
      .filter((q) => {
        const key = q.quotationCode || q.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [apiQuotes, localQuotes]);

  const { activeFiltered, renewalsFiltered } = useMemo(() => {
    const matched = allQuotes.filter((q) => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return q.registrationNumber?.toLowerCase().includes(term) ||
        q.quotationCode?.toLowerCase().includes(term) ||
        q.proposerDetails?.customerName?.toLowerCase().includes(term) ||
        q.proposerDetails?.mobileNumber?.includes(term);
    });

    const active: SavedMotorQuote[] = [];
    const renewals: SavedMotorQuote[] = [];
    const today = new Date();
    const future45Days = new Date();
    future45Days.setDate(today.getDate() + 45);

    for (const q of matched) {
      if (q.status === 'ISSUED' && q.policyEndDate) {
        const endDate = new Date(q.policyEndDate);
        if (endDate >= today && endDate <= future45Days) {
          renewals.push(q);
          continue;
        }
      }
      active.push(q);
    }
    return { activeFiltered: active, renewalsFiltered: renewals };
  }, [allQuotes, searchQuery]);

  const groupedQuotes = useMemo(() => {
    const target = activeTab === 'ACTIVE' ? activeFiltered : renewalsFiltered;
    return target.reduce((acc, q) => {
      const leadKey = q.leadId || q.proposerDetails?.mobileNumber || q.id;
      const vehicleKey = q.registrationNumber || 'NEW_VEHICLE';
      const key = `${leadKey}___${vehicleKey}`;
      (acc[key] ||= []).push(q);
      return acc;
    }, {} as Record<string, SavedMotorQuote[]>);
  }, [activeFiltered, renewalsFiltered, activeTab]);

  const handleOpenWizard = (category?: VehicleCategory | string, cloneData?: any) => {
    let finalCat = category as VehicleCategory | undefined;
    const map: Record<string, VehicleCategory> = {
      private_car: 'PRIVATE_CAR', bike: 'BIKE', gcv: 'GCV', tractor: 'TRACTOR',
      auto: 'AUTO', taxi: 'TAXI', bus: 'BUS_COACH', misc: 'MISC_CLASS_D',
    };
    if (typeof category === 'string' && map[category]) finalCat = map[category];
    setInitialCategory(finalCat || null);
    setCloneQuoteData(cloneData || null);
    setIsWizardOpen(true);
  };

  const totalValue = allQuotes.reduce((sum, q) => sum + Number(q.totalPremium || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-xl border bg-card">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Motor CRM</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">Motor Quotations</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">Sales creates and pays quotations. Back Office owns policy issuance.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refetch()} className="p-2.5 rounded-md border bg-background hover:bg-muted text-muted-foreground"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => handleOpenWizard()} className="px-5 py-2.5 rounded-md bg-foreground text-background font-semibold text-sm flex items-center gap-2"><Plus className="h-4 w-4" />New Quotation</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card"><div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /><span className="text-xs">Total Quotes</span></div><div className="text-lg font-bold mt-1">{allQuotes.length}</div></div>
        <div className="p-4 rounded-xl border bg-card"><div className="flex items-center gap-2"><Award className="h-4 w-4" /><span className="text-xs">Quote Value</span></div><div className="text-lg font-bold mt-1">₹{totalValue.toLocaleString('en-IN')}</div></div>
        <div className="p-4 rounded-xl border bg-card"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><span className="text-xs">Pending Inspections</span></div><div className="text-lg font-bold mt-1">{allQuotes.filter(q => q.status === 'PENDING_INSPECTION').length}</div></div>
        <div className="p-4 rounded-xl border bg-card"><div className="flex items-center gap-2"><History className="h-4 w-4" /><span className="text-xs">Upcoming Renewals</span></div><div className="text-lg font-bold mt-1">{renewalsFiltered.length}</div></div>
      </div>

      <MotorProductCards onSelect={handleOpenWizard} />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-4 text-sm font-semibold">
          <button onClick={() => setActiveTab('ACTIVE')} className={`pb-1 border-b-2 ${activeTab === 'ACTIVE' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>Active Quotes ({activeFiltered.length})</button>
          <button onClick={() => setActiveTab('RENEWALS')} className={`pb-1 border-b-2 ${activeTab === 'RENEWALS' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>Renewals ({renewalsFiltered.length})</button>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search leads, vehicles, quotes..." className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm" />
        </div>
      </div>

      {Object.keys(groupedQuotes).length === 0 ? (
        <div className="text-center py-16 rounded-xl border bg-card/50"><Car className="h-8 w-8 mx-auto mb-3 text-muted-foreground" /><p className="font-medium">No {activeTab === 'RENEWALS' ? 'renewals' : 'quotations'} found.</p></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedQuotes).map(([groupId, quotes]) => {
            const first = quotes[0];
            const customerName = first?.proposerDetails?.customerName || 'Customer';
            const mobile = first?.proposerDetails?.mobileNumber || '';
            const vehicle = first?.registrationNumber || 'New Vehicle';
            return (
              <div key={groupId} className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b gap-3">
                  <div><div className="text-sm font-bold">{customerName} <span className="text-muted-foreground">|</span> {vehicle}</div><div className="text-xs text-muted-foreground">{mobile} · {quotes.length} version{quotes.length === 1 ? '' : 's'}</div></div>
                  <button onClick={() => handleOpenWizard(first?.vehicleCategory, { vehicleDetails: first?.vehicleDetails, proposerDetails: first?.proposerDetails })} className="px-3 py-1.5 rounded-md border bg-background hover:bg-muted text-xs font-semibold">{activeTab === 'RENEWALS' ? 'Generate Renewal Quote' : 'New Quote Version'}</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quotes.map((quote, idx) => <QuoteCard key={quote.id || quote.quotationCode || idx} quote={quote} onUploadQuote={(id) => toast.success(`Quotation document uploaded for record #${id.slice(-6)}`)} onConductInspection={setInspectionQuoteId} onCompleteProposal={setProposalQuote} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MotorQuoteWizard
        isOpen={isWizardOpen}
        initialCategory={initialCategory || undefined}
        cloneQuoteData={cloneQuoteData}
        onClose={() => setIsWizardOpen(false)}
        onSaved={(newQuote) => {
          setLocalQuotes((prev) => [newQuote, ...prev.filter((q) => q.quotationCode !== newQuote.quotationCode && q.id !== newQuote.id)]);
          void refetch();
        }}
      />

      {inspectionQuoteId && <InspectionDialog isOpen quotationId={inspectionQuoteId} onClose={() => setInspectionQuoteId(null)} onSuccess={() => { setInspectionQuoteId(null); void refetch(); }} />}

      {proposalQuote && <MotorProposalWizard isOpen quote={proposalQuote} onClose={() => setProposalQuote(null)} onSuccess={(updatedQuote) => { setProposalQuote(null); setLocalQuotes((prev) => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q)); void refetch(); }} />}
    </div>
  );
}

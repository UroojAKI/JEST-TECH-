'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import {
  Car,
  Plus,
  Search,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
  Award,
  AlertTriangle,
  History
} from 'lucide-react';

import { MotorQuoteWizard } from '../leads/motor-quote/MotorQuoteWizard';
import { QuoteCard } from '../leads/motor-quote/QuoteCard';
import { InspectionDialog } from '../leads/motor-quote/InspectionDialog';
import { MotorProposalWizard } from '../leads/motor-quote/MotorProposalWizard';
import type { VehicleCategory, SavedMotorQuote } from '../leads/motor-quote/motorFormTypes';
import { MotorProductCards } from '../workspaces/sales/MotorProductCards';

export function MotorQuotationsWorkspace() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'RENEWALS'>('ACTIVE');
  
  // Wizards & Dialogs State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [initialCategory, setInitialCategory] = useState<VehicleCategory | null>(null);
  const [cloneQuoteData, setCloneQuoteData] = useState<{ vehicleDetails?: any; proposerDetails?: any } | null>(null);
  
  const [inspectionQuoteId, setInspectionQuoteId] = useState<string | null>(null);
  const [proposalQuote, setProposalQuote] = useState<SavedMotorQuote | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [localQuotes, setLocalQuotes] = useState<SavedMotorQuote[]>([]);

  // Load quotes stored globally in localStorage
  useEffect(() => {
    const loadLocal = () => {
      try {
        const raw = localStorage.getItem('jest_motor_quotes_global');
        if (raw) {
          const parsed = JSON.parse(raw);
          // Filter out broken temp quotes from previous failed API calls
          const validQuotes = parsed.filter((q: any) => !q.id?.toString().startsWith('temp-'));
          setLocalQuotes(validQuotes);
          
          // Optionally clean up local storage if we filtered anything out
          if (validQuotes.length !== parsed.length) {
            localStorage.setItem('jest_motor_quotes_global', JSON.stringify(validQuotes));
          }
        }
      } catch (e) {
        console.error('Failed to parse local motor quotes', e);
      }
    };
    loadLocal();
    window.addEventListener('storage', loadLocal);
    return () => window.removeEventListener('storage', loadLocal);
  }, []);

  // Fetch quotes from server
  const { data: apiQuotes = [], isLoading, refetch } = useQuery({
    queryKey: ['motor-quotations-all'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/quotations', { params: { productType: 'MOTOR' } });
        const list = res.data?.data || res.data || [];
        return list.map((item: any) => ({
          id: item.id,
          quotationCode: item.quotationCode,
          vehicleCategory: item.motorMetadata?.vehicleCategory || item.vehicleCategory || 'PRIVATE_CAR',
          policyType: item.motorMetadata?.policyType || item.policyType || 'PACKAGE',
          registrationNumber: item.motorMetadata?.registrationNumber || item.registrationNumber || '',
          insurerName: item.insurerName || 'Partner Insurer',
          totalPremium: Number(item.totalPremium || item.basePremium ? item.basePremium * 1.18 : 0),
          idv: Number(item.sumInsured || item.idv || 0),
          ncbPercentage: Number(item.ncbPercentage || 0),
          status: item.motorMetadata?.workflowStatus || item.status || 'DRAFT',
          createdAt: item.createdAt || new Date().toISOString(),
          policyStartDate: item.motorMetadata?.policyDetails?.policyStartDate,
          policyEndDate: item.motorMetadata?.policyDetails?.policyEndDate,
          proposerDetails: item.motorMetadata?.proposerDetails || item.proposerDetails,
          vehicleDetails: item.motorMetadata?.vehicleDetails || item.vehicleDetails,
          policyDetails: item.motorMetadata?.policyDetails || item.policyDetails,
          leadId: item.leadId || `temp-lead-${item.proposerDetails?.mobileNumber || item.id}`,
          contactId: item.contactId, // fallback to group by mobile
        }));
      } catch (e) {
        return [];
      }
    },
  });

  // Merge API quotes and local storage quotes
  const allQuotes = useMemo(() => {
    const seen = new Set<string>();
    const combined: SavedMotorQuote[] = [];
    
    const safeApiQuotes = Array.isArray(apiQuotes) ? apiQuotes : ((apiQuotes as any)?.items || (apiQuotes as any)?.data || []);
    for (const q of [...localQuotes, ...safeApiQuotes]) {
      const key = q.quotationCode || q.id;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(q);
      }
    }
    return combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [apiQuotes, localQuotes]);

  // Filter quotes by search query and split into Active vs Renewals
  const { activeFiltered, renewalsFiltered } = useMemo(() => {
    const matched = allQuotes.filter((q) => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return (
        q.registrationNumber?.toLowerCase().includes(term) ||
        q.quotationCode?.toLowerCase().includes(term) ||
        q.proposerDetails?.customerName?.toLowerCase().includes(term) ||
        q.proposerDetails?.mobileNumber?.includes(term)
      );
    });

    const active = [];
    const renewals = [];
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

  // Group quotes by Lead / Customer (Stacking as Versions)
  const groupedQuotes = useMemo(() => {
    const targetList = activeTab === 'ACTIVE' ? activeFiltered : renewalsFiltered;
    return targetList.reduce((acc, q) => {
      const leadKey = q.leadId || q.proposerDetails?.mobileNumber || q.id;
      const vehicleKey = q.registrationNumber || 'NEW_VEHICLE';
      const key = `${leadKey}___${vehicleKey}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
      return acc;
    }, {} as Record<string, SavedMotorQuote[]>);
  }, [activeFiltered, renewalsFiltered, activeTab]);

  const handleUploadQuote = (id: string) => {
    toast.success(`Quotation document uploaded for record #${id.slice(-6)}`);
  };

  const handleOpenWizard = (category?: VehicleCategory | string, cloneData?: any) => {
    let finalCat = category as VehicleCategory | undefined;
    if (category === 'private_car') finalCat = 'PRIVATE_CAR';
    if (category === 'bike') finalCat = 'BIKE';
    if (category === 'gcv') finalCat = 'GCV';
    if (category === 'tractor') finalCat = 'TRACTOR';
    if (category === 'auto') finalCat = 'AUTO';
    if (category === 'taxi') finalCat = 'TAXI';
    if (category === 'bus') finalCat = 'BUS_COACH';
    if (category === 'misc') finalCat = 'MISC_CLASS_D';

    setInitialCategory(finalCat || null);
    setCloneQuoteData(cloneData || null);
    setIsWizardOpen(true);
  };

  const totalValue = allQuotes.reduce((acc, q) => acc + Number(q.totalPremium || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-xl border bg-card">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Motor CRM
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Motor Quotations
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Manage quotations, complete proposals, and process renewals. Quotes are stacked by lead automatically.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-md border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenWizard()}
            className="px-5 py-2.5 rounded-md bg-foreground text-background font-semibold text-sm shadow-sm hover:bg-foreground/90 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Quotation
          </button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-muted text-foreground border border-border/50">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Quotes</div>
            <div className="text-lg font-bold text-foreground">{allQuotes.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Quote Value</div>
            <div className="text-lg font-bold text-foreground">₹{totalValue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Pending Inspections</div>
            <div className="text-lg font-bold text-foreground">{allQuotes.filter(q => q.status === 'PENDING_INSPECTION').length}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <History className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Upcoming Renewals</div>
            <div className="text-lg font-bold text-foreground">{renewalsFiltered.length}</div>
          </div>
        </div>
      </div>

      <MotorProductCards onSelect={handleOpenWizard} />

      {/* Tabs & Search Box */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-4 text-sm font-semibold w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`pb-1 border-b-2 transition-colors ${
              activeTab === 'ACTIVE' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Active Quotes ({activeFiltered.length})
          </button>
          <button
            onClick={() => setActiveTab('RENEWALS')}
            className={`pb-1 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'RENEWALS' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Renewals ({renewalsFiltered.length})
            {renewalsFiltered.length > 0 && <span className="flex h-2 w-2 rounded-full bg-blue-600" />}
          </button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads, vehicles, quotes..."
            className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Quotations List Grouped by Lead */}
      {Object.keys(groupedQuotes).length === 0 ? (
        <div className="text-center py-16 px-4 rounded-xl border bg-card/50 space-y-4">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mx-auto border border-border">
            <Car className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground">No {activeTab === 'RENEWALS' ? 'Renewals' : 'Quotations'} Found</h3>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? 'Adjust your search filters.' : 'Generate a new motor quote to get started.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedQuotes).map(([groupId, quotes]) => {
            const firstProposer = quotes[0]?.proposerDetails;
            const customerName = firstProposer?.customerName || 'Customer';
            const mobileNumber = firstProposer?.mobileNumber || '';
            const vehicleReg = quotes[0]?.registrationNumber || 'New Vehicle';

            return (
              <div key={groupId} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                {/* Lead Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold">
                      {customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {customerName} <span className="text-muted-foreground font-medium mx-1">|</span> {vehicleReg}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {mobileNumber} • {quotes.length} {quotes.length === 1 ? 'Version' : 'Versions'}
                      </div>
                    </div>
                  </div>

                  {activeTab === 'RENEWALS' ? (
                    <button
                      onClick={() => {
                        const firstQuote = quotes[0];
                        const cat = firstQuote?.vehicleCategory as VehicleCategory;
                        handleOpenWizard(cat || null, {
                          vehicleDetails: firstQuote?.vehicleDetails,
                          proposerDetails: firstQuote?.proposerDetails
                        });
                      }}
                      className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      Generate Renewal Quote
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const firstQuote = quotes[0];
                        const cat = firstQuote?.vehicleCategory as VehicleCategory;
                        handleOpenWizard(cat || null, {
                          vehicleDetails: firstQuote?.vehicleDetails,
                          proposerDetails: firstQuote?.proposerDetails
                        });
                      }}
                      className="px-3 py-1.5 rounded-md border bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors"
                    >
                      New Quote Version
                    </button>
                  )}
                </div>

                {/* Grid of Quote Versions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quotes.map((quote, idx) => (
                    <QuoteCard 
                      key={quote.id || quote.quotationCode || idx} 
                      quote={quote} 
                      onUploadQuote={handleUploadQuote}
                      onConductInspection={setInspectionQuoteId}
                      onCompleteProposal={setProposalQuote}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard Modal - Phase 1 */}
      <MotorQuoteWizard
        isOpen={isWizardOpen}
        initialCategory={initialCategory || undefined}
        cloneQuoteData={cloneQuoteData}
        onClose={() => setIsWizardOpen(false)}
        onSaved={(newQuote) => {
          setLocalQuotes((prev) => [newQuote, ...prev.filter((q) => q.quotationCode !== newQuote.quotationCode && q.id !== newQuote.id)]);
          refetch();
        }}
      />
      
      {/* Inspection Modal - Phase 2 */}
      {inspectionQuoteId && (
        <InspectionDialog
          isOpen={!!inspectionQuoteId}
          quotationId={inspectionQuoteId}
          onClose={() => setInspectionQuoteId(null)}
          onSuccess={() => {
            // Update local state or trigger refetch so it moves to READY_FOR_PROPOSAL
            setLocalQuotes((prev) => prev.map(q => q.id === inspectionQuoteId ? { ...q, status: 'READY_FOR_PROPOSAL' } : q));
            refetch();
          }}
        />
      )}
      
      {/* Proposal & Payment Modal - Phase 3 */}
      {proposalQuote && (
        <MotorProposalWizard
          isOpen={!!proposalQuote}
          quote={proposalQuote}
          onClose={() => setProposalQuote(null)}
          onSuccess={(updatedQuote) => {
            setLocalQuotes((prev) => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
            refetch();
          }}
        />
      )}
    </div>
  );
}

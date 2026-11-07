'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Landmark,
  Plus,
  Search,
  RefreshCw,
  Building,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Filter,
  DollarSign,
  TrendingUp,
  Percent,
  Car,
  HeartPulse,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';
import {
  loansRepository,
  LoanApplicationCase,
  LoanCategory,
  LoanEnquiryStatus,
} from '../../repositories/loans.repository';
import { LOAN_CATEGORIES, STATUS_CONFIG } from './loanFormConfig';
import { LoanApplicationWizard } from './LoanApplicationWizard';
import { LoanCaseWorkspace } from './LoanCaseWorkspace';

export function LoansWorkspace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'SANCTIONED'>('ALL');

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeWorkspaceCaseId, setActiveWorkspaceCaseId] = useState<string | null>(null);

  // Fetch Cases from API
  const {
    data: casesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['loans-cases-list', selectedCategory, selectedStatus],
    queryFn: async () => {
      const res = await loansRepository.listCases({
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        limit: 100,
      });
      return res.items || [];
    },
  });

  const cases: LoanApplicationCase[] = casesData || [];

  // Filtered Cases
  const filteredCases = useMemo(() => {
    let result = cases;

    if (activeTab === 'ACTIVE') {
      result = result.filter(
        (c) =>
          c.status === 'DRAFT' ||
          c.status === 'DOCUMENTS_PENDING' ||
          c.status === 'SUBMITTED_FOR_REVIEW' ||
          c.status === 'UNDERWRITING_IN_PROGRESS' ||
          c.status === 'OFFERS_RECEIVED'
      );
    } else if (activeTab === 'SANCTIONED') {
      result = result.filter(
        (c) => c.status === 'OFFER_SELECTED' || c.status === 'SANCTIONED' || c.status === 'DISBURSED'
      );
    }

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const name = c.contact?.firstName
          ? `${c.contact.firstName} ${c.contact.lastName || ''}`.toLowerCase()
          : (c.customerSnapshot?.fullName || '').toLowerCase();
        const phone = c.contact?.phone || c.customerSnapshot?.phone || '';
        const pan = (c.contact?.panNumber || c.customerSnapshot?.panNumber || '').toLowerCase();
        return (
          c.caseCode.toLowerCase().includes(term) ||
          name.includes(term) ||
          phone.includes(term) ||
          pan.includes(term)
        );
      });
    }

    return result;
  }, [cases, activeTab, searchQuery]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalPipelineValue = cases.reduce((sum, c) => {
      const fSum = c.facilities?.reduce((acc, f) => acc + Number(f.requestedAmount || 0), 0) || 0;
      return sum + fSum;
    }, 0);

    const activeCount = cases.filter(
      (c) =>
        c.status === 'DRAFT' ||
        c.status === 'DOCUMENTS_PENDING' ||
        c.status === 'SUBMITTED_FOR_REVIEW' ||
        c.status === 'UNDERWRITING_IN_PROGRESS' ||
        c.status === 'OFFERS_RECEIVED'
    ).length;

    const sanctionedCount = cases.filter(
      (c) => c.status === 'OFFER_SELECTED' || c.status === 'SANCTIONED'
    ).length;

    const disbursedSum = cases
      .filter((c) => c.status === 'DISBURSED')
      .reduce((sum, c) => {
        const fSum = c.facilities?.reduce((acc, f) => acc + Number(f.requestedAmount || 0), 0) || 0;
        return sum + fSum;
      }, 0);

    return {
      totalPipelineValue,
      activeCount,
      sanctionedCount,
      disbursedSum,
    };
  }, [cases]);

  return (
    <div className="space-y-6 pb-12">
      {/* Product Line Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <Link
          href="/sales/quotations"
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Car className="h-4 w-4" />
          Motor Quotations
        </Link>
        <Link
          href="/sales/health-quotations"
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
        >
          <HeartPulse className="h-4 w-4" />
          Health Quotations
        </Link>
        <Link
          href="/sales/life-quotations"
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Shield className="h-4 w-4" />
          Life Insurance Proposals
        </Link>
        <div className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground flex items-center gap-1.5 shadow-sm shrink-0">
          <Landmark className="h-4 w-4" />
          Loans & Financing
        </div>
      </div>

      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Landmark className="h-5 w-5" />
            </span>
            Retail & Commercial Loans Pipeline
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            End-to-end multi-category mortgage, business and retail loan origination
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            New Loan Enquiry
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Total Pipeline</span>
            <Building className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            ₹{Math.round(kpis.totalPipelineValue / 100000).toLocaleString('en-IN')}{' '}
            <span className="text-xs font-semibold text-muted-foreground">Lakhs</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {cases.length} Total Registered Cases
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>In Underwriting</span>
            <Clock className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {kpis.activeCount}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Pending Sanctions / Review
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Sanctioned</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.sanctionedCount}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Lender Offers Approved
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Disbursed Volume</span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            ₹{Math.round(kpis.disbursedSum / 100000).toLocaleString('en-IN')}{' '}
            <span className="text-xs font-semibold text-muted-foreground">Lakhs</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Booked Loan Assets
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-1 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              activeTab === 'ALL'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            All Cases ({cases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              activeTab === 'ACTIVE'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Active Pipeline ({kpis.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SANCTIONED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              activeTab === 'SANCTIONED'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Sanctioned / Won ({kpis.sanctionedCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-input bg-background font-medium"
          >
            <option value="ALL">All Categories</option>
            {(Object.keys(LOAN_CATEGORIES) as LoanCategory[]).map((c) => (
              <option key={c} value={c}>
                {LOAN_CATEGORIES[c].name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-input bg-background font-medium"
          >
            <option value="ALL">All Statuses</option>
            {Object.keys(STATUS_CONFIG).map((st) => (
              <option key={st} value={st}>
                {STATUS_CONFIG[st as LoanEnquiryStatus].label}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 md:w-56">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case, name, phone..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-semibold text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Loading loan enquiry cases...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
            <div className="text-sm font-bold text-foreground">No loan cases found</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              There are no loan cases matching your current filter criteria. Click &quot;New Loan Enquiry&quot; to intake a new lead.
            </p>
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start New Enquiry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Case Code</th>
                  <th className="py-3 px-4">Borrower Profile</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Facility & Principal</th>
                  <th className="py-3 px-4">Sanction Status</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredCases.map((c) => {
                  const catMeta = LOAN_CATEGORIES[c.category];
                  const stMeta = STATUS_CONFIG[c.status];
                  const primaryFacility = c.facilities?.[0];
                  const selectedOffer =
                    primaryFacility?.selectedOffer ||
                    primaryFacility?.lenderOffers?.find(
                      (o) => o.status === 'SELECTED' || o.id === primaryFacility.selectedOfferId
                    );
                  const borrowerName = c.contact?.firstName
                    ? `${c.contact.firstName} ${c.contact.lastName || ''}`.trim()
                    : c.customerSnapshot?.fullName || 'Borrower';
                  const borrowerPhone = c.contact?.phone || c.customerSnapshot?.phone || '—';
                  const borrowerPan = c.contact?.panNumber || c.customerSnapshot?.panNumber || '';
                  const reqAmount = Number(
                    primaryFacility?.requestedAmount ||
                      c.facilities?.reduce((acc, f) => acc + Number(f.requestedAmount || 0), 0) ||
                      0
                  );

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveWorkspaceCaseId(c.id)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        {c.caseCode}
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {borrowerName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {borrowerPhone}
                          {borrowerPan && ` • ${borrowerPan}`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {catMeta && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catMeta.badgeColor}`}
                          >
                            {catMeta.name}
                          </span>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.occupationType ? c.occupationType.replace(/_/g, ' ') : 'Salaried'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-black text-foreground">
                          ₹{reqAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {primaryFacility?.facilityType.replace(/_/g, ' ') || 'Term Loan'} •{' '}
                          {primaryFacility?.tenureMonths || 240} mos
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {selectedOffer ? (
                          <div>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{Number(selectedOffer.offeredAmount).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {selectedOffer.lenderName} @ {selectedOffer.rateOfInterest}%
                            </div>
                          </div>
                        ) : primaryFacility?.lenderOffers && primaryFacility.lenderOffers.length > 0 ? (
                          <div className="text-amber-600 text-[11px] font-semibold">
                            {primaryFacility.lenderOffers.length} Quotes Logged
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-[11px]">No Quotes Yet</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {stMeta && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stMeta.badgeClass}`}
                          >
                            {stMeta.label}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveWorkspaceCaseId(c.id);
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-md border border-border group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all inline-flex items-center gap-1"
                        >
                          Workspace
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Loan Wizard Modal */}
      {isWizardOpen && (
        <LoanApplicationWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={(newCaseId) => {
            refetch();
            setActiveWorkspaceCaseId(newCaseId);
          }}
        />
      )}

      {/* Loan Case Workspace Modal */}
      {activeWorkspaceCaseId && (
        <LoanCaseWorkspace
          caseId={activeWorkspaceCaseId}
          onClose={() => setActiveWorkspaceCaseId(null)}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  );
}

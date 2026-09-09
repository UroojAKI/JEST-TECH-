'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '../../../lib/formatters';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// EPIC-18 fix: Remove hardcoded PROPOSALS_DATA static array.
// All proposals are now loaded from the authoritative database via the API.

type ProposalStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

interface Proposal {
  id: string;
  proposalNumber: string;
  contactName: string;
  productLine: string;
  insurerName?: string;
  totalPremium: number;
  riskScore?: number;
  checklistProgress?: number;
  status: ProposalStatus;
  createdAt: string;
}

type ViewFilter = 'ALL' | 'UNDER_REVIEW' | 'APPROVED';

export default function ProposalsRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<ViewFilter>('ALL');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (savedView !== 'ALL') params.status = savedView;
      const response = await apiClient.get('/proposals', { params });
      // Handle both array responses and paginated envelope { data: [], total: N }
      const raw = response.data;
      const items: Proposal[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.items)
            ? raw.items
            : [];
      setProposals(items);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to load proposals. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [savedView]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const columns = [
    {
      accessorKey: 'proposalNumber',
      header: 'Proposal #',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/sales/proposals/${row.original.id}`)}
          className="cursor-pointer font-bold text-primary hover:underline"
        >
          {row.original.proposalNumber}
        </span>
      ),
    },
    { accessorKey: 'contactName', header: 'Customer' },
    { accessorKey: 'productLine', header: 'Product' },
    {
      accessorKey: 'totalPremium',
      header: 'Total Premium',
      cell: ({ row }: any) => (
        <strong className="text-emerald-600 font-extrabold" suppressHydrationWarning>
          {formatCurrency(row.original.totalPremium)}
        </strong>
      ),
    },
    {
      accessorKey: 'riskScore',
      header: 'Risk Score',
      cell: ({ row }: any) =>
        row.original.riskScore != null ? (
          <span className="font-bold text-emerald-600">
            Low ({row.original.riskScore}/100)
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      accessorKey: 'checklistProgress',
      header: 'Checklist Progress',
      cell: ({ row }: any) => {
        const progress = row.original.checklistProgress ?? 0;
        return (
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-bold text-[10px]">{progress}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Underwriting Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Proposal &amp; Underwriting Queue
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage proposal review, risk assessment, and policy issuance validation
          </p>
        </div>
      </div>

      {/* Saved Views Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {(
          [
            { id: 'ALL' as ViewFilter, label: 'All Proposals' },
            { id: 'UNDER_REVIEW' as ViewFilter, label: 'Pending Underwriting' },
            { id: 'APPROVED' as ViewFilter, label: 'Approved Today' },
          ] as const
        ).map((view) => (
          <button
            key={view.id}
            onClick={() => setSavedView(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              savedView === view.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading proposals…</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchProposals}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !error && (
        <EnterpriseTable data={proposals} columns={columns} />
      )}
    </AppShell>
  );
}

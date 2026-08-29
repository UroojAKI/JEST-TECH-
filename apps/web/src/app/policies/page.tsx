'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../../hooks/usePolicies';
import { formatCurrency } from '../../lib/formatters';

export default function PolicyRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');

  const { policies, isLoading, isError, refetch } = usePolicies({
    status: savedView !== 'ALL' ? savedView : undefined,
  });

  const columns = [
    {
      accessorKey: 'policyNumber',
      header: 'Policy No',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/policies/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold text-primary font-mono"
        >
          {row.original.policyNumber}
        </span>
      ),
    },
    { accessorKey: 'contactName', header: 'Policy Holder' },
    { accessorKey: 'productLine', header: 'Product' },
    { accessorKey: 'insurerName', header: 'Insurer' },
    {
      accessorKey: 'totalPremium',
      header: 'Total Premium',
      cell: ({ row }: any) => (
        <span className="font-extrabold text-emerald-600 font-mono" suppressHydrationWarning>
          {formatCurrency(row.original.totalPremium)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
    { accessorKey: 'expiryDate', header: 'Expiry Date' },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Active Policy Register
          </h1>
          <p className="text-xs text-muted-foreground">Book of business, active policies, and renewal pipeline</p>
        </div>

        <button
          onClick={() => router.push('/workspace/operations')}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Back Office Issuance Queue</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Active Policies' },
          { id: 'ACTIVE', label: 'In-Force Policies' },
          { id: 'RENEWAL_DUE', label: 'Renewal Due' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSavedView(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              savedView === view.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading policies from API...</div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-red-500">Failed to load policy register from API.</div>
      ) : (
        <EnterpriseTable data={Array.isArray(policies) ? policies : ((policies as any)?.items || (policies as any)?.data || [])} columns={columns} />
      )}
    </AppShell>
  );
}

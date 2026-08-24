'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '../../../lib/formatters';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { ShieldCheck, Plus } from 'lucide-react';

const PROPOSALS_DATA = [
  {
    id: 'PROP-2026-0091',
    proposalNumber: 'PROP-2026-0091',
    contactName: 'Rahul Patil',
    productLine: 'Motor Comprehensive (MH-12-AB-1234)',
    insurerName: 'ICICI Lombard',
    totalPremium: 16545,
    riskScore: 14,
    checklistProgress: 80,
    status: 'UNDER_REVIEW',
    createdAt: '2026-07-22',
  },
  {
    id: 'PROP-2026-0092',
    proposalNumber: 'PROP-2026-0092',
    contactName: 'Acme Logistics Pvt Ltd',
    productLine: 'Group Health Optima (50 Lives)',
    insurerName: 'HDFC ERGO',
    totalPremium: 450000,
    riskScore: 28,
    checklistProgress: 100,
    status: 'APPROVED',
    createdAt: '2026-07-21',
  },
];

export default function ProposalsRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');

  const filteredData = (Array.isArray(PROPOSALS_DATA) ? PROPOSALS_DATA : (((PROPOSALS_DATA as any)?.data || (PROPOSALS_DATA as any)?.items || []))).filter((p: any) => {
    if (savedView === 'APPROVED') return p.status === 'APPROVED';
    if (savedView === 'UNDER_REVIEW') return p.status === 'UNDER_REVIEW';
    return true;
  });

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
        <strong className="text-emerald-600 font-extrabold" suppressHydrationWarning>{formatCurrency(row.original.totalPremium)}</strong>
      ),
    },
    {
      accessorKey: 'riskScore',
      header: 'Risk Score',
      cell: ({ row }: any) => (
        <span className="font-bold text-emerald-600">Low ({row.original.riskScore}/100)</span>
      ),
    },
    {
      accessorKey: 'checklistProgress',
      header: 'Checklist Progress',
      cell: ({ row }: any) => (
        <div className="flex items-center space-x-2">
          <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${row.original.checklistProgress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${row.original.checklistProgress}%` }}
            />
          </div>
          <span className="font-bold text-[10px]">{row.original.checklistProgress}%</span>
        </div>
      ),
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
            <ShieldCheck className="h-5 w-5 text-primary" /> Proposal & Underwriting Queue
          </h1>
          <p className="text-xs text-muted-foreground">Manage proposal review, risk assessment, and policy issuance validation</p>
        </div>
      </div>

      {/* Saved Views Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Proposals' },
          { id: 'UNDER_REVIEW', label: 'Pending Underwriting' },
          { id: 'APPROVED', label: 'Approved Today' },
        ].map((view) => (
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

      <EnterpriseTable data={filteredData} columns={columns} />
    </AppShell>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ShieldCheck, RefreshCw, AlertTriangle, Users, Download } from 'lucide-react';
import { PolicyItem } from '../../repositories/policies.repository';

const POLICIES_DATA: PolicyItem[] = [
  {
    id: 'POL-001048',
    policyNumber: 'POL-001048',
    contactName: 'Rahul Patil',
    productLine: 'Motor Comprehensive (MH-12-AB-1234)',
    insurerName: 'ICICI Lombard',
    idvValue: 850000,
    totalPremium: 16545,
    status: 'RENEWAL_DUE',
    startDate: '2025-08-15',
    expiryDate: '2026-08-15',
    renewalExecutive: 'Rajesh Sharma',
    healthScore: 92,
    claimsCount: 0,
    createdAt: '2025-08-15',
  },
  {
    id: 'POL-001049',
    policyNumber: 'POL-001049',
    contactName: 'Acme Logistics Pvt Ltd',
    productLine: 'Group Health Optima (50 Lives)',
    insurerName: 'HDFC ERGO',
    idvValue: 10000000,
    totalPremium: 450000,
    status: 'ACTIVE',
    startDate: '2026-01-10',
    expiryDate: '2027-01-10',
    renewalExecutive: 'Sunil Verma',
    healthScore: 98,
    claimsCount: 1,
    createdAt: '2026-01-10',
  },
  {
    id: 'POL-001050',
    policyNumber: 'POL-001050',
    contactName: 'Sunita Kulkarni',
    productLine: 'Health Family Optima',
    insurerName: 'Star Health',
    idvValue: 500000,
    totalPremium: 28000,
    status: 'GRACE_PERIOD',
    startDate: '2025-06-30',
    expiryDate: '2026-06-30',
    renewalExecutive: 'Rajesh Sharma',
    healthScore: 78,
    claimsCount: 0,
    createdAt: '2025-06-30',
  },
];

export default function PoliciesRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');

  const filteredData = POLICIES_DATA.filter((p) => {
    if (savedView === 'ACTIVE') return p.status === 'ACTIVE';
    if (savedView === 'RENEWAL_DUE') return p.status === 'RENEWAL_DUE';
    if (savedView === 'GRACE_PERIOD') return p.status === 'GRACE_PERIOD';
    return true;
  });

  const columns = [
    {
      accessorKey: 'policyNumber',
      header: 'Policy Number',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/policies/${row.original.id}`)}
          className="cursor-pointer font-bold text-primary hover:underline flex items-center space-x-1"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{row.original.policyNumber}</span>
        </span>
      ),
    },
    { accessorKey: 'contactName', header: 'Customer' },
    { accessorKey: 'productLine', header: 'Product' },
    { accessorKey: 'insurerName', header: 'Insurer' },
    {
      accessorKey: 'idvValue',
      header: 'IDV Value',
      cell: ({ row }: any) => `₹${row.original.idvValue.toLocaleString()}`,
    },
    {
      accessorKey: 'totalPremium',
      header: 'Premium',
      cell: ({ row }: any) => (
        <strong className="text-emerald-600 font-extrabold">₹{row.original.totalPremium.toLocaleString()}</strong>
      ),
    },
    {
      accessorKey: 'healthScore',
      header: 'Health',
      cell: ({ row }: any) => (
        <span className="font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
          {row.original.healthScore}% 🟢
        </span>
      ),
    },
    { accessorKey: 'expiryDate', header: 'Expiry Date' },
    { accessorKey: 'renewalExecutive', header: 'Renewal Exec' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      {/* Header & Bulk Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Enterprise Policy Operations Center
          </h1>
          <p className="text-xs text-muted-foreground">Manage active policies, endorsements, renewals, and grace period recovery</p>
        </div>

        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md border bg-card hover:bg-accent">
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
        </div>
      </div>

      {/* "My Work" Executive Queue */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Today's Renewal Calls</span>
          <div className="font-extrabold text-foreground text-sm">6 Calls Scheduled</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Grace Recoveries</span>
          <div className="font-extrabold text-amber-600 text-sm">2 Policies</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Endorsements Pending</span>
          <div className="font-extrabold text-primary text-sm">3 Servicing Requests</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Renewal Retention Rate</span>
          <div className="font-extrabold text-emerald-600 text-sm">88.4%</div>
        </div>
      </div>

      {/* Saved Views Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Policies' },
          { id: 'RENEWAL_DUE', label: 'Renewals Due (45/30/15 Days)' },
          { id: 'GRACE_PERIOD', label: 'Grace Period Recovery' },
          { id: 'ACTIVE', label: 'Active Policies' },
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

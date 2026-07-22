'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { FileSpreadsheet, Plus } from 'lucide-react';

const QUOTATIONS_DATA = [
  {
    id: 'QT-2026-0084',
    quotationNumber: 'QT-2026-0084',
    version: 3,
    contactName: 'Rahul Patil',
    productLine: 'Motor Comprehensive (MH-12-AB-1234)',
    insurerName: 'ICICI Lombard',
    idvValue: 850000,
    totalPremium: 16545,
    status: 'ACCEPTED',
    expiryDate: '2026-08-10',
    createdAt: '2026-07-20',
  },
  {
    id: 'QT-2026-0085',
    quotationNumber: 'QT-2026-0085',
    version: 1,
    contactName: 'Acme Logistics Pvt Ltd',
    productLine: 'Group Health Optima (50 Lives)',
    insurerName: 'HDFC ERGO',
    idvValue: 10000000,
    totalPremium: 450000,
    status: 'SHARED',
    expiryDate: '2026-08-15',
    createdAt: '2026-07-21',
  },
  {
    id: 'QT-2026-0086',
    quotationNumber: 'QT-2026-0086',
    version: 2,
    contactName: 'Sunita Kulkarni',
    productLine: 'Health Family Optima',
    insurerName: 'Star Health',
    idvValue: 500000,
    totalPremium: 28000,
    status: 'DRAFT',
    expiryDate: '2026-08-05',
    createdAt: '2026-07-22',
  },
];

export default function QuotationRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');

  const filteredData = QUOTATIONS_DATA.filter((q) => {
    if (savedView === 'ACCEPTED') return q.status === 'ACCEPTED';
    if (savedView === 'SHARED') return q.status === 'SHARED';
    if (savedView === 'DRAFT') return q.status === 'DRAFT';
    return true;
  });

  const columns = [
    {
      accessorKey: 'quotationNumber',
      header: 'Quote Number',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/sales/quotations/${row.original.id}`)}
          className="cursor-pointer font-bold text-primary hover:underline flex items-center space-x-1"
        >
          <span>{row.original.quotationNumber}</span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full font-mono">
            v{row.original.version}
          </span>
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
      header: 'Total Premium',
      cell: ({ row }: any) => (
        <strong className="text-emerald-600 font-extrabold">₹{row.original.totalPremium.toLocaleString()}</strong>
      ),
    },
    { accessorKey: 'expiryDate', header: 'Expires' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Quotation Register & Platform
          </h1>
          <p className="text-xs text-muted-foreground">Manage multi-insurer quotations and rating engine proposals</p>
        </div>
        <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
          <Plus className="h-4 w-4" />
          <span>+ Generate New Quote</span>
        </button>
      </div>

      {/* Saved Views Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Quotations' },
          { id: 'ACCEPTED', label: 'Accepted by Customer' },
          { id: 'SHARED', label: 'Waiting Customer' },
          { id: 'DRAFT', label: 'Drafts' },
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

'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ShieldCheck, Plus } from 'lucide-react';

const POLICIES_DATA = [
  { id: '1', policyNumber: 'POL-000101', customer: 'Rohan Mehta', product: 'Motor Comprehensive', insurer: 'ICICI Lombard', premium: '₹14,500', status: 'ACTIVE' },
  { id: '2', policyNumber: 'POL-000102', customer: 'Pooja Verma', product: 'Health Optima', insurer: 'Star Health', premium: '₹22,000', status: 'ACTIVE' },
  { id: '3', policyNumber: 'POL-000103', customer: 'TechCorp Pvt Ltd', product: 'Group Health', insurer: 'HDFC ERGO', premium: '₹4,50,000', status: 'LAPSED' },
];

const COLUMNS = [
  { accessorKey: 'policyNumber', header: 'Policy Number' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'product', header: 'Product' },
  { accessorKey: 'insurer', header: 'Insurer' },
  { accessorKey: 'premium', header: 'Premium' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
  },
];

export default function PoliciesPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Policies Portfolio
          </h1>
          <p className="text-xs text-muted-foreground">Manage active, lapsed, and renewed insurance policies</p>
        </div>
        <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
          <Plus className="h-4 w-4" />
          <span>New Policy Issue</span>
        </button>
      </div>

      <EnterpriseTable data={POLICIES_DATA} columns={COLUMNS} />
    </AppShell>
  );
}

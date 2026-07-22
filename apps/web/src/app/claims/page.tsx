'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ChunkedFileUploader } from '../../components/upload/chunked-file-uploader';
import { FileText, Plus } from 'lucide-react';

const CLAIMS_DATA = [
  { id: '1', claimNumber: 'CLM-000492', policyNumber: 'POL-001048', customer: 'Acme Corp', claimAmount: '₹75,000', status: 'UNDER_REVIEW' },
  { id: '2', claimNumber: 'CLM-000493', policyNumber: 'POL-001049', customer: 'Rahul Sharma', claimAmount: '₹12,000', status: 'APPROVED' },
  { id: '3', claimNumber: 'CLM-000494', policyNumber: 'POL-001051', customer: 'Priya Patel', claimAmount: '₹5,000', status: 'PAID' },
];

const COLUMNS = [
  { accessorKey: 'claimNumber', header: 'Claim Number' },
  { accessorKey: 'policyNumber', header: 'Policy Ref' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'claimAmount', header: 'Claim Amount' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
  },
];

export default function ClaimsPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Claims Management
          </h1>
          <p className="text-xs text-muted-foreground">Process, review, and settle customer insurance claims</p>
        </div>
        <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
          <Plus className="h-4 w-4" />
          <span>Lodge New Claim</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EnterpriseTable data={CLAIMS_DATA} columns={COLUMNS} />
        </div>
        <div className="space-y-4 bg-card border p-4 rounded-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Claim Document Upload</h3>
          <ChunkedFileUploader entityType="CLAIM" entityId="CLM-000492" />
        </div>
      </div>
    </AppShell>
  );
}

'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Users, Plus } from 'lucide-react';

const LEADS_DATA = [
  { id: '1', name: 'Anil Kumar', email: 'anil@gmail.com', phone: '+91 98765 43210', product: 'Motor Insurance', status: 'PENDING' },
  { id: '2', name: 'Sunita Rao', email: 'sunita@yahoo.com', phone: '+91 91234 56789', product: 'Health Family Optima', status: 'CONVERTED' },
];

const COLUMNS = [
  { accessorKey: 'name', header: 'Lead Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'phone', header: 'Phone' },
  { accessorKey: 'product', header: 'Product Interest' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
  },
];

export default function LeadsPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Leads & Pipeline
          </h1>
          <p className="text-xs text-muted-foreground">Track and convert prospective insurance leads</p>
        </div>
        <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
          <Plus className="h-4 w-4" />
          <span>Add New Lead</span>
        </button>
      </div>

      <EnterpriseTable data={LEADS_DATA} columns={COLUMNS} />
    </AppShell>
  );
}

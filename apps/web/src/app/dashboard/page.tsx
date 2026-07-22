'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { KpiCard } from '../../components/ui/kpi-card';
import { StatusBadge } from '../../components/ui/status-badge';
import { UnifiedChart } from '../../components/charts/unified-chart';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { ShieldCheck, FileText, TrendingUp, Users } from 'lucide-react';

const REVENUE_DATA = [
  { name: 'Jan', revenue: 450000 },
  { name: 'Feb', revenue: 520000 },
  { name: 'Mar', revenue: 610000 },
  { name: 'Apr', revenue: 580000 },
  { name: 'May', revenue: 730000 },
  { name: 'Jun', revenue: 890000 },
];

const SAMPLE_POLICIES = [
  { id: 'pol-101', policyNumber: 'POL-001048', customer: 'Acme Corp', productType: 'MOTOR', premiumAmount: '₹45,000', status: 'ACTIVE' },
  { id: 'pol-102', policyNumber: 'POL-001049', customer: 'Rahul Sharma', productType: 'HEALTH', premiumAmount: '₹18,500', status: 'ACTIVE' },
  { id: 'pol-103', policyNumber: 'POL-001050', customer: 'Global Logistics Ltd', productType: 'COMMERCIAL', premiumAmount: '₹1,20,000', status: 'LAPSED' },
  { id: 'pol-104', policyNumber: 'POL-001051', customer: 'Priya Patel', productType: 'LIFE', premiumAmount: '₹25,000', status: 'ACTIVE' },
];

const COLUMNS = [
  { accessorKey: 'policyNumber', header: 'Policy Number' },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'productType', header: 'Product Line' },
  { accessorKey: 'premiumAmount', header: 'Premium' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
  },
];

export default function DashboardPage() {
  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-muted-foreground">Real-time enterprise metrics & policy overview</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Gross Written Premium"
          value="₹8.9M"
          change={18.4}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          title="Active Policies"
          value="1,248"
          change={12.1}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <KpiCard
          title="Claims Filed (MTD)"
          value="42"
          change={-4.5}
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          title="Lead Conversion Rate"
          value="34.2%"
          change={6.8}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Chart Section */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold">Monthly Revenue Collections</h3>
          <span className="text-xs text-muted-foreground">Jan - Jun 2026</span>
        </div>
        <UnifiedChart type="AREA" data={REVENUE_DATA} dataKey="revenue" categoryKey="name" height={280} />
      </div>

      {/* Recent Activity Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold">Recent Issued Policies</h3>
        <EnterpriseTable data={SAMPLE_POLICIES} columns={COLUMNS} />
      </div>
    </AppShell>
  );
}

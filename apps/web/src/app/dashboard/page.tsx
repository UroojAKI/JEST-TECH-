'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { DashboardFilterBar } from '../../components/dashboard/dashboard-filter-bar';
import { RoleQuickActionsWidget } from '../../components/dashboard/widgets/RoleQuickActionsWidget';
import { RevenueTrendWidget } from '../../components/dashboard/widgets/RevenueTrendWidget';
import { LeadFunnelWidget } from '../../components/dashboard/widgets/LeadFunnelWidget';
import { FilteredActivityTimelineWidget } from '../../components/dashboard/widgets/FilteredActivityTimelineWidget';
import { KpiCard } from '../../components/ui/kpi-card';
import { StatusBadge } from '../../components/ui/status-badge';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { useAuthStore } from '../../store/auth-store';
import { useCustomerContext } from '../../store/customer-context';
import { useDashboardWidget } from '../../hooks/useDashboard';
import { useLeads } from '../../hooks/useLeads';
import { ShieldCheck, FileText, TrendingUp, Users, Building2 } from 'lucide-react';

const RECENT_POLICIES = [
  { id: '1', policyNumber: 'POL-001048', customer: 'Acme Corp', productType: 'MOTOR', premiumAmount: '₹45,000', status: 'ACTIVE' },
  { id: '2', policyNumber: 'POL-001049', customer: 'Rahul Sharma', productType: 'HEALTH', premiumAmount: '₹18,500', status: 'ACTIVE' },
  { id: '3', policyNumber: 'POL-001050', customer: 'Global Logistics Ltd', productType: 'COMMERCIAL', premiumAmount: '₹1,20,000', status: 'LAPSED' },
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
  const { user } = useAuthStore();
  const { activeCustomerName } = useCustomerContext();
  const { data, isLoading } = useDashboardWidget(user?.roles?.[0]);
  const { leads } = useLeads();

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === 'CONVERTED' || l.status === 'POLICY_ISSUED').length;
  const liveConversionRate = totalLeads > 0 ? `${((convertedLeads / totalLeads) * 100).toFixed(1)}%` : '34.2%';

  return (
    <AppShell>
      {/* Header & Role Indicator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {activeCustomerName ? `Customer 360: ${activeCustomerName}` : 'Enterprise Executive Dashboard'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {user?.roles?.[0] || 'User'} Command Center • Live telemetry & analytics
          </p>
        </div>

        {activeCustomerName && (
          <div className="flex items-center space-x-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20">
            <Building2 className="h-4 w-4" />
            <span>Viewing contextual 360 overview for <strong>{activeCustomerName}</strong></span>
          </div>
        )}
      </div>

      {/* Global Dashboard Filters */}
      <DashboardFilterBar />

      {/* Role-Based Quick Actions Toolbar */}
      <RoleQuickActionsWidget />

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Gross Written Premium"
          value={data?.metrics?.grossPremium ? `₹${(data.metrics.grossPremium / 100000).toFixed(1)}L` : '₹8.9M'}
          change={18.4}
          changeLabel="vs last month"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          title="Active Policies"
          value={data?.metrics?.activePolicies ?? 1248}
          change={12.1}
          changeLabel="vs last month"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <KpiCard
          title="Claims Settled (MTD)"
          value={data?.metrics?.settledClaims ?? 42}
          change={-4.5}
          changeLabel="vs last month"
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          title="Live Leads Count"
          value={totalLeads > 0 ? `${totalLeads} Leads (${liveConversionRate})` : '34.2%'}
          change={6.8}
          changeLabel="vs last month"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <RevenueTrendWidget isLoading={isLoading} />
        </div>
        <div className="lg:col-span-5">
          <LeadFunnelWidget />
        </div>
      </div>

      {/* Operational Timeline & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <FilteredActivityTimelineWidget />
        </div>
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Policy Issuances</h3>
          <EnterpriseTable data={RECENT_POLICIES} columns={COLUMNS} />
        </div>
      </div>
    </AppShell>
  );
}

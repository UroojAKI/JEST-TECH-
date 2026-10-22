'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ShieldCheck, Car, HeartPulse, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../../hooks/usePolicies';
import { formatCurrency } from '../../lib/formatters';

export default function PolicyRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<'ALL' | 'MOTOR' | 'HEALTH'>('ALL');

  const { policies, isLoading, isError, refetch } = usePolicies({
    status: savedView !== 'ALL' ? savedView : undefined,
  });

  const isHealthPolicy = (p: any): boolean => {
    if (!p) return false;
    const policyType = String(p.policyType || '').toUpperCase();
    const productLine = String(p.productLine || '').toUpperCase();
    const productType = String(p.quotation?.productType || '').toUpperCase();
    if (policyType === 'HEALTH' || productLine.includes('HEALTH') || productType === 'HEALTH') return true;
    if (Array.isArray(p.members) && p.members.length > 0) return true;
    if (p.healthCaseId || p.healthMetadata) return true;
    return false;
  };

  const rawList = Array.isArray(policies) ? policies : ((policies as any)?.items || (policies as any)?.data || []);
  const motorList = useMemo(() => rawList.filter((p: any) => !isHealthPolicy(p)), [rawList]);
  const healthList = useMemo(() => rawList.filter((p: any) => isHealthPolicy(p)), [rawList]);

  const displayedPolicies = useMemo(() => {
    if (productFilter === 'MOTOR') return motorList;
    if (productFilter === 'HEALTH') return healthList;
    return rawList;
  }, [rawList, motorList, healthList, productFilter]);

  const getPolicyPremium = (p: any): number => {
    if (!p) return 0;
    // 1. Authoritative premium on policy record
    if (p.premiumAmount !== undefined && p.premiumAmount !== null && p.premiumAmount !== '') {
      const val = Number(p.premiumAmount);
      if (!isNaN(val) && val > 0) return val;
    }
    // 2. Actual premium from portal/manual entry
    if (p.actualPremium !== undefined && p.actualPremium !== null && p.actualPremium !== '') {
      const val = Number(p.actualPremium);
      if (!isNaN(val) && val > 0) return val;
    }
    // 3. Direct totalPremium property if present
    if (p.totalPremium !== undefined && p.totalPremium !== null && p.totalPremium !== '') {
      const val = Number(p.totalPremium);
      if (!isNaN(val) && val > 0) return val;
    }
    // 4. Quotation snapshot totalPremium or healthMetadata
    if (p.quotation) {
      if (p.quotation.totalPremium !== undefined && p.quotation.totalPremium !== null) {
        const val = Number(p.quotation.totalPremium);
        if (!isNaN(val) && val > 0) return val;
      }
      if (p.quotation.healthMetadata?.premium?.totalPremium) {
        const val = Number(p.quotation.healthMetadata.premium.totalPremium);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    // 5. Payment records
    if (Array.isArray(p.payments) && p.payments.length > 0) {
      const paidSum = p.payments.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
      if (paidSum > 0) return paidSum;
    }
    return Number(p.paidAmount || 0);
  };

  const columns = [
    {
      accessorKey: 'policyNumber',
      header: 'Policy No',
      cell: ({ row }: any) => {
        const isHealth = isHealthPolicy(row.original);
        return (
          <span
            onClick={() => router.push(`/policies/${row.original.id}`)}
            className={`cursor-pointer font-bold font-mono hover:underline ${
              isHealth ? 'text-rose-600' : 'text-primary'
            }`}
          >
            {row.original.policyNumber}
          </span>
        );
      },
    },
    {
      id: 'contactName',
      accessorFn: (row: any) =>
        row.contactName ||
        (row.contact ? `${row.contact.firstName} ${row.contact.lastName || ''}`.trim() : null) ||
        row.customerName ||
        '—',
      header: 'Policy Holder',
    },
    {
      accessorKey: 'productLine',
      header: 'Product / Line',
      cell: ({ row }: any) => {
        const isHealth = isHealthPolicy(row.original);
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                isHealth
                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                  : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
              }`}
            >
              {isHealth ? 'Health' : 'Motor'}
            </span>
            <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
              {isHealth
                ? (row.original.quotation?.title || row.original.productLine || 'Comprehensive Health')
                : (row.original.vehicle?.registrationNumber || row.original.registrationNumber || row.original.productLine || 'Motor')}
            </span>
          </div>
        );
      },
    },
    {
      id: 'insurerName',
      accessorFn: (row: any) => row.insurerName || row.quotation?.insurerName || '—',
      header: 'Insurer',
    },
    {
      id: 'totalPremium',
      accessorFn: (row: any) => getPolicyPremium(row),
      header: 'Total Premium',
      cell: ({ row }: any) => {
        const premium = getPolicyPremium(row.original);
        return (
          <span className="font-extrabold text-emerald-600 font-mono" suppressHydrationWarning>
            {formatCurrency(premium)}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'expiryDate',
      accessorFn: (row: any) => {
        const dateStr = row.expiryDate || row.endDate;
        if (!dateStr) return '—';
        try {
          return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          return String(dateStr);
        }
      },
      header: 'Expiry Date',
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Active Policy Register
          </h1>
          <p className="text-xs text-muted-foreground">Book of business, active policies, and renewal pipeline across Motor & Health</p>
        </div>

        <button
          onClick={() => router.push('/workspace/operations/issuance')}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Back Office Issuance Queue</span>
        </button>
      </div>

      {/* Product Line Filter & Status Views */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Product Line Tabs */}
        <div className="flex border text-xs overflow-x-auto p-1 bg-card rounded-xl space-x-1">
          <button
            onClick={() => setProductFilter('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              productFilter === 'ALL' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All Policies ({rawList.length})</span>
          </button>
          <button
            onClick={() => setProductFilter('MOTOR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              productFilter === 'MOTOR' ? 'bg-blue-600 text-white shadow' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>Motor ({motorList.length})</span>
          </button>
          <button
            onClick={() => setProductFilter('HEALTH')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              productFilter === 'HEALTH' ? 'bg-rose-600 text-white shadow' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <HeartPulse className="h-3.5 w-3.5" />
            <span>Health ({healthList.length})</span>
          </button>
        </div>

        {/* Status Views */}
        <div className="flex border text-xs overflow-x-auto p-1 bg-card rounded-xl space-x-1">
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'ACTIVE', label: 'In-Force' },
            { id: 'RENEWAL_DUE', label: 'Renewal Due' },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setSavedView(view.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                savedView === view.id ? 'bg-primary/10 text-primary border border-primary/20 font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading policies from API...</div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-red-500">Failed to load policy register from API.</div>
      ) : (
        <EnterpriseTable data={displayedPolicies} columns={columns} />
      )}
    </AppShell>
  );
}

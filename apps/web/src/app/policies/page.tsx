'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import {
  ShieldCheck,
  Eye,
  X,
  ExternalLink,
  Calendar,
  User,
  Car,
  CreditCard,
  FileText,
  BadgeCheck,
  CheckCircle2,
  Clock,
  HeartPulse,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../../hooks/usePolicies';
import { formatCurrency } from '../../lib/formatters';

export default function PolicyRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<'ALL' | 'MOTOR' | 'HEALTH'>('ALL');
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);

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

  const getProposerName = (pol: any) => {
    if (!pol) return '—';
    const rawProposer =
      pol.proposerDetails?.customerName ||
      pol.motorMetadata?.proposerDetails?.customerName ||
      pol.quotation?.motorMetadata?.proposerDetails?.customerName;
    const cleanProposer = rawProposer
      ? String(rawProposer).replace(/\u00a0/g, ' ').trim()
      : null;

    return (
      cleanProposer ||
      pol.contactName ||
      pol.customerName ||
      (pol.contact
        ? `${pol.contact.firstName || ''} ${pol.contact.lastName || ''}`.trim()
        : null) ||
      (pol.customer
        ? `${pol.customer.firstName || ''} ${pol.customer.lastName || ''}`.trim()
        : null) ||
      '—'
    );
  };

  const formatDate = (val: string | Date | null | undefined) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(val);
    }
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
      header: 'Policy Holder',
      accessorFn: (row: any) => {
        const rawProposer =
          row.proposerDetails?.customerName ||
          row.motorMetadata?.proposerDetails?.customerName ||
          row.quotation?.motorMetadata?.proposerDetails?.customerName;
        const cleanProposer = rawProposer
          ? String(rawProposer).replace(/\u00a0/g, ' ').trim()
          : null;

        return (
          cleanProposer ||
          row.contactName ||
          row.customerName ||
          (row.contact
            ? `${row.contact.firstName || ''} ${row.contact.lastName || ''}`.trim()
            : null) ||
          (row.customer
            ? `${row.customer.firstName || ''} ${row.customer.lastName || ''}`.trim()
            : null) ||
          '—'
        );
      },
      cell: ({ row }: any) => {
        const name = getProposerName(row.original);
        return <span className="font-semibold">{name}</span>;
      },
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
      header: 'Insurer',
      accessorFn: (row: any) =>
        row.insurerName ||
        row.quotation?.insurerName ||
        row.insurerDetail?.insurerName ||
        row.activeTpInsurer ||
        '—',
      cell: ({ row }: any) => {
        const insurer =
          row.original.insurerName ||
          row.original.quotation?.insurerName ||
          row.original.insurerDetail?.insurerName ||
          row.original.activeTpInsurer;
        return <span className="font-medium">{insurer || '—'}</span>;
      },
    },
    {
      accessorKey: 'netPremium',
      header: 'Net Premium',
      cell: ({ row }: any) => {
        const raw =
          row.original.netPremium ??
          (row.original.totalPremium ? Math.round(Number(row.original.totalPremium) / 1.18) : 0);
        const val = Number(raw || 0);
        return (
          <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono" suppressHydrationWarning>
            {formatCurrency(val)}
          </span>
        );
      },
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
      accessorKey: 'expiryDate',
      header: 'Expiry Date',
      cell: ({ row }: any) => {
        const val = row.original.expiryDate || row.original.endDate;
        if (!val) return <span className="text-muted-foreground">—</span>;
        return <span className="font-mono text-xs">{formatDate(val)}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }: any) => (
        <button
          onClick={() => setSelectedPolicy(row.original)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-muted text-foreground transition-colors shadow-xs"
          title="View full policy details"
        >
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span>View</span>
        </button>
      ),
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

      {/* Policy Details Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold font-mono text-foreground">
                      {selectedPolicy.policyNumber}
                    </h2>
                    <StatusBadge status={selectedPolicy.status} />
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                      {selectedPolicy.productLine || selectedPolicy.policyType || 'MOTOR'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Insurer: <strong className="text-foreground">{selectedPolicy.insurerName || '—'}</strong>
                    {selectedPolicy.quotationCode && (
                      <span> · Quote: <span className="font-mono">{selectedPolicy.quotationCode}</span></span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/policies/${selectedPolicy.id}`)}
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Full Workspace</span>
                </button>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
                  title="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Financial Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Net Premium</span>
                  <div className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {formatCurrency(
                      selectedPolicy.netPremium ||
                      (selectedPolicy.totalPremium ? Math.round(Number(selectedPolicy.totalPremium) / 1.18) : 0)
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Excl. Taxes & GST</div>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Premium</span>
                  <div className="text-base sm:text-lg font-extrabold text-emerald-600 font-mono">
                    {formatCurrency(
                      selectedPolicy.totalPremium ??
                      selectedPolicy.actualPremium ??
                      selectedPolicy.premiumAmount ??
                      0
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Authoritative (Incl. GST)</div>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Balance Due</span>
                  <div className="text-base sm:text-lg font-extrabold text-foreground font-mono">
                    {formatCurrency(selectedPolicy.outstandingBalance ?? 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Outstanding Balance</div>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Status</span>
                  <div className="pt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      (selectedPolicy.paymentStatus || 'PAID') === 'PAID'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {selectedPolicy.paymentStatus || 'PAID'}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Section 64VB Verified</div>
                </div>
              </div>

              {/* Grid 2-Column: Policy Holder & Validity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Policy Holder Card */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <User className="h-4 w-4 text-primary" />
                    <span>Policy Holder & Customer Info</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Full Name:</span>
                      <strong className="text-foreground">{getProposerName(selectedPolicy)}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Mobile Phone:</span>
                      <span className="font-mono text-foreground">
                        {selectedPolicy.contactPhone || selectedPolicy.contact?.phone || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Email Address:</span>
                      <span className="text-foreground">
                        {selectedPolicy.contactEmail || selectedPolicy.contact?.email || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">PAN / KYC Number:</span>
                      <span className="font-mono text-foreground font-semibold">
                        {selectedPolicy.contact?.panNumber ||
                         selectedPolicy.proposerDetails?.panNumber ||
                         selectedPolicy.motorMetadata?.proposerDetails?.panNumber ||
                         'Not Provided (Optional)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Customer ID:</span>
                      <span className="font-mono text-muted-foreground">{selectedPolicy.customerId || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Policy Validity Card */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Coverage Schedule & Policy Period</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Start / Inception Date:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatDate(selectedPolicy.startDate || selectedPolicy.effectiveDate)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Expiry / End Date:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatDate(selectedPolicy.endDate || selectedPolicy.expiryDate)}
                      </span>
                    </div>
                    {selectedPolicy.odExpiryDate && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">OD Expiry Date:</span>
                        <span className="font-mono text-foreground">{formatDate(selectedPolicy.odExpiryDate)}</span>
                      </div>
                    )}
                    {selectedPolicy.tpExpiryDate && (
                      <div className="flex justify-between py-1 border-b">
                        <span className="text-muted-foreground">TP Expiry Date:</span>
                        <span className="font-mono text-foreground">{formatDate(selectedPolicy.tpExpiryDate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Renewal Executive:</span>
                      <span className="text-foreground font-medium">
                        {selectedPolicy.renewalExecutive || 'Assigned Officer'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Details Card (if available) */}
              {(selectedPolicy.vehicle || selectedPolicy.registrationNumber || selectedPolicy.motorMetadata) && (
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Car className="h-4 w-4 text-primary" />
                    <span>Vehicle & Technical Specifications</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Plate No</span>
                      <div className="font-mono font-bold text-primary">
                        {selectedPolicy.vehicle?.registrationNumber || selectedPolicy.registrationNumber || '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Make & Model</span>
                      <div className="font-semibold text-foreground">
                        {selectedPolicy.vehicle?.makeModel || selectedPolicy.makeModel || '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Engine No</span>
                      <div className="font-mono text-foreground">
                        {selectedPolicy.vehicle?.engineNumber || '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Chassis No</span>
                      <div className="font-mono text-foreground">
                        {selectedPolicy.vehicle?.chassisNumber || '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Mfg Year/Month</span>
                      <div className="text-foreground">
                        {selectedPolicy.vehicle?.manufactureYearMonth || '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Vehicle IDV</span>
                      <div className="font-mono font-bold text-foreground">
                        {selectedPolicy.idvValue ? formatCurrency(selectedPolicy.idvValue) : '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Fuel / Category</span>
                      <div className="text-foreground">
                        {selectedPolicy.vehicle?.fuelType || '—'} / {selectedPolicy.vehicle?.category || 'PVT CAR'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">RTO Location</span>
                      <div className="text-foreground">
                        {selectedPolicy.vehicle?.rtoLocation || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Premium Breakdown */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span>Authoritative Premium Breakdown</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Net Premium</span>
                    <div className="font-mono font-semibold">{formatCurrency(selectedPolicy.netPremium || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Own Damage (OD)</span>
                    <div className="font-mono font-semibold">{formatCurrency(selectedPolicy.odPremium || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Third Party (TP)</span>
                    <div className="font-mono font-semibold">{formatCurrency(selectedPolicy.tpPremium || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Add-on Covers</span>
                    <div className="font-mono font-semibold">{formatCurrency(selectedPolicy.addonPremium || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">GST (18%)</span>
                    <div className="font-mono font-semibold">{formatCurrency(selectedPolicy.gstAmount || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Discount Applied</span>
                    <div className="font-mono font-semibold">{formatCurrency(selectedPolicy.discountAmount || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">NCB Percentage</span>
                    <div className="font-mono font-semibold">{selectedPolicy.ncbPercentage ?? 0}%</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Final Payable</span>
                    <div className="font-mono font-bold text-emerald-600">
                      {formatCurrency(selectedPolicy.totalPremium ?? selectedPolicy.actualPremium ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments History (if available) */}
              {Array.isArray(selectedPolicy.payments) && selectedPolicy.payments.length > 0 && (
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    <span>Payment & Receipt Ledger</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b text-muted-foreground text-[10px] uppercase font-bold">
                          <th className="py-1.5">Date</th>
                          <th className="py-1.5">Reference / Txn ID</th>
                          <th className="py-1.5">Method</th>
                          <th className="py-1.5">Amount</th>
                          <th className="py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPolicy.payments.map((pmt: any) => (
                          <tr key={pmt.id} className="border-b last:border-none">
                            <td className="py-1.5 font-mono">{formatDate(pmt.paymentDate || pmt.createdAt)}</td>
                            <td className="py-1.5 font-mono font-semibold">{pmt.transactionId || '—'}</td>
                            <td className="py-1.5 uppercase">{pmt.paymentMethod || 'ONLINE'}</td>
                            <td className="py-1.5 font-mono font-bold text-blue-600">
                              {formatCurrency(pmt.amount)}
                            </td>
                            <td className="py-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                                {pmt.status || 'PAID'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
              <span className="text-xs text-muted-foreground">
                Policy ID: <span className="font-mono">{selectedPolicy.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-muted text-foreground transition"
                >
                  Close
                </button>
                <button
                  onClick={() => router.push(`/policies/${selectedPolicy.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Full Workspace</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

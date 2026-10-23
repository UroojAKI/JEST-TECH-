'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../../../components/layout/app-shell';
import {
  FileText,
  Search,
  ShieldCheck,
  ShieldAlert,
  Download,
  RotateCw,
  Eye,
  X,
  Loader2,
  DollarSign,
  TrendingUp,
  Percent,
  Receipt,
  Car,
  User,
  Calendar,
  Building,
  Hash,
  ExternalLink,
  Copy,
  Check,
  FileCode,
  Lock,
} from 'lucide-react';
import { policiesRepository, PolicyItem } from '../../../repositories/policies.repository';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function PolicyAuditReportPage() {
  const { user, isLoading: authLoading } = useAuth();

  // Role validation: Strict Admin-only view
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const roles = user.roles || (user.role ? [user.role] : []);
    return roles.some((r: any) => {
      const roleStr = typeof r === 'string' ? r : (r?.type || r?.name || '');
      return ['ADMIN', 'SUPER_ADMIN'].includes(roleStr.toUpperCase());
    });
  }, [user]);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [insurerFilter, setInsurerFilter] = useState('ALL');
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch policies with financial breakdown
  const {
    data: policyData,
    isLoading: policiesLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['policy-audit-report'],
    queryFn: () => policiesRepository.getPolicyAuditReport({ limit: 100 }),
    enabled: isAdmin,
    staleTime: 30000,
  });

  const rawPolicies: PolicyItem[] = useMemo(() => {
    if (!policyData) return [];
    if (Array.isArray(policyData)) return policyData;
    if (Array.isArray((policyData as any).data)) return (policyData as any).data;
    if (Array.isArray((policyData as any).items)) return (policyData as any).items;
    return [];
  }, [policyData]);

  // Unique Insurers list for filtering
  const insurerOptions = useMemo(() => {
    const set = new Set<string>();
    rawPolicies.forEach((p) => {
      if (p.insurerName && p.insurerName !== '—') {
        set.add(p.insurerName);
      }
    });
    return Array.from(set).sort();
  }, [rawPolicies]);

  // Filtered policies based on search, status, and insurer
  const filteredPolicies = useMemo(() => {
    return rawPolicies.filter((p) => {
      const q = debouncedSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.policyNumber && p.policyNumber.toLowerCase().includes(q)) ||
        (p.quotationCode && p.quotationCode.toLowerCase().includes(q)) ||
        (p.quotationId && p.quotationId.toLowerCase().includes(q)) ||
        (p.customerName && p.customerName.toLowerCase().includes(q)) ||
        (p.contactName && p.contactName.toLowerCase().includes(q)) ||
        (p.contactPhone && p.contactPhone.includes(q)) ||
        (p.vehicle?.registrationNumber && p.vehicle.registrationNumber.toLowerCase().includes(q)) ||
        (p.vehicle?.makeModel && p.vehicle.makeModel.toLowerCase().includes(q)) ||
        (p.insurerName && p.insurerName.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' || (p.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesInsurer =
        insurerFilter === 'ALL' || (p.insurerName || '').toLowerCase() === insurerFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesInsurer;
    });
  }, [rawPolicies, debouncedSearch, statusFilter, insurerFilter]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalPolicies = filteredPolicies.length;
    let totalNetPremium = 0;
    let totalGst = 0;
    let totalNetPayable = 0;
    let totalDiscounts = 0;

    filteredPolicies.forEach((p) => {
      const net = Number(p.netPremium ?? p.premiumAmount ?? 0);
      const gst = Number(p.gstAmount ?? 0);
      const payable = Number(p.netPayable ?? p.totalPremium ?? (net + gst));
      const disc = Number(p.discountAmount ?? 0);

      totalNetPremium += net;
      totalGst += gst;
      totalNetPayable += payable;
      totalDiscounts += disc;
    });

    return {
      totalPolicies,
      totalNetPremium,
      totalGst,
      totalNetPayable,
      totalDiscounts,
    };
  }, [filteredPolicies]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatINR = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatNumber = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Native Excel (.xlsx) Export for Auditor Compliance
  const exportToExcel = () => {
    if (filteredPolicies.length === 0) {
      toast.error('No policies to export');
      return;
    }

    try {
      const data = filteredPolicies.map((p) => ({
        'Policy Number': p.policyNumber || '',
        'Quotation Code': p.quotationCode || '',
        'Quotation ID': p.quotationId || '',
        'Status': p.status || '',
        'Customer Name': p.customerName || p.contactName || '',
        'Customer Phone': p.contactPhone || '',
        'Vehicle Reg Number': p.vehicle?.registrationNumber || '',
        'Vehicle Make & Model': p.vehicle?.makeModel || '',
        'Insurer': p.insurerName || '',
        'Policy Type': p.policyType || p.productLine || '',
        'OD Premium (INR)': Number(p.odPremium ?? 0),
        'TP Premium (INR)': Number(p.tpPremium ?? 0),
        'Addon Premium (INR)': Number(p.addonPremium ?? 0),
        'Discount Amount (INR)': Number(p.discountAmount ?? 0),
        'NCB (%)': Number(p.ncbPercentage ?? 0),
        'Net Premium (INR)': Number(p.netPremium ?? p.premiumAmount ?? 0),
        'GST Amount (INR)': Number(p.gstAmount ?? 0),
        'Net Payable / Total Premium (INR)': Number(p.netPayable ?? p.totalPremium ?? 0),
        'Payment Status': p.paymentStatus || '',
        'Issue / Start Date': p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '',
        'Expiry Date': p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 22 }, // Policy Number
        { wch: 20 }, // Quotation Code
        { wch: 38 }, // Quotation ID
        { wch: 12 }, // Status
        { wch: 24 }, // Customer Name
        { wch: 15 }, // Customer Phone
        { wch: 18 }, // Vehicle Reg Number
        { wch: 25 }, // Vehicle Make & Model
        { wch: 20 }, // Insurer
        { wch: 18 }, // Policy Type
        { wch: 16 }, // OD Premium
        { wch: 16 }, // TP Premium
        { wch: 18 }, // Addon Premium
        { wch: 18 }, // Discount Amount
        { wch: 10 }, // NCB %
        { wch: 18 }, // Net Premium
        { wch: 16 }, // GST Amount
        { wch: 24 }, // Net Payable / Total Premium
        { wch: 14 }, // Payment Status
        { wch: 16 }, // Issue / Start Date
        { wch: 16 }, // Expiry Date
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Policy Audit Report');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Policy_Audit_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Audit report exported to Excel (.xlsx) successfully');
    } catch (err) {
      console.error('Failed to export to Excel', err);
      toast.error('Failed to export to Excel');
    }
  };

  // Unauthorized Access State
  if (!authLoading && !isAdmin) {
    return (
      <AppShell activeWorkspace="ADMIN">
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
          <div className="p-4 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-inner">
            <ShieldAlert className="h-10 w-10 animate-bounce" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Admin Access Required</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Policy Financial Audit Report is strictly restricted to authorized platform administrators. You do not have permission to inspect underwriting ledgers.
            </p>
          </div>
          <Link
            href="/policies"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition"
          >
            Return to Policies
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeWorkspace="ADMIN">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> Policy Financial Audit Report
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Admin Confidential
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive underwriting ledger, quotation-to-policy reconciliation, and premium component breakdown (Net, OD, TP, Addons, Discounts, GST & Net Payable).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isRefetching || policiesLoading}
              className="p-2 rounded-xl border bg-card hover:bg-accent text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              title="Refresh audit data"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={exportToExcel}
              disabled={filteredPolicies.length === 0}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Audit Navigation Tabs */}
        <div className="flex border-b border-border space-x-6 text-xs font-semibold">
          <Link
            href="/admin/audit"
            className="pb-2.5 border-b-2 border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <FileCode className="h-4 w-4" />
            <span>System Audit Trail</span>
          </Link>
          <Link
            href="/admin/audit-reports"
            className="pb-2.5 border-b-2 border-primary text-primary flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Policy Audit Report</span>
          </Link>
        </div>

        {/* KPI Financial Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm space-y-1 hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase tracking-wider">Audited Policies</span>
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-xl font-extrabold text-foreground tracking-tight">
              {kpis.totalPolicies.toLocaleString('en-IN')}
            </div>
            <p className="text-[10px] text-muted-foreground">Matching active filters</p>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm space-y-1 hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase tracking-wider">Net Premium</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatNumber(kpis.totalNetPremium)}
            </div>
            <p className="text-[10px] text-muted-foreground">Pure taxable risk base</p>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm space-y-1 hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase tracking-wider">GST Collected</span>
              <Percent className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
              {formatNumber(kpis.totalGst)}
            </div>
            <p className="text-[10px] text-muted-foreground">Statutory 18% tax liability</p>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm space-y-1 hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Net Payable</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl font-extrabold text-primary tracking-tight">
              {formatNumber(kpis.totalNetPayable)}
            </div>
            <p className="text-[10px] text-muted-foreground">Gross Written Premium (GWP)</p>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm space-y-1 hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Saved</span>
              <ShieldCheck className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
              {formatNumber(kpis.totalDiscounts)}
            </div>
            <p className="text-[10px] text-muted-foreground">NCB & commercial discounts</p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card p-3 rounded-2xl border shadow-sm text-xs">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Policy #, Quote #, Customer Name, Vehicle Reg (KA...), or Insurer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ISSUED">Issued</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Insurer Filter */}
            <select
              value={insurerFilter}
              onChange={(e) => setInsurerFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm max-w-[180px] truncate"
            >
              <option value="ALL">All Insurers</option>
              {insurerOptions.map((ins) => (
                <option key={ins} value={ins}>
                  {ins}
                </option>
              ))}
            </select>

            {(searchQuery || statusFilter !== 'ALL' || insurerFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setInsurerFilter('ALL');
                }}
                className="px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 font-semibold"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Audit Ledger Table */}
        <div className="border rounded-2xl overflow-hidden bg-card text-xs shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase tracking-wider">
                  <th className="p-3">Policy Info</th>
                  <th className="p-3">Quotation Code</th>
                  <th className="p-3">Customer & Vehicle</th>
                  <th className="p-3">Insurer & Type</th>
                  <th className="p-3 text-right">OD (₹)</th>
                  <th className="p-3 text-right">TP (₹)</th>
                  <th className="p-3 text-right">Discount (₹)</th>
                  <th className="p-3 text-right bg-primary/5 text-primary">Net Premium (₹)</th>
                  <th className="p-3 text-right">GST (18%)</th>
                  <th className="p-3 text-right font-black">Net Payable (₹)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {policiesLoading ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="font-semibold text-xs">Loading policy audit ledger...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="h-8 w-8 text-muted-foreground/40" />
                        <span className="font-semibold text-sm">No policy audit records found</span>
                        <p className="text-[11px] text-muted-foreground">
                          Try adjusting your search query or filter options above.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPolicies.map((p) => {
                    const statusClass =
                      p.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : p.status === 'ISSUED'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : p.status === 'CANCELLED'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            : 'bg-muted text-muted-foreground border-border';

                    const net = Number(p.netPremium ?? p.premiumAmount ?? 0);
                    const od = Number(p.odPremium ?? 0);
                    const tp = Number(p.tpPremium ?? 0);
                    const disc = Number(p.discountAmount ?? 0);
                    const gst = Number(p.gstAmount ?? 0);
                    const payable = Number(p.netPayable ?? p.totalPremium ?? (net + gst));

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-accent/40 transition cursor-pointer group"
                        onClick={() => setSelectedPolicy(p)}
                      >
                        {/* Policy Info */}
                        <td className="p-3">
                          <div className="font-mono font-bold text-foreground text-xs flex items-center gap-1.5">
                            <span>{p.policyNumber}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(p.policyNumber, p.id);
                              }}
                              className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition"
                              title="Copy Policy Number"
                            >
                              {copiedId === p.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${statusClass}`}>
                              {p.status || 'ACTIVE'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {p.startDate ? new Date(p.startDate).toLocaleDateString('en-IN') : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Quotation Code */}
                        <td className="p-3">
                          {p.quotationCode ? (
                            <div className="font-mono font-semibold text-primary text-[11px] flex items-center gap-1">
                              <span>{p.quotationCode}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">No Quote Code</span>
                          )}
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                            {p.quotationId ? `${p.quotationId.slice(0, 8)}...` : '—'}
                          </div>
                        </td>

                        {/* Customer & Vehicle */}
                        <td className="p-3">
                          <div className="font-bold text-foreground truncate max-w-[160px]">
                            {p.customerName || p.contactName || '—'}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {p.vehicle?.registrationNumber && (
                              <span className="font-mono font-bold px-1 rounded bg-muted text-foreground">
                                {p.vehicle.registrationNumber}
                              </span>
                            )}
                            <span className="truncate max-w-[120px]">{p.vehicle?.makeModel || ''}</span>
                          </div>
                        </td>

                        {/* Insurer & Type */}
                        <td className="p-3">
                          <div className="font-semibold text-foreground truncate max-w-[130px]">
                            {p.insurerName || '—'}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase font-mono">
                            {p.policyType || p.productLine || 'MOTOR'}
                          </div>
                        </td>

                        {/* OD Premium */}
                        <td className="p-3 text-right font-mono text-[11px] text-muted-foreground">
                          {od > 0 ? (
                            formatNumber(od)
                          ) : p.policyType === 'TP_ONLY' || (p as any).productLine?.includes('TP') ? (
                            <span className="text-[10px] text-muted-foreground/60 italic" title="Third Party Only policy — no OD cover">
                              ₹0.00 <span className="text-[9px]">(TP Only)</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* TP Premium */}
                        <td className="p-3 text-right font-mono text-[11px] text-muted-foreground">
                          {tp > 0 ? formatNumber(tp) : '—'}
                        </td>

                        {/* Discount */}
                        <td className="p-3 text-right">
                          <div className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                            {disc > 0 ? `-${formatNumber(disc)}` : '₹0.00'}
                          </div>
                          {p.ncbPercentage && p.ncbPercentage > 0 ? (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1 rounded">
                              NCB {p.ncbPercentage}%
                            </span>
                          ) : null}
                        </td>

                        {/* Net Premium */}
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-primary/5 text-xs">
                          {formatNumber(net)}
                        </td>

                        {/* GST */}
                        <td className="p-3 text-right font-mono text-[11px] text-muted-foreground">
                          {formatNumber(gst)}
                        </td>

                        {/* Net Payable */}
                        <td className="p-3 text-right">
                          <div className="font-mono font-extrabold text-foreground text-xs">
                            {formatNumber(payable)}
                          </div>
                          <div className="text-[9px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{p.paymentStatus || 'PAID'}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedPolicy(p)}
                            className="px-2.5 py-1 rounded-lg border bg-background hover:bg-accent font-semibold text-[10px] inline-flex items-center gap-1 text-primary shadow-xs transition"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Policy Audit Dossier Modal */}
        {selectedPolicy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-4xl bg-card border rounded-3xl shadow-2xl p-6 space-y-6 text-xs max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" /> Policy Audit Dossier
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {selectedPolicy.policyNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Authoritative financial ledger & underwriting reconciliation record.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="p-1.5 rounded-xl border bg-background text-muted-foreground hover:bg-accent transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Dossier Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Policy & Quotation Metadata */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Policy & Quotation Identifiers
                  </span>
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Policy Number:</span>
                      <span className="font-mono font-bold text-foreground">{selectedPolicy.policyNumber}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Quotation Code:</span>
                      <span className="font-mono font-bold text-primary">{selectedPolicy.quotationCode || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Policy UUID:</span>
                      <span className="font-mono text-[10px] text-muted-foreground break-all">{selectedPolicy.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Quotation UUID:</span>
                      <span className="font-mono text-[10px] text-muted-foreground break-all">{selectedPolicy.quotationId || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Customer & Contact Details */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-blue-500" /> Customer & Insured
                  </span>
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Customer / Proposer:</span>
                      <span className="font-bold text-foreground">{selectedPolicy.customerName || selectedPolicy.contactName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Contact Mobile:</span>
                      <span className="font-mono text-foreground">{selectedPolicy.contactPhone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Contact Email:</span>
                      <span className="text-muted-foreground">{selectedPolicy.contactEmail || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Payment Status:</span>
                      <span className="font-bold text-emerald-600">{selectedPolicy.paymentStatus || 'PAID'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Vehicle & Coverage Details */}
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-indigo-500" /> Vehicle & Product
                  </span>
                  <div className="space-y-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Vehicle Registration:</span>
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-card border text-foreground">
                        {selectedPolicy.vehicle?.registrationNumber || 'NEW VEHICLE'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Make & Model:</span>
                      <span className="font-semibold text-foreground">{selectedPolicy.vehicle?.makeModel || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Partner Insurer:</span>
                      <span className="font-bold text-primary">{selectedPolicy.insurerName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Policy Type:</span>
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                        {selectedPolicy.policyType || selectedPolicy.productLine || 'MOTOR'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete Financial Waterfall Breakdown */}
              <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" /> Complete Financial Waterfall Breakdown
                  </span>
                  <span className="text-[10px] text-muted-foreground">All figures in INR (₹)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl border bg-muted/10 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Own Damage (OD):</span>
                    <span className="text-sm font-mono font-bold text-foreground">
                      {formatNumber(selectedPolicy.odPremium)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border bg-muted/10 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Third Party (TP):</span>
                    <span className="text-sm font-mono font-bold text-foreground">
                      {formatNumber(selectedPolicy.tpPremium)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border bg-muted/10 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Add-ons Premium:</span>
                    <span className="text-sm font-mono font-bold text-foreground">
                      {formatNumber(selectedPolicy.addonPremium)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border bg-amber-500/5 border-amber-500/20 space-y-1">
                    <span className="text-[10px] text-amber-600 block">Total Discounts (NCB):</span>
                    <span className="text-sm font-mono font-bold text-amber-600">
                      -{formatNumber(selectedPolicy.discountAmount)}
                    </span>
                  </div>
                </div>

                {/* Final Reconciled Summary */}
                <div className="pt-3 border-t grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
                      Net Premium (Taxable Base)
                    </span>
                    <span className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(selectedPolicy.netPremium ?? selectedPolicy.premiumAmount)}
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">Pre-tax risk underwriting base</span>
                  </div>

                  <div className="p-3 rounded-xl border bg-indigo-500/5 border-indigo-500/20">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block uppercase">
                      GST (18% Statutory Tax)
                    </span>
                    <span className="text-lg font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                      {formatNumber(selectedPolicy.gstAmount)}
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">Statutory government tax</span>
                  </div>

                  <div className="p-3 rounded-xl border bg-primary/10 border-primary/30">
                    <span className="text-[10px] font-bold text-primary block uppercase">
                      Net Payable (Total Premium)
                    </span>
                    <span className="text-lg font-mono font-extrabold text-primary">
                      {formatNumber(selectedPolicy.netPayable ?? selectedPolicy.totalPremium)}
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">Authoritative customer payment</span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground font-semibold hover:bg-accent text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

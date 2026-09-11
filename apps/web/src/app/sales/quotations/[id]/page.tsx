'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../../../components/layout/app-shell';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { quotationsRepository } from '../../../../repositories/quotations.repository';
import { toast } from 'sonner';
import {
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  AlertCircle,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function QuotationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quoteId = (params?.id as string) || '';

  // Fetch authoritative quotation data
  const {
    data: quotation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['quotation', quoteId],
    queryFn: () => quotationsRepository.getQuotationById(quoteId),
    enabled: !!quoteId,
  });

  // Fetch real version history from database
  const { data: versions = [] } = useQuery({
    queryKey: ['quotation-versions', quoteId],
    queryFn: () => quotationsRepository.getQuotationVersions(quoteId),
    enabled: !!quoteId,
  });

  const [selectedVersionId, setSelectedVersionId] = useState<string>('');

  // Convert to proposal mutation
  const { mutate: convertToProposal, isPending: isConverting } = useMutation({
    mutationFn: () => quotationsRepository.convertQuotation(quoteId),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', quoteId] });
      const proposalId = result?.proposal?.id || result?.proposalId || result?.id;
      if (proposalId) {
        router.push(`/sales/proposals/${proposalId}`);
      } else {
        router.push('/sales/proposals');
      }
      toast.success('Quotation converted to proposal successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to convert quotation to proposal');
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading quotation details...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !quotation) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-bold text-sm">Quotation Not Found</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                The requested quotation identifier ({quoteId || 'unknown'}) was not found or has been removed.
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const q = quotation as any;
  const leadId = q.leadId;
  const contactName =
    q.contactName ||
    (q.contact ? `${q.contact.firstName || ''} ${q.contact.lastName || ''}`.trim() : 'Customer');
  const agentName = q.createdBy
    ? `${q.createdBy.firstName || ''} ${q.createdBy.lastName || ''}`.trim()
    : 'Unassigned';
  const vehicleReg = q.registrationNumber || q.vehicle?.registrationNumber || '—';
  const vehicleModel = q.vehicle?.makeModel || q.vehicle?.vehicleCode || '—';
  const insurerName = q.insurerName || '—';

  // Sort versions by versionNumber descending
  const sortedVersions = [...(versions as any[])].sort(
    (a, b) => (b.versionNumber || 0) - (a.versionNumber || 0),
  );
  const activeVersion = selectedVersionId
    ? sortedVersions.find((v) => v.id === selectedVersionId)
    : sortedVersions[0];

  const fmt = (v: number | string | undefined | null) =>
    v !== undefined && v !== null && !isNaN(Number(v))
      ? `₹${Number(v).toLocaleString('en-IN')}`
      : '—';

  const canConvert = q.status === 'APPROVED' || q.status === 'ACCEPTED';
  const isMotor = q.productType === 'MOTOR';

  return (
    <AppShell>
      <div className="space-y-6">
        {/* 1. Header & Context */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-extrabold tracking-tight font-mono">
                  {q.quotationCode || q.quotationNumber || quoteId}
                </h1>
                <StatusBadge status={q.status} />
                {q.workflowState && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    {q.workflowState}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1">
                <span>Customer: <strong className="text-foreground">{contactName}</strong></span>
                {vehicleReg !== '—' && (
                  <span>Vehicle: <strong className="text-foreground">{vehicleReg} {vehicleModel !== '—' ? `(${vehicleModel})` : ''}</strong></span>
                )}
                <span>Insurer: <strong className="text-foreground">{insurerName}</strong></span>
                <span>Agent: <strong className="text-foreground">{agentName}</strong></span>
              </div>

              {leadId && (
                <div className="pt-1">
                  <button
                    onClick={() => router.push(`/crm/leads/${leadId}`)}
                    className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                  >
                    ← Back to Lead
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {isMotor ? (
                <button
                  onClick={() => router.push('/workspace/operations')}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <span>Operations Workbench</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : canConvert ? (
                <button
                  onClick={() => convertToProposal()}
                  disabled={isConverting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  {isConverting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  <span>Convert to Proposal</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Key Quotation Financial Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs">
            <div className="p-2.5 rounded-xl bg-muted/20 border">
              <span className="text-muted-foreground uppercase text-[10px] font-bold">Sum Insured (IDV)</span>
              <div className="font-mono font-bold text-sm mt-0.5">{fmt(q.sumInsured || q.idvValue)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/20 border">
              <span className="text-muted-foreground uppercase text-[10px] font-bold">Net Base Premium</span>
              <div className="font-mono font-bold text-sm mt-0.5">{fmt(q.basePremium || q.ownDamagePremium)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/20 border">
              <span className="text-muted-foreground uppercase text-[10px] font-bold">GST Component (18%)</span>
              <div className="font-mono font-bold text-sm mt-0.5">{fmt(q.gstAmount)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-700 dark:text-emerald-400 uppercase text-[10px] font-bold">Total Premium</span>
              <div className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                {fmt(q.totalPremium)}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Real Database-Driven Quotation Versions */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Quotation Version History</h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              {sortedVersions.length} {sortedVersions.length === 1 ? 'version snapshot' : 'version snapshots'} recorded
            </span>
          </div>

          {sortedVersions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Initial draft active. Immutable version snapshots are created automatically upon financial calculation approval.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Version Selector Pills */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs font-bold text-muted-foreground mr-1">Select Version:</span>
                {sortedVersions.map((v: any) => {
                  const isSelected = activeVersion ? activeVersion.id === v.id : false;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersionId(v.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                          : 'bg-background hover:bg-accent text-foreground'
                      }`}
                    >
                      v{v.versionNumber} • {fmt(v.totalPremium)}
                    </button>
                  );
                })}
              </div>

              {/* Premium Evolution Timeline */}
              {sortedVersions.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap text-xs bg-muted/20 p-3 rounded-xl border">
                  <span className="font-bold text-muted-foreground uppercase text-[10px]">Evolution Timeline:</span>
                  {[...sortedVersions].reverse().map((v: any, idx: number, arr: any[]) => {
                    const isLatest = idx === arr.length - 1;
                    return (
                      <React.Fragment key={v.id}>
                        <span
                          className={
                            isLatest
                              ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20'
                              : 'line-through text-muted-foreground font-mono'
                          }
                        >
                          v{v.versionNumber}: {fmt(v.totalPremium)}
                        </span>
                        {!isLatest && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Active Version Snapshot Details */}
              {activeVersion && (
                <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs border-b pb-2">
                    <span className="font-bold text-primary">
                      Snapshot Details — Version {activeVersion.versionNumber}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Created: {new Date(activeVersion.createdAt).toLocaleString('en-IN')}
                      {activeVersion.createdBy ? ` by ${activeVersion.createdBy.firstName} ${activeVersion.createdBy.lastName}` : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Sum Insured</span>
                      <div className="font-mono font-bold mt-0.5">{fmt(activeVersion.sumInsured)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Base Premium</span>
                      <div className="font-mono font-bold mt-0.5">{fmt(activeVersion.basePremium)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Discount</span>
                      <div className="font-mono font-bold text-emerald-600 mt-0.5">-{fmt(activeVersion.discountAmount)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Premium</span>
                      <div className="font-mono font-extrabold text-emerald-600 mt-0.5">{fmt(activeVersion.totalPremium)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Multi-Insurer Premium & Comparison Matrix (Real Database Data) */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Insurer Comparison Matrix
            </h2>
            <span className="text-[11px] text-muted-foreground">1 Authoritative Quote Available</span>
          </div>

          {/* Stored Insurer Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/30 border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 font-bold">Insurer Name</th>
                  <th className="p-3 font-bold">Policy Type</th>
                  <th className="p-3 font-bold">Base Premium</th>
                  <th className="p-3 font-bold">NCB ({q.ncbPercentage ?? 0}%)</th>
                  <th className="p-3 font-bold">GST (18%)</th>
                  <th className="p-3 font-bold">Total Premium</th>
                  <th className="p-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-emerald-500/5 font-semibold">
                  <td className="p-3">
                    <div className="font-bold text-foreground">{insurerName}</div>
                    <span className="text-[10px] text-emerald-600 font-bold">Authoritative Stored Quote</span>
                  </td>
                  <td className="p-3 font-mono text-[11px]">{q.policyType || q.productType || 'MOTOR'}</td>
                  <td className="p-3 font-mono">{fmt(q.basePremium || q.ownDamagePremium)}</td>
                  <td className="p-3 font-mono text-emerald-600">-{fmt(q.discountAmount)}</td>
                  <td className="p-3 font-mono text-muted-foreground">{fmt(q.gstAmount)}</td>
                  <td className="p-3 font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                    {fmt(q.totalPremium)}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      BOUND
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Comparison Policy Notice */}
          <div className="text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5 space-y-1">
            <div className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Multi-Insurer Verification Integrity
            </div>
            <p>
              1 actual quotation is bound to this record (<strong>{insurerName}</strong>). Additional insurer comparison data is rendered exclusively when multiple insurer rate cards are provided by insurer gateway integrations. Zero synthetic or simulated tariff estimates are displayed.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

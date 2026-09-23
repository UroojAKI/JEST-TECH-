'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ChunkedFileUploader } from '../../components/upload/chunked-file-uploader';
import { FileText, AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { claimsRepository } from '../../repositories/claims.repository';
import { formatCurrency } from '../../lib/formatters';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

export default function ClaimsPage() {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    policyNumber: '',
    claimantName: '',
    incidentDate: new Date().toISOString().split('T')[0],
    claimAmount: '',
    description: '',
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAuthorizedToReport =
    user?.roles?.includes('BACK_OFFICE') ||
    user?.roles?.includes('ADMIN') ||
    user?.role === 'BACK_OFFICE' ||
    user?.role === 'ADMIN';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['claims-list'],
    queryFn: () => claimsRepository.getClaims(),
  });

  const claims = Array.isArray(data) ? data : (data as any)?.data || [];

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.policyNumber.trim()) {
      toast.error('Policy number or reference is required');
      return;
    }
    if (!formData.description.trim() || formData.description.trim().length < 5) {
      toast.error('Incident description must be at least 5 characters');
      return;
    }
    if (!formData.claimAmount || Number(formData.claimAmount) <= 0) {
      toast.error('Please enter a valid positive claim amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await claimsRepository.reportClaim({
        policyNumber: formData.policyNumber.trim(),
        claimantName: formData.claimantName.trim() || undefined,
        incidentDate: new Date(formData.incidentDate).toISOString(),
        claimAmount: Number(formData.claimAmount),
        description: formData.description.trim(),
      });
      toast.success('Claim reported successfully and registered in Back-Office queue');
      await queryClient.invalidateQueries({ queryKey: ['claims-list'] });
      setIsReportModalOpen(false);
      setFormData({
        policyNumber: '',
        claimantName: '',
        incidentDate: new Date().toISOString().split('T')[0],
        claimAmount: '',
        description: '',
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to report claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      accessorKey: 'claimNumber',
      header: 'Claim Number',
      cell: ({ row }: any) => (
        <button
          onClick={() => setSelectedClaimId(row.original.id)}
          className={`font-mono font-bold text-left hover:underline ${
            selectedClaimId === row.original.id ? 'text-primary font-extrabold' : 'text-foreground'
          }`}
        >
          {row.original.claimNumber}
        </button>
      ),
    },
    {
      accessorKey: 'policyId',
      header: 'Policy Reference',
      cell: ({ row }: any) => (
        <span className="font-mono text-muted-foreground text-xs">
          {row.original.policy?.policyNumber || row.original.policyId || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'contact',
      header: 'Customer / Claimant',
      cell: ({ row }: any) => (
        <span>
          {row.original.contact
            ? `${row.original.contact.firstName || ''} ${row.original.contact.lastName || ''}`.trim()
            : row.original.contactId || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'claimAmount',
      header: 'Claim Amount',
      cell: ({ row }: any) => (
        <span className="font-mono font-bold text-foreground">
          {formatCurrency(row.original.claimAmount)}
        </span>
      ),
    },
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
            <FileText className="h-5 w-5 text-primary" /> Claims Management
          </h1>
          <p className="text-xs text-muted-foreground">Authoritative loss intake, surveyor assignment, and settlement</p>
        </div>

        {isAuthorizedToReport && (
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>+ Report New Claim</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 bg-card border rounded-xl space-x-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading live claims register from database...</span>
            </div>
          ) : isError ? (
            <div className="p-8 bg-destructive/10 border border-destructive/20 rounded-xl text-center space-y-2">
              <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
              <p className="text-xs font-semibold text-destructive">Failed to load claims register.</p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded-lg bg-background border text-xs font-semibold hover:bg-accent"
              >
                Retry
              </button>
            </div>
          ) : claims.length === 0 ? (
            <div className="p-12 bg-card border rounded-xl text-center space-y-2">
              <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No Claims Registered</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No active or historical insurance claims currently recorded in the repository.
              </p>
            </div>
          ) : (
            <EnterpriseTable data={claims} columns={columns} />
          )}
        </div>

        <div className="space-y-4 bg-card border p-4 rounded-xl h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Claim Document Vault
          </h3>
          {selectedClaimId ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Uploading evidence for Claim ID: <span className="font-mono font-bold text-foreground">{selectedClaimId}</span>
              </p>
              <ChunkedFileUploader entityType="CLAIM" entityId={selectedClaimId} />
            </div>
          ) : (
            <div className="p-6 border border-dashed rounded-lg text-center space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Select a claim row to view or upload supporting documents
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report New Claim Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 font-bold text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span>Report New Claim</span>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="p-4 space-y-4">
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Policy Number / Reference <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. POL-2026-000001"
                  value={formData.policyNumber}
                  onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Claimant Name
                </label>
                <input
                  type="text"
                  placeholder="Full name of claimant or insured"
                  value={formData.claimantName}
                  onChange={(e) => setFormData({ ...formData, claimantName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Incident Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.incidentDate}
                    onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Estimated Loss (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 25000"
                    value={formData.claimAmount}
                    onChange={(e) => setFormData({ ...formData, claimAmount: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Incident Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide circumstances of the loss, location, and preliminary damage assessment..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-background text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Reporting...' : 'Submit Claim'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

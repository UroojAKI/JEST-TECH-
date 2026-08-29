'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ChunkedFileUploader } from '../../components/upload/chunked-file-uploader';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';
import { claimsRepository } from '../../repositories/claims.repository';
import { formatCurrency } from '../../lib/formatters';

export default function ClaimsPage() {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['claims-list'],
    queryFn: () => claimsRepository.getClaims(),
  });

  const claims = Array.isArray(data) ? data : (data as any)?.data || [];

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
    </AppShell>
  );
}

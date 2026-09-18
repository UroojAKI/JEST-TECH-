'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../../components/layout/app-shell';
import { ShieldAlert, Plus, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

const CLAIM_STAGES = [
  '1. Intimated',
  '2. Surveyor Assigned',
  '3. Inspection Done',
  '4. Approved',
  '5. Settled',
];

function getStageIndex(status: string): number {
  switch (status?.toUpperCase()) {
    case 'REPORTED':
    case 'INTIMATED':
      return 0;
    case 'SURVEYOR_ASSIGNED':
      return 1;
    case 'INSPECTED':
      return 2;
    case 'APPROVED':
      return 3;
    case 'SETTLED':
      return 4;
    case 'REJECTED':
    case 'CLOSED':
      return -1;
    default:
      return 0;
  }
}

export default function AgentClaimsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    policyNumber: '',
    customerName: '',
    claimAmount: '',
    description: '',
  });

  const { data: claimsResponse, isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: async () => {
      const res = await apiClient.get('/claims');
      return res.data;
    },
  });

  const claims = Array.isArray(claimsResponse?.data)
    ? claimsResponse.data
    : Array.isArray(claimsResponse)
      ? claimsResponse
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.policyNumber || !form.customerName || !form.claimAmount) {
      toast.error('Policy Number, Claimant Name, and Estimated Amount are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/claims', {
        policyNumber: form.policyNumber.trim(),
        claimantName: form.customerName.trim(),
        estimatedAmount: parseFloat(form.claimAmount),
        description: form.description || 'Customer intimated claim',
      });
      const claimRef: string =
        response.data?.claimNumber ??
        response.data?.referenceNumber ??
        response.data?.id ??
        'Registered';
      setIsModalOpen(false);
      toast.success(
        `Claim ${claimRef} intimated successfully for ${form.customerName}!`,
      );
      setForm({
        policyNumber: '',
        customerName: '',
        claimAmount: '',
        description: '',
      });
      await queryClient.invalidateQueries({ queryKey: ['claims'] });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to register claim. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 text-xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" /> Customer Claims Follow-up Workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Register customer claims, inspect surveyor assignment, and track real-time settlement status
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>+ Intimate New Claim</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <span>Loading claims records...</span>
          </div>
        ) : claims.length === 0 ? (
          <div className="p-12 rounded-2xl border bg-card text-center space-y-3">
            <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto" />
            <h3 className="font-bold text-sm text-foreground">No Claims Intimations Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              There are currently no active claims recorded under your workspace. Click &ldquo;+ Intimate New Claim&rdquo; to register a claim for a customer policy.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim: any) => {
              const currentStage = getStageIndex(claim.status);
              const isRejected = claim.status?.toUpperCase() === 'REJECTED';
              return (
                <div key={claim.id || claim.claimNumber} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary text-sm">
                        {claim.claimNumber || claim.id?.substring(0, 8)}
                      </span>
                      {claim.incidentDate && (
                        <span className="text-[10px] text-muted-foreground">
                          Incident: {new Date(claim.incidentDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      isRejected
                        ? 'bg-red-500/10 text-red-600'
                        : claim.status === 'SETTLED'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {claim.status?.replace(/_/g, ' ') || 'INTIMATED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Claimant / Customer</span>
                      <strong className="text-foreground">{claim.claimantName || claim.customerName || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Policy Number</span>
                      <strong className="font-mono">{claim.policyNumber || claim.policy?.policyNumber || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Estimated Loss Amount</span>
                      <strong className="text-emerald-600 font-mono">
                        ₹{Number(claim.estimatedAmount || claim.claimAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Surveyor</span>
                      <strong>{claim.surveyorName || 'Pending Assignment'}</strong>
                    </div>
                  </div>

                  {claim.description && (
                    <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-muted/30">
                      <span className="font-semibold text-foreground">Loss Summary: </span>
                      {claim.description}
                    </div>
                  )}

                  {!isRejected && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="font-bold text-[10px] uppercase text-muted-foreground">Settlement Workflow Progress</h4>
                      <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                        {CLAIM_STAGES.map((st, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border font-bold ${
                              idx <= currentStage
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-muted/10 text-muted-foreground border-transparent'
                            }`}
                          >
                            {st}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Intimate Claim Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
              <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" /> Register Customer Claim Intimation
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Policy Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. POL-2026-0001"
                    value={form.policyNumber}
                    onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Customer / Claimant Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Estimated Claim Loss Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 75000"
                    value={form.claimAmount}
                    onChange={(e) => setForm({ ...form, claimAmount: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Incident Details & Loss Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe accident or damage incident..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                  />
                </div>
                <div className="pt-3 flex justify-end space-x-2 border-t mt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border bg-background font-semibold hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow flex items-center space-x-1"
                  >
                    {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    <span>{isSubmitting ? 'Registering...' : 'Register Claim'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

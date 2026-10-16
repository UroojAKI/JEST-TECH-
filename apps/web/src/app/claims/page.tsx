'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ChunkedFileUploader } from '../../components/upload/chunked-file-uploader';
import { FileText, AlertCircle, Loader2, Plus, X, UserCheck, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
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

  // Action states
  const [isSurveyorModalOpen, setIsSurveyorModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [surveyorForm, setSurveyorForm] = useState({
    surveyorName: '',
    surveyorDetails: '',
  });

  const [approveForm, setApproveForm] = useState({
    approvedAmount: '',
    comments: '',
  });

  const [rejectForm, setRejectForm] = useState({
    reason: '',
    comments: '',
  });

  const [settleForm, setSettleForm] = useState({
    settlementAmount: '',
    paymentReference: '',
    paymentMethod: 'NEFT',
    bankName: '',
    comments: '',
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const claimId = new URLSearchParams(window.location.search).get('claimId');
    if (claimId) setSelectedClaimId(claimId);
  }, []);

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
  const selectedClaim = claims.find((claim: any) => claim.id === selectedClaimId);

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

  const handleAssignSurveyor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimId) return;
    if (!surveyorForm.surveyorName.trim()) {
      toast.error('Surveyor name is required');
      return;
    }
    setActionLoading(true);
    try {
      await claimsRepository.updateClaim(selectedClaimId, {
        surveyorName: surveyorForm.surveyorName.trim(),
        surveyorDetails: surveyorForm.surveyorDetails.trim() || undefined,
      });
      toast.success('Surveyor assigned successfully');
      await queryClient.invalidateQueries({ queryKey: ['claims-list'] });
      setIsSurveyorModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to assign surveyor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimId) return;
    const amount = Number(approveForm.approvedAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid positive approved amount');
      return;
    }
    setActionLoading(true);
    try {
      await claimsRepository.approveClaim(selectedClaimId, {
        approvedAmount: amount,
        comments: approveForm.comments.trim() || undefined,
      });
      toast.success('Claim approved successfully');
      await queryClient.invalidateQueries({ queryKey: ['claims-list'] });
      setIsApproveModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to approve claim');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimId) return;
    if (!rejectForm.reason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      await claimsRepository.rejectClaim(selectedClaimId, {
        reason: rejectForm.reason.trim(),
        comments: rejectForm.comments.trim() || undefined,
      });
      toast.success('Claim rejected');
      await queryClient.invalidateQueries({ queryKey: ['claims-list'] });
      setIsRejectModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to reject claim');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimId) return;
    const amount = Number(settleForm.settlementAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid positive settlement amount');
      return;
    }
    if (!settleForm.paymentReference.trim()) {
      toast.error('Payment reference is required');
      return;
    }
    setActionLoading(true);
    try {
      await claimsRepository.settleClaim(selectedClaimId, {
        settlementAmount: amount,
        paymentReference: settleForm.paymentReference.trim(),
        paymentMethod: settleForm.paymentMethod,
        bankName: settleForm.bankName.trim() || undefined,
        comments: settleForm.comments.trim() || undefined,
      });
      toast.success('Claim settlement disbursed successfully');
      await queryClient.invalidateQueries({ queryKey: ['claims-list'] });
      setIsSettleModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to settle claim');
    } finally {
      setActionLoading(false);
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
      cell: ({ row }: any) => row.original.policy?.id ? (
        <Link href={`/policies/${row.original.policy.id}`} className="font-mono text-primary text-xs hover:underline">
          {row.original.policy.policyNumber || 'Policy'}
        </Link>
      ) : (
        <span className="font-mono text-muted-foreground text-xs">{row.original.policyId || '—'}</span>
      ),
    },
    {
      accessorKey: 'contact',
      header: 'Customer / Claimant',
      cell: ({ row }: any) => row.original.contact?.id ? (
        <Link href={`/crm/contacts/${row.original.contact.id}`} className="hover:text-primary hover:underline">
          {`${row.original.contact.firstName || ''} ${row.original.contact.lastName || ''}`.trim()}
        </Link>
      ) : <span>{row.original.contactId || '—'}</span>,
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
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Claim Action & Evidence Vault
            </h3>
            {selectedClaim && (
              <button
                onClick={() => setSelectedClaimId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {selectedClaim ? (
            <div className="space-y-4">
              {/* Claim Overview Header */}
              <div className="p-3 bg-muted/20 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-sm text-foreground">
                    {selectedClaim.claimNumber}
                  </span>
                  <StatusBadge status={selectedClaim.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Claimed</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(selectedClaim.claimAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Approved / Settle</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {selectedClaim.approvedAmount ? formatCurrency(selectedClaim.approvedAmount) : '—'}
                    </span>
                  </div>
                </div>
                {selectedClaim.surveyorName && (
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Surveyor: </span>
                    {selectedClaim.surveyorName}
                    {selectedClaim.surveyorDetails ? ` (${selectedClaim.surveyorDetails})` : ''}
                  </div>
                )}
                {selectedClaim.description && (
                  <p className="text-[11px] text-muted-foreground italic border-t pt-1">
                    "{selectedClaim.description}"
                  </p>
                )}
              </div>

              {/* Action Buttons (Back Office / Admin) */}
              {isAuthorizedToReport && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Workflow Actions
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSurveyorForm({
                          surveyorName: selectedClaim.surveyorName || '',
                          surveyorDetails: selectedClaim.surveyorDetails || '',
                        });
                        setIsSurveyorModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-accent text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                      <span>Surveyor</span>
                    </button>

                    {selectedClaim.status !== 'APPROVED' &&
                      selectedClaim.status !== 'SETTLED' &&
                      selectedClaim.status !== 'PAID' &&
                      selectedClaim.status !== 'REJECTED' &&
                      selectedClaim.status !== 'CLOSED' && (
                        <button
                          onClick={() => {
                            setApproveForm({
                              approvedAmount: String(selectedClaim.approvedAmount || selectedClaim.claimAmount || ''),
                              comments: '',
                            });
                            setIsApproveModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                    {selectedClaim.status !== 'SETTLED' &&
                      selectedClaim.status !== 'PAID' &&
                      selectedClaim.status !== 'REJECTED' &&
                      selectedClaim.status !== 'CLOSED' && (
                        <button
                          onClick={() => {
                            setRejectForm({ reason: '', comments: '' });
                            setIsRejectModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      )}

                    {(selectedClaim.status === 'APPROVED' ||
                      selectedClaim.status === 'ASSESSMENT_COMPLETE') && (
                      <button
                        onClick={() => {
                          setSettleForm({
                            settlementAmount: String(selectedClaim.approvedAmount || selectedClaim.claimAmount || ''),
                            paymentReference: `SETTLE-${Date.now().toString().slice(-6)}`,
                            paymentMethod: 'NEFT',
                            bankName: '',
                            comments: '',
                          });
                          setIsSettleModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs col-span-2"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Disburse Settlement</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Document Vault */}
              <div className="pt-2 border-t space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Evidence & Proof Uploads
                </span>
                <ChunkedFileUploader entityType="CLAIM" entityId={selectedClaim.id} />
              </div>
            </div>
          ) : (
            <div className="p-6 border border-dashed rounded-lg text-center space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Select a claim row to view details, assign surveyors, approve, or disburse settlement
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

      {/* Assign Surveyor Modal */}
      {isSurveyorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 font-bold text-sm">
                <UserCheck className="h-4 w-4 text-blue-500" />
                <span>Assign / Update Loss Assessor</span>
              </div>
              <button
                onClick={() => setIsSurveyorModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAssignSurveyor} className="p-4 space-y-4">
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Surveyor / Assessor Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={surveyorForm.surveyorName}
                  onChange={(e) =>
                    setSurveyorForm({ ...surveyorForm, surveyorName: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Surveyor Contact / License / Agency Details
                </label>
                <textarea
                  rows={2}
                  placeholder="License number, agency, phone number or remarks..."
                  value={surveyorForm.surveyorDetails}
                  onChange={(e) =>
                    setSurveyorForm({ ...surveyorForm, surveyorDetails: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSurveyorModalOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-background text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Saving...' : 'Assign Surveyor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Claim Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Approve Claim for Settlement</span>
              </div>
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleApproveClaim} className="p-4 space-y-4">
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Approved Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 20000"
                  value={approveForm.approvedAmount}
                  onChange={(e) =>
                    setApproveForm({ ...approveForm, approvedAmount: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Underwriter / Approval Comments
                </label>
                <textarea
                  rows={2}
                  placeholder="Assessment basis, deductible deductions, or approval remarks..."
                  value={approveForm.comments}
                  onChange={(e) =>
                    setApproveForm({ ...approveForm, comments: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-background text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Approving...' : 'Confirm Approval'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Claim Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 font-bold text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Reject Insurance Claim</span>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRejectClaim} className="p-4 space-y-4">
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Damage not covered under policy policy terms"
                  value={rejectForm.reason}
                  onChange={(e) =>
                    setRejectForm({ ...rejectForm, reason: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Additional Underwriting Comments
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed justification to be logged in claim audit trail..."
                  value={rejectForm.comments}
                  onChange={(e) =>
                    setRejectForm({ ...rejectForm, comments: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-background text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Rejecting...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Claim Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 font-bold text-sm text-primary">
                <CreditCard className="h-4 w-4" />
                <span>Disburse Claim Settlement</span>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSettleClaim} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Disbursed Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 20000"
                    value={settleForm.settlementAmount}
                    onChange={(e) =>
                      setSettleForm({ ...settleForm, settlementAmount: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={settleForm.paymentMethod}
                    onChange={(e) =>
                      setSettleForm({ ...settleForm, paymentMethod: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Payment Reference / UTR <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UTR1234567890"
                    value={settleForm.paymentReference}
                    onChange={(e) =>
                      setSettleForm({ ...settleForm, paymentReference: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground text-xs block mb-1">
                    Disbursing Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={settleForm.bankName}
                    onChange={(e) =>
                      setSettleForm({ ...settleForm, bankName: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground text-xs block mb-1">
                  Disbursement Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Settlement notes, beneficiary confirmation details..."
                  value={settleForm.comments}
                  onChange={(e) =>
                    setSettleForm({ ...settleForm, comments: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-background text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Disbursing...' : 'Disburse Settlement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

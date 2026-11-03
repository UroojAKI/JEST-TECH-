'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  FileText,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/auth-store';
import { useEndorsements } from '../../hooks/useEndorsements';
import { EndorsementItem } from '../../repositories/endorsements.repository';
import { formatCurrency, formatDate } from '../../lib/formatters';

interface PolicyChangeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: any;
  endorsement?: EndorsementItem | any;
  onSuccess?: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  actualPolicyNumber: 'Policy Number',
  policyNumber: 'Policy Number',
  premiumAmount: 'Total Premium',
  totalPremium: 'Total Premium',
  netPremium: 'Net Premium',
  odPremium: 'Own Damage (OD) Premium',
  tpPremium: 'Third Party (TP) Premium',
  gstAmount: 'GST Amount (18%)',
  startDate: 'Policy Start Date',
  effectiveDate: 'Policy Effective Date',
  endDate: 'Policy Expiry Date',
  expiryDate: 'Policy Expiry Date',
  odStartDate: 'OD Start Date',
  odExpiryDate: 'OD Expiry Date',
  tpStartDate: 'TP Start Date',
  tpExpiryDate: 'TP Expiry Date',
  status: 'Policy Status',
  paymentStatus: 'Payment Status',
  address: 'Customer Address',
  pincode: 'PIN Code',
  pinCode: 'PIN Code',
  city: 'City',
  state: 'State',
  makeModel: 'Vehicle Make & Model',
  registrationNumber: 'Registration Number',
  engineNumber: 'Engine Number',
  chassisNumber: 'Chassis Number',
  notes: 'Underwriting Notes',
  comments: 'Remarks',
};

function formatValue(key: string, value: any): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  // Currency fields
  if (
    key.toLowerCase().includes('premium') ||
    key.toLowerCase().includes('amount') ||
    key === 'gstAmount'
  ) {
    const num = Number(value);
    if (!isNaN(num)) return formatCurrency(num);
  }

  // Date fields
  if (
    key.toLowerCase().includes('date') &&
    typeof value === 'string' &&
    value.includes('-')
  ) {
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return formatDate(d);
    } catch {
      // Fallback to string
    }
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function PolicyChangeReviewModal({
  isOpen,
  onClose,
  policy,
  endorsement: initialEndorsement,
  onSuccess,
}: PolicyChangeReviewModalProps) {
  const authUser = useAuthStore((s) => s.user);
  const {
    approveEndorsementAsync,
    isApproving,
    rejectEndorsementAsync,
    isRejecting,
  } = useEndorsements();

  const [reviewComments, setReviewComments] = useState('');
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // Find the active pending endorsement: either passed as prop or from policy
  const activeEndorsement = useMemo(() => {
    if (initialEndorsement) return initialEndorsement;
    if (Array.isArray(policy?.endorsements) && policy.endorsements.length > 0) {
      return (
        policy.endorsements.find((e: any) =>
          ['REQUESTED', 'UNDER_REVIEW'].includes(e.status),
        ) || policy.endorsements[0]
      );
    }
    return null;
  }, [initialEndorsement, policy]);

  if (!isOpen || !policy) return null;

  // Four-Eye Principle check: Requester cannot approve their own change request
  const currentUserId = authUser?.id || (authUser as any)?.userId;
  const requesterId =
    activeEndorsement?.requestedById ||
    (activeEndorsement?.requestedBy as any)?.id;
  const isSelfRequester = Boolean(
    currentUserId && requesterId && currentUserId === requesterId,
  );

  // Parse snapshots safely
  const parseJson = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  };

  const beforeSnapshot = parseJson(activeEndorsement?.beforeSnapshot);
  const requestedChanges = parseJson(activeEndorsement?.requestedChanges);

  // Collect all unique keys between requested changes and before snapshot
  const comparisonKeys = Array.from(
    new Set([
      ...Object.keys(requestedChanges),
      ...Object.keys(beforeSnapshot),
    ]),
  ).filter((key) => key !== 'reason' && key !== 'version');

  const handleApprove = async () => {
    if (!activeEndorsement?.id) {
      toast.error('No pending change request found to approve.');
      return;
    }

    if (isSelfRequester) {
      toast.error(
        'Four-Eye Principle Violation: You cannot approve your own policy changes.',
      );
      return;
    }

    try {
      await approveEndorsementAsync({
        id: activeEndorsement.id,
        comments: reviewComments.trim() || 'Approved by authorized reviewer',
      });
      toast.success('Policy changes approved and officially updated.');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to approve policy changes.';
      if (
        String(errorMsg).includes('stale') ||
        String(errorMsg).includes('POLICY_CHANGE_STALE_VERSION')
      ) {
        toast.error(
          'Stale Version Conflict: The official policy was modified concurrently. Please refresh the policy and review updated data.',
        );
      } else {
        toast.error(
          Array.isArray(errorMsg) ? errorMsg.join(' | ') : String(errorMsg),
        );
      }
    }
  };

  const handleReject = async () => {
    if (!activeEndorsement?.id) {
      toast.error('No pending change request found to reject.');
      return;
    }

    if (!reviewComments.trim()) {
      setCommentsError('Please provide a reason for rejecting these changes.');
      return;
    }

    setCommentsError(null);

    try {
      await rejectEndorsementAsync({
        id: activeEndorsement.id,
        reason: reviewComments.trim(),
      });
      toast.success(
        'Policy change request rejected. The official policy remains untouched.',
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to reject policy change request.';
      toast.error(
        Array.isArray(errorMsg) ? errorMsg.join(' | ') : String(errorMsg),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Policy Modification Review & Approval
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Review proposed changes before applying them to the official
              policy register.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isApproving || isRejecting}
            className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Policy & Endorsement Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-xl border bg-muted/20 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                Policy Number
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                {policy.policyNumber || policy.id}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">
                Change Request ID
              </span>
              <span className="font-mono font-semibold text-foreground">
                {activeEndorsement?.endorsementNumber ||
                  activeEndorsement?.id?.substring(0, 12) ||
                  'PENDING-CHANGE'}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">
                Base Version
              </span>
              <span className="font-mono font-semibold text-foreground">
                v{activeEndorsement?.baseVersion ?? policy.version ?? 1}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">
                Requested By
              </span>
              <span className="font-medium text-foreground flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                {activeEndorsement?.requestedBy?.firstName
                  ? `${activeEndorsement.requestedBy.firstName} ${activeEndorsement.requestedBy.lastName || ''}`
                  : activeEndorsement?.requestedById || 'CRM User'}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">
                Request Date
              </span>
              <span className="font-mono text-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {activeEndorsement?.createdAt
                  ? formatDate(activeEndorsement.createdAt)
                  : 'Recent'}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">
                Change Category
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase inline-block">
                {activeEndorsement?.type || 'GENERAL_CHANGE'}
              </span>
            </div>
          </div>

          {/* Reason for Change */}
          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
              Reason Stated by Requester
            </span>
            <p className="text-xs text-foreground italic">
              &quot;
              {activeEndorsement?.reason ||
                'User-initiated modification to official policy details'}
              &quot;
            </p>
          </div>

          {/* Four-Eye Principle Warning if User is Requester */}
          {isSelfRequester && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-destructive">
                  Four-Eye Principle Restriction (Segregation of Duties)
                </h4>
                <p className="text-xs text-foreground/90">
                  You requested this policy modification. Under IRDAI compliance
                  and CRM governance standards, you cannot approve your own
                  request. An independent Administrator or Back-Office reviewer
                  must approve these changes.
                </p>
              </div>
            </div>
          )}

          {/* Field-by-Field Before vs After Comparison */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Field-Level Comparison (Before vs. Proposed)
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {comparisonKeys.length} field
                {comparisonKeys.length !== 1 ? 's' : ''} affected
              </span>
            </div>

            {comparisonKeys.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 border-b font-semibold text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3 w-1/3">Field</th>
                      <th className="p-3 w-1/3">Official Policy (Current)</th>
                      <th className="p-3 w-1/3">Proposed (Pending)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {comparisonKeys.map((key) => {
                      const beforeVal = beforeSnapshot[key];
                      const afterVal = requestedChanges[key];
                      const label = FIELD_LABELS[key] || key;
                      const isChanged =
                        JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

                      return (
                        <tr
                          key={key}
                          className={
                            isChanged
                              ? 'bg-amber-500/5 hover:bg-amber-500/10 transition-colors'
                              : 'hover:bg-muted/20'
                          }
                        >
                          <td className="p-3 font-semibold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{label}</span>
                              {isChanged && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                  MODIFIED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {formatValue(key, beforeVal)}
                          </td>
                          <td className="p-3 font-mono font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {isChanged && (
                                <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                              <span
                                className={
                                  isChanged
                                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                    : ''
                                }
                              >
                                {formatValue(key, afterVal)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground rounded-xl border border-dashed text-xs">
                No specific field discrepancies detected between snapshots.
              </div>
            )}
          </div>

          {/* Review Comments / Decision Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Reviewer Comments / Decision Remarks</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Mandatory for rejection
              </span>
            </label>
            <textarea
              value={reviewComments}
              onChange={(e) => {
                setReviewComments(e.target.value);
                if (commentsError) setCommentsError(null);
              }}
              placeholder="Provide context for approval or state the reason if rejecting this change request..."
              rows={3}
              className={`w-full p-3 rounded-xl border bg-background text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none ${
                commentsError ? 'border-destructive ring-1 ring-destructive' : ''
              }`}
              disabled={isApproving || isRejecting}
            />
            {commentsError && (
              <p className="text-[11px] font-semibold text-destructive">
                {commentsError}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApproving || isRejecting}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl border hover:bg-muted text-foreground transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Reject Button */}
            <button
              type="button"
              onClick={handleReject}
              disabled={isApproving || isRejecting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors disabled:opacity-50"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject Changes</span>
                </>
              )}
            </button>

            {/* Approve Button */}
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving || isRejecting || isSelfRequester}
              title={
                isSelfRequester
                  ? 'Four-Eye Principle: Requester cannot approve their own change'
                  : 'Approve and apply changes'
              }
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Approve & Apply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


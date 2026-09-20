'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Camera, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';
import { InspectionForm } from './InspectionForm';
import type { InspectionDetails, InspectionPhotoType } from './motorFormTypes';
import { useAuth } from '../../../hooks/useAuth';

interface Props {
  isOpen: boolean;
  quotationId: string;
  inspectionId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PHOTO_TYPES: InspectionPhotoType[] = [
  'front',
  'back',
  'left',
  'right',
  'windshield',
  'chassis',
  'odometer',
];

export function InspectionDialog({
  isOpen,
  quotationId,
  inspectionId: initialInspectionId,
  onClose,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const userRole = (user as any)?.role || 'AGENT';
  const isBackOfficeOrAdmin = userRole === 'ADMIN' || userRole === 'BACK_OFFICE';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serverInspection, setServerInspection] = useState<any>(null);
  const [inspection, setInspection] = useState<InspectionDetails>({
    photos: {
      front: null,
      back: null,
      left: null,
      right: null,
      windshield: null,
      chassis: null,
      odometer: null,
    },
  });

  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [waiverModalOpen, setWaiverModalOpen] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');

  // Fetch or initialize inspection aggregate from server
  const loadInspection = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/motor/inspections/${quotationId}`);
      if (res.data) {
        setServerInspection(res.data);
      } else {
        // Fallback: create inspection aggregate if absent
        const createRes = await apiClient.post('/motor/inspections', { quotationId });
        setServerInspection(createRes.data);
      }
    } catch (e: any) {
      console.error('Failed to load inspection:', e);
      toast.error(e?.response?.data?.message || 'Failed to load inspection details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && quotationId) {
      loadInspection();
    }
  }, [isOpen, quotationId]);

  if (!isOpen) return null;

  const status = serverInspection?.status || 'REQUIRED';
  const inspectionId = serverInspection?.id || initialInspectionId;

  const uploadedCount = Object.values(inspection.photos).filter(Boolean).length;
  const canSubmitReview = uploadedCount === 7 || serverInspection?.canSubmit;

  // Agent action: Upload 7 photos and call submit-for-review
  const handleSubmitForReview = async () => {
    if (!inspectionId) {
      toast.error('No inspection record found to submit.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Upload any selected photo files
      for (const photoType of PHOTO_TYPES) {
        const file = inspection.photos[photoType];
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('name', `Motor inspection — ${photoType}`);
          formData.append('entityType', 'INSPECTION');
          formData.append('entityId', inspectionId);
          formData.append('category', `MOTOR_INSPECTION_${photoType.toUpperCase()}`);
          formData.append('tags', `motor,inspection,${photoType}`);

          const upload = await apiClient.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const storageKey = upload.data?.storageKey;
          if (!storageKey) throw new Error(`Storage key missing after ${photoType} upload`);

          await apiClient.post(`/motor/inspections/${inspectionId}/photos`, {
            photoType,
            storageKey,
          });
        }
      }

      // 2. Submit for review (transitions IN_PROGRESS -> SUBMITTED_FOR_REVIEW)
      const res = await apiClient.post(`/motor/inspections/${inspectionId}/submit-for-review`, {});
      setServerInspection(res.data);

      toast.success('All 7 photos verified. Inspection submitted for underwriting review!');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to submit inspection for review');
    } finally {
      setIsSaving(false);
    }
  };

  // Back Office / Admin action: Approve
  const handleApprove = async () => {
    if (!inspectionId) return;
    setIsSaving(true);
    try {
      const res = await apiClient.post(`/motor/inspections/${inspectionId}/approve`, {});
      setServerInspection(res.data);
      toast.success('Inspection approved! Issuance gate cleared.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve inspection');
    } finally {
      setIsSaving(false);
    }
  };

  // Back Office / Admin action: Reject
  const handleReject = async () => {
    if (!inspectionId || !rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.post(`/motor/inspections/${inspectionId}/reject`, {
        reason: rejectionReason.trim(),
      });
      setServerInspection(res.data);
      setRejectionModalOpen(false);
      toast.warning('Inspection rejected. Rework requested from agent.');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject inspection');
    } finally {
      setIsSaving(false);
    }
  };

  // Back Office / Admin action: Waive
  const handleWaive = async () => {
    if (!inspectionId || !waiverReason.trim()) {
      toast.error('Waiver reason is required.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiClient.post(`/motor/inspections/${inspectionId}/waive`, {
        reason: waiverReason.trim(),
      });
      setServerInspection(res.data);
      setWaiverModalOpen(false);
      toast.success('Inspection waived by underwriting override.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to waive inspection');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</span>;
      case 'WAIVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20"><FileCheck className="h-3.5 w-3.5" /> Waived</span>;
      case 'SUBMITTED_FOR_REVIEW':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitted for Review</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20"><XCircle className="h-3.5 w-3.5" /> Rework Required</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20"><Camera className="h-3.5 w-3.5" /> In Progress</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20"><AlertTriangle className="h-3.5 w-3.5" /> Inspection Required</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-card rounded-xl border shadow-xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-foreground tracking-tight">
                  Vehicle Inspection
                </h2>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {serverInspection?.inspectionCode
                  ? `Code: ${serverInspection.inspectionCode} • `
                  : ''}
                7 mandatory evidence photographs required for policy issuance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Loading inspection status...</span>
            </div>
          ) : (
            <>
              {status === 'SUBMITTED_FOR_REVIEW' && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-700 dark:text-blue-300">
                  <div className="font-bold mb-1">Inspection Under Review</div>
                  All 7 mandatory photos have been submitted. An Underwriting or Back-Office officer must sign off or approve before policy issuance.
                </div>
              )}

              {status === 'REJECTED' && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300">
                  <div className="font-bold mb-1">Inspection Rejected / Rework Requested</div>
                  Reason: {serverInspection?.rejectionReason || 'Photos unclear or invalid'}. Please re-upload the required photos and submit again.
                </div>
              )}

              {status === 'COMPLETED' && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Inspection sign-off is complete. You may now proceed with policy issuance.</span>
                </div>
              )}

              {status === 'WAIVED' && (
                <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <FileCheck className="h-4 w-4 shrink-0" />
                  <span>Inspection has been waived by underwriter override ({serverInspection?.waiverReason || 'Approved'}).</span>
                </div>
              )}

              {/* Show inspection form if not in completed/waived state */}
              {status !== 'COMPLETED' && status !== 'WAIVED' && (
                <InspectionForm value={inspection} onChange={setInspection} />
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-card flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {uploadedCount}/7 photos selected locally
          </div>

          <div className="flex items-center gap-2">
            {/* Agent Action: Submit for Review */}
            {status !== 'COMPLETED' && status !== 'WAIVED' && status !== 'SUBMITTED_FOR_REVIEW' && (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={!canSubmitReview || isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Submit for Underwriting Review
              </button>
            )}

            {/* Back Office / Admin Actions */}
            {isBackOfficeOrAdmin && status === 'SUBMITTED_FOR_REVIEW' && (
              <>
                <button
                  type="button"
                  onClick={() => setRejectionModalOpen(true)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-medium text-xs"
                >
                  Reject Inspection
                </button>
                <button
                  type="button"
                  onClick={() => setWaiverModalOpen(true)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 font-medium text-xs"
                >
                  Waive Inspection
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-md bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve Inspection
                </button>
              </>
            )}

            {(status === 'COMPLETED' || status === 'WAIVED') && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-card rounded-xl border shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-foreground">Reject Vehicle Inspection</h3>
            <p className="text-xs text-muted-foreground">
              Please specify the rejection reason so the agent knows what evidence to rectify.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Odometer photo is blurry; chassis number is obscured..."
              rows={3}
              className="w-full rounded-md border bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="px-4 py-2 text-xs rounded-md border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isSaving}
                className="px-4 py-2 text-xs rounded-md bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiver Reason Modal */}
      {waiverModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-card rounded-xl border shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-foreground">Underwriting Waiver Override</h3>
            <p className="text-xs text-muted-foreground">
              Provide the underwriting justification for waiving mandatory inspection.
            </p>
            <textarea
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="e.g. Direct renewal with same insurer; underwriter approved waiver..."
              rows={3}
              className="w-full rounded-md border bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWaiverModalOpen(false)}
                className="px-4 py-2 text-xs rounded-md border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWaive}
                disabled={!waiverReason.trim() || isSaving}
                className="px-4 py-2 text-xs rounded-md bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                Confirm Waiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

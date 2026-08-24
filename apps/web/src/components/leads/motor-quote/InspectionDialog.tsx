'use client';

import React, { useState } from 'react';
import { X, Save, Loader2, Camera, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';
import { InspectionForm } from './InspectionForm';
import type { InspectionDetails } from './motorFormTypes';

interface Props {
  isOpen: boolean;
  quotationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InspectionDialog({ isOpen, quotationId, onClose, onSuccess }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [inspection, setInspection] = useState<InspectionDetails>({
    photos: { front: null, back: null, left: null, right: null, windshield: null, chassis: null, odometer: null },
  });

  if (!isOpen) return null;

  const uploadedCount = Object.values(inspection.photos).filter(Boolean).length;
  const canProceed = uploadedCount === 7 && !!inspection.conductedByType;

  const handleSave = async () => {
    if (!canProceed) {
      toast.error('Please complete all fields and upload all 7 photos.');
      return;
    }

    setIsSaving(true);
    try {
      // In a real app, upload photos to S3/MinIO first, get URLs.
      // We simulate creating the inspection record here.
      const res = await apiClient.post('/motor/inspections', {
        quotationId,
        conductedByType: inspection.conductedByType,
        inspectorName: inspection.inspectorName,
        inspectorPhone: inspection.inspectorPhone,
        inspectorCompany: inspection.inspectorCompany,
        inspectionDate: inspection.inspectionDate ? new Date(inspection.inspectionDate).toISOString() : new Date().toISOString(),
      });

      const inspectionId = res.data?.id;

      // Directly complete it for this mock flow
      await apiClient.post(`/motor/inspections/${inspectionId}/complete`, {
        pdfKey: 'mock-key',
        pdfUrl: 'mock-url',
      });

      toast.success('Inspection completed successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit inspection');
    } finally {
      setIsSaving(false);
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
              <h2 className="font-bold text-base text-foreground tracking-tight">Conduct Vehicle Inspection</h2>
              <p className="text-xs text-muted-foreground font-medium">Capture required 7 photos to proceed.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <InspectionForm value={inspection} onChange={setInspection} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-card flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border bg-background font-medium text-sm text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={!canProceed || isSaving}
            className="flex items-center gap-2 px-6 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Submit Inspection
          </button>
        </div>

      </div>
    </div>
  );
}

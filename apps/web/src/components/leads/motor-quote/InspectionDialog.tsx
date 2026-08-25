'use client';

import React, { useState } from 'react';
import { X, Loader2, Camera, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';
import { InspectionForm } from './InspectionForm';
import type { InspectionDetails, InspectionPhotoType } from './motorFormTypes';

interface Props {
  isOpen: boolean;
  quotationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PHOTO_TYPES: InspectionPhotoType[] = ['front', 'back', 'left', 'right', 'windshield', 'chassis', 'odometer'];

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
      const res = await apiClient.post('/motor/inspections', {
        quotationId,
        conductedByType: inspection.conductedByType,
        inspectorName: inspection.inspectorName,
        inspectorPhone: inspection.inspectorPhone,
        inspectorCompany: inspection.inspectorCompany,
        inspectorEmployeeId: inspection.inspectorEmployeeId,
        inspectionDate: inspection.inspectionDate ? new Date(inspection.inspectionDate).toISOString() : new Date().toISOString(),
        inspectionTime: inspection.inspectionTime,
      });

      const inspectionId = res.data?.id;
      if (!inspectionId) throw new Error('Inspection record was not created');

      for (const photoType of PHOTO_TYPES) {
        const file = inspection.photos[photoType];
        if (!file) throw new Error(`Missing ${photoType} photo`);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', `Motor inspection - ${photoType}`);
        formData.append('entityType', 'QUOTATION');
        formData.append('entityId', quotationId);
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

      await apiClient.post(`/motor/inspections/${inspectionId}/complete`, {});

      toast.success('Inspection completed with all 7 evidence photos.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to submit inspection');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-card rounded-xl border shadow-xl flex flex-col max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20"><Camera className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="font-bold text-base text-foreground tracking-tight">Conduct Vehicle Inspection</h2>
              <p className="text-xs text-muted-foreground font-medium">Seven real evidence photos are required before completion.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <InspectionForm value={inspection} onChange={setInspection} />
        </div>

        <div className="px-6 py-4 border-t bg-card flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{uploadedCount}/7 photos selected</div>
          <button type="button" onClick={handleSave} disabled={!canProceed || isSaving} className="flex items-center gap-2 px-6 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Upload Evidence & Complete Inspection
          </button>
        </div>
      </div>
    </div>
  );
}

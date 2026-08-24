'use client';

import React, { useRef } from 'react';
import { Camera, CheckCircle2, Upload, Loader2 } from 'lucide-react';
import type { InspectionDetails, InspectionConductedBy, InspectionPhotoType } from './motorFormTypes';

interface Props {
  value: InspectionDetails;
  onChange: (v: InspectionDetails) => void;
}

const PHOTO_SLOTS: Array<{ type: InspectionPhotoType; label: string; icon: string }> = [
  { type: 'front',       label: 'Front',          icon: '🚗' },
  { type: 'back',        label: 'Back',           icon: '🔙' },
  { type: 'left',        label: 'Left Side',      icon: '◀' },
  { type: 'right',       label: 'Right Side',     icon: '▶' },
  { type: 'windshield',  label: 'Windshield',     icon: '🪟' },
  { type: 'chassis',     label: 'Chassis Number', icon: '🔢' },
  { type: 'odometer',    label: 'Odometer',       icon: '🔘' },
];

const CONDUCTED_BY_OPTIONS: Array<{ value: InspectionConductedBy; label: string }> = [
  { value: 'JEST_TEAM',           label: '🏢 JestPolizy Team' },
  { value: 'INSURER_EMPLOYEE',    label: '🏦 Insurer Employee' },
  { value: 'CUSTOMER_SELF',       label: '👤 Customer / Self' },
  { value: 'AGENT',               label: '🤝 Agent' },
  { value: 'INSPECTION_AGENCY',   label: '🔍 Inspection Agency' },
];

export function InspectionForm({ value, onChange }: Props) {
  const fileRefs = useRef<Record<InspectionPhotoType, HTMLInputElement | null>>({} as any);

  const update = (partial: Partial<InspectionDetails>) =>
    onChange({ ...value, ...partial });

  const handlePhoto = (type: InspectionPhotoType, file: File | null) => {
    onChange({
      ...value,
      photos: { ...value.photos, [type]: file },
    });
  };

  const uploadedCount = PHOTO_SLOTS.filter(({ type }) => value.photos[type]).length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="p-4 rounded-2xl border bg-primary/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-primary">Inspection Photos</span>
          <span className="text-xs font-bold text-muted-foreground">{uploadedCount} / 7 uploaded</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${(uploadedCount / 7) * 100}%` }} />
        </div>
      </div>

      {/* Inspector Type */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Inspection Conducted By</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONDUCTED_BY_OPTIONS.map(({ value: v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ conductedByType: v })}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border text-left transition-all ${
                value.conductedByType === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Inspector Details — context-sensitive */}
      {value.conductedByType && value.conductedByType !== 'JEST_TEAM' && (
        <div className="p-4 rounded-2xl border bg-card space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Inspector Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Name</label>
              <input type="text" value={value.inspectorName || ''}
                onChange={(e) => update({ inspectorName: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Mobile</label>
              <input type="tel" value={value.inspectorPhone || ''}
                onChange={(e) => update({ inspectorPhone: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(value.conductedByType === 'INSPECTION_AGENCY' || value.conductedByType === 'INSURER_EMPLOYEE') && (
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Company / Agency</label>
                <input type="text" value={value.inspectorCompany || ''}
                  onChange={(e) => update({ inspectorCompany: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspection Date/Time */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Inspection Schedule</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Date</label>
            <input type="date" value={value.inspectionDate || ''}
              onChange={(e) => update({ inspectionDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Time</label>
            <input type="time" value={value.inspectionTime || ''}
              onChange={(e) => update({ inspectionTime: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 7 Photo Upload Slots */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Vehicle Photographs (7 Required)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {PHOTO_SLOTS.map(({ type, label, icon }) => {
            const file = value.photos[type];
            const uploaded = !!file;
            return (
              <div key={type}
                className={`relative aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  uploaded ? 'border-emerald-400 bg-emerald-500/5' : 'border-border hover:border-primary bg-muted/20'
                }`}
                onClick={() => fileRefs.current[type]?.click()}
              >
                <input
                  type="file" accept="image/*" className="hidden"
                  ref={(el) => { fileRefs.current[type] = el; }}
                  onChange={(e) => handlePhoto(type, e.target.files?.[0] || null)}
                />
                {uploaded ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <div className="text-[10px] font-bold text-emerald-700 text-center px-1">{label}</div>
                    <div className="text-[9px] text-emerald-600 truncate max-w-[90%]">{file!.name}</div>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">{icon}</span>
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <div className="text-[10px] font-bold text-muted-foreground text-center px-1">{label}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {uploadedCount < 7 && (
          <p className="text-[11px] text-amber-700 font-semibold">Upload all 7 photographs to complete the inspection.</p>
        )}
      </div>
    </div>
  );
}

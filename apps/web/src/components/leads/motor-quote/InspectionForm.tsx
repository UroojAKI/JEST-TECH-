'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, CheckCircle2, Upload, Trash2, Plus, AlertCircle, GripHorizontal, Image as ImageIcon, X } from 'lucide-react';
import type { InspectionDetails, InspectionConductedBy, InspectionPhotoType } from './motorFormTypes';

interface Props {
  value: InspectionDetails;
  onChange: (v: InspectionDetails) => void;
}

export const PHOTO_SLOTS: Array<{ type: InspectionPhotoType; label: string; icon: string; description: string }> = [
  { type: 'front',       label: 'Front View',          icon: '🚗', description: 'Clear frontal view showing front bumper and number plate' },
  { type: 'back',        label: 'Rear View',           icon: '🔙', description: 'Clear rear view showing rear bumper and tail lights' },
  { type: 'left',        label: 'Left Side View',      icon: '◀',  description: 'Full left profile from front to rear fender' },
  { type: 'right',       label: 'Right Side View',     icon: '▶',  description: 'Full right profile from front to rear fender' },
  { type: 'windshield',  label: 'Front Windshield',    icon: '🪟', description: 'Glass condition and wiper area inspection' },
  { type: 'chassis',     label: 'Chassis / VIN Plate', icon: '🔢', description: 'Legible chassis imprint or manufacturer plate' },
  { type: 'odometer',    label: 'Dashboard / Odometer',icon: '🔘', description: 'Illuminated speedometer and odometer reading' },
];

const CONDUCTED_BY_OPTIONS: Array<{ value: InspectionConductedBy; label: string }> = [
  { value: 'JEST_TEAM',           label: '🏢 JestPolizy Team' },
  { value: 'INSURER_EMPLOYEE',    label: '🏦 Insurer Employee' },
  { value: 'CUSTOMER_SELF',       label: '👤 Customer / Self' },
  { value: 'AGENT',               label: '🤝 Agent' },
  { value: 'INSPECTION_AGENCY',   label: '🔍 Inspection Agency' },
];

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export function InspectionForm({ value, onChange }: Props) {
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const fileRefs = useRef<Record<InspectionPhotoType, HTMLInputElement | null>>({} as any);

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [selectedStagedId, setSelectedStagedId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<InspectionPhotoType | null>(null);
  const [isBatchDragOver, setIsBatchDragOver] = useState(false);

  // Sync staged files when value.photos changes from external or initial load
  useEffect(() => {
    PHOTO_SLOTS.forEach(({ type }) => {
      const f = value.photos[type];
      if (f && !stagedFiles.some((s) => s.file === f)) {
        setStagedFiles((prev) => [
          ...prev,
          {
            id: `staged-${type}-${Date.now()}`,
            file: f,
            name: f.name,
            size: f.size,
            previewUrl: URL.createObjectURL(f),
          },
        ]);
      }
    });
  }, []);

  const update = (partial: Partial<InspectionDetails>) =>
    onChange({ ...value, ...partial });

  // Handle files added via batch dropzone or batch file picker
  const handleAddFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!fileArray.length) return;

    const newStaged: StagedFile[] = fileArray.map((file, idx) => ({
      id: `staged-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  const handlePhoto = (type: InspectionPhotoType, file: File | null) => {
    onChange({
      ...value,
      photos: { ...value.photos, [type]: file },
    });
  };

  // Assign a staged image to a specific slot
  const assignStagedToSlot = (stagedId: string, slotType: InspectionPhotoType) => {
    const item = stagedFiles.find((s) => s.id === stagedId);
    if (!item) return;

    // Check if another slot already uses this exact file
    const currentPhotos = { ...value.photos };
    PHOTO_SLOTS.forEach(({ type }) => {
      if (currentPhotos[type] === item.file) {
        currentPhotos[type] = null; // Unassign from previous slot to maintain uniqueness
      }
    });

    currentPhotos[slotType] = item.file;
    onChange({
      ...value,
      photos: currentPhotos,
    });
    setSelectedStagedId(null);
  };

  // Unassign photo from a slot
  const unassignSlot = (slotType: InspectionPhotoType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange({
      ...value,
      photos: { ...value.photos, [slotType]: null },
    });
  };

  // Additional evidence management
  const addAdditionalEvidence = (stagedId: string) => {
    const item = stagedFiles.find((s) => s.id === stagedId);
    if (!item) return;

    const currentEvidence = value.additionalEvidence || [];
    if (currentEvidence.some((e) => e.file === item.file)) return;

    onChange({
      ...value,
      additionalEvidence: [
        ...currentEvidence,
        {
          file: item.file,
          previewUrl: item.previewUrl,
          label: 'Vehicle Detail',
          notes: '',
        },
      ],
    });
    setSelectedStagedId(null);
  };

  const removeAdditionalEvidence = (index: number) => {
    const current = [...(value.additionalEvidence || [])];
    current.splice(index, 1);
    onChange({ ...value, additionalEvidence: current });
  };

  const updateAdditionalEvidence = (index: number, partial: { label?: string; notes?: string }) => {
    const current = [...(value.additionalEvidence || [])];
    if (current[index]) {
      current[index] = { ...current[index], ...partial };
      onChange({ ...value, additionalEvidence: current });
    }
  };

  const uploadedCount = PHOTO_SLOTS.filter(({ type }) => value.photos[type]).length;
  const missingSlots = PHOTO_SLOTS.filter(({ type }) => !value.photos[type]);

  // Find which slot a staged file is currently assigned to (if any)
  const getAssignedSlotLabel = (file: File): string | null => {
    for (const { type, label } of PHOTO_SLOTS) {
      if (value.photos[type] === file) return label;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* ── Progress & Mandatory Checklist ── */}
      <div className={`p-4 rounded-2xl border transition-all ${
        uploadedCount === 7
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-primary/5 border-primary/20'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-foreground">
              Vehicle Inspection Slots
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              uploadedCount === 7 ? 'bg-emerald-600 text-white' : 'bg-primary/20 text-primary'
            }`}>
              {uploadedCount} / 7 Assigned
            </span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {uploadedCount === 7 ? 'All 7 mandatory slots assigned ✓' : `${7 - uploadedCount} remaining`}
          </span>
        </div>

        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              uploadedCount === 7 ? 'bg-emerald-500' : 'bg-primary'
            }`}
            style={{ width: `${(uploadedCount / 7) * 100}%` }}
          />
        </div>

        {missingSlots.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px] text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">Missing slots:</span>
            {missingSlots.map(({ label }) => (
              <span key={label} className="px-1.5 py-0.5 rounded bg-amber-500/15 font-mono text-[10px] font-bold">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 1. Batch Upload Dropzone (Upload all 7 in one go) ── */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
              Step 1: Batch Upload Vehicle Photos
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select or drop all 7 mandatory vehicle photos in one go. You can then drag & drop each photo into its respective slot below.
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
            Multi-Upload Enabled
          </span>
        </div>

        <div
          className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
            isBatchDragOver
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border hover:border-primary bg-muted/20'
          }`}
          onClick={() => batchInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsBatchDragOver(true);
          }}
          onDragLeave={() => setIsBatchDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsBatchDragOver(false);
            if (e.dataTransfer.files) {
              handleAddFiles(e.dataTransfer.files);
            }
          }}
        >
          <input
            type="file"
            ref={batchInputRef}
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleAddFiles(e.target.files);
            }}
          />
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-center">
            <span className="text-xs font-bold text-foreground">Click to upload all photos</span>
            <span className="text-xs text-muted-foreground"> or drag & drop all 7 images here</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Supports JPG, PNG, WEBP (up to 10MB per image) • Select multiple files at once
          </div>
        </div>

        {/* Staging Pool / Tray */}
        {stagedFiles.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Uploaded Photos Tray ({stagedFiles.length} photos)
              </span>
              <span className="text-[10px] text-primary font-semibold">
                Drag photo into a slot, or click photo then click slot
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1">
              {stagedFiles.map((item) => {
                const assignedSlot = getAssignedSlotLabel(item.file);
                const isSelected = selectedStagedId === item.id;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    onClick={() => setSelectedStagedId(isSelected ? null : item.id)}
                    className={`relative w-24 h-24 rounded-xl border-2 overflow-hidden shrink-0 cursor-grab active:cursor-grabbing transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary scale-105'
                        : assignedSlot
                        ? 'border-emerald-500 opacity-90'
                        : 'border-border hover:border-primary/70'
                    }`}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-xs p-1 text-[9px] font-bold truncate">
                      {item.name}
                    </div>
                    {assignedSlot && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-black uppercase">
                        {assignedSlot}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Unassign if currently assigned
                        PHOTO_SLOTS.forEach(({ type }) => {
                          if (value.photos[type] === item.file) {
                            unassignSlot(type);
                          }
                        });
                        setStagedFiles((prev) => prev.filter((s) => s.id !== item.id));
                        if (selectedStagedId === item.id) setSelectedStagedId(null);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white hover:bg-destructive hover:text-white"
                      title="Remove from tray"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. The 7 Mandatory Inspection Slots (Drop Targets) ── */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
              Step 2: Assign Photos to Mandatory Slots (7 Required)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Drag photos from the tray above into each slot, or click a photo in the tray then click the slot.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {PHOTO_SLOTS.map(({ type, label, icon, description }) => {
            const file = value.photos[type];
            const isAssigned = !!file;
            const isDragTarget = dragOverSlot === type;
            const previewUrl = file ? URL.createObjectURL(file) : null;

            return (
              <div
                key={type}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setDragOverSlot(type);
                }}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSlot(null);
                  const stagedId = e.dataTransfer.getData('text/plain');
                  if (stagedId) {
                    assignStagedToSlot(stagedId, type);
                  } else if (e.dataTransfer.files?.[0]) {
                    handlePhoto(type, e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  if (selectedStagedId) {
                    assignStagedToSlot(selectedStagedId, type);
                  } else if (!isAssigned) {
                    fileRefs.current[type]?.click();
                  }
                }}
                className={`relative rounded-2xl border-2 transition-all overflow-hidden flex flex-col ${
                  isDragTarget
                    ? 'border-primary bg-primary/10 ring-2 ring-primary scale-[1.02]'
                    : isAssigned
                    ? 'border-emerald-500/50 bg-emerald-500/5 shadow-xs'
                    : selectedStagedId
                    ? 'border-primary/40 border-dashed bg-primary/5 hover:border-primary cursor-pointer'
                    : 'border-border hover:border-primary/60 border-dashed bg-muted/20 cursor-pointer'
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  ref={(el) => { fileRefs.current[type] = el; }}
                  onChange={(e) => handlePhoto(type, e.target.files?.[0] || null)}
                />

                {isAssigned && previewUrl ? (
                  <div className="flex flex-col h-full">
                    <div className="relative aspect-4/3 w-full bg-black/5 overflow-hidden">
                      <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Assigned
                      </div>
                      <button
                        type="button"
                        onClick={(e) => unassignSlot(type, e)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white hover:bg-destructive hover:text-white transition"
                        title="Unassign photo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                          <span>{icon}</span>
                          <span>{label}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {file.name} ({(file.size / 1024).toFixed(0)} KB)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileRefs.current[type]?.click();
                        }}
                        className="mt-2 text-[10px] font-bold text-primary hover:underline text-left"
                      >
                        Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[140px]">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">{label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {description}
                      </div>
                    </div>
                    <div className="mt-1 px-2.5 py-1 rounded-lg bg-background border text-[10px] font-bold text-primary flex items-center gap-1">
                      {selectedStagedId ? (
                        <span>Click to Assign Selected</span>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          <span>Drop Photo Here</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Additional Evidence Photos (Optional) ── */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
              Additional Evidence Photos (Optional)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Attach extra photos (scratches, dents, engine compartment, interior) beyond the 7 mandatory slots.
            </p>
          </div>
          {selectedStagedId && (
            <button
              type="button"
              onClick={() => addAdditionalEvidence(selectedStagedId)}
              className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Selected as Evidence
            </button>
          )}
        </div>

        {value.additionalEvidence && value.additionalEvidence.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {value.additionalEvidence.map((ev, idx) => (
              <div key={idx} className="p-3 rounded-xl border bg-background flex gap-3 items-start">
                <div className="w-16 h-16 rounded-lg bg-black/5 overflow-hidden shrink-0 border">
                  <img
                    src={ev.previewUrl || URL.createObjectURL(ev.file)}
                    alt={ev.label || 'Evidence'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <input
                    type="text"
                    value={ev.label || ''}
                    placeholder="Evidence label (e.g. Dent on rear fender)"
                    onChange={(e) => updateAdditionalEvidence(idx, { label: e.target.value })}
                    className="w-full px-2 py-1 text-xs border rounded-md font-semibold bg-card"
                  />
                  <input
                    type="text"
                    value={ev.notes || ''}
                    placeholder="Optional notes / observation"
                    onChange={(e) => updateAdditionalEvidence(idx, { notes: e.target.value })}
                    className="w-full px-2 py-1 text-[11px] border rounded-md bg-card text-muted-foreground"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAdditionalEvidence(idx)}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            No additional evidence photos attached. You may drag extra photos or select from tray.
          </p>
        )}
      </div>

      {/* ── 4. Inspector Type & Details ── */}
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

      {value.conductedByType && value.conductedByType !== 'JEST_TEAM' && (
        <div className="p-4 rounded-2xl border bg-card space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Inspector Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={value.inspectorName || ''}
                onChange={(e) => update({ inspectorName: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Mobile</label>
              <input
                type="tel"
                value={value.inspectorPhone || ''}
                maxLength={10}
                onChange={(e) => update({ inspectorPhone: e.target.value.replace(/\D/g, '') })}
                className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(value.conductedByType === 'INSPECTION_AGENCY' || value.conductedByType === 'INSURER_EMPLOYEE') && (
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Company / Agency</label>
                <input
                  type="text"
                  value={value.inspectorCompany || ''}
                  onChange={(e) => update({ inspectorCompany: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Inspection Date / Time ── */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Inspection Schedule</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={value.inspectionDate || ''}
              onChange={(e) => update({ inspectionDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Time</label>
            <input
              type="time"
              value={value.inspectionTime || ''}
              onChange={(e) => update({ inspectionTime: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { DOCUMENT_CHECKLISTS } from './motorFormConfig';
import type { VehicleCategory, PolicyType, UploadedDoc } from './motorFormTypes';
import { CheckCircle2, Upload, FileText, AlertCircle } from 'lucide-react';

interface Props {
  category: VehicleCategory;
  policyType: PolicyType;
  uploadedDocs: UploadedDoc[];
  onDocChange: (docs: UploadedDoc[]) => void;
  quoteFile: File | null;
  onQuoteFileChange: (file: File | null) => void;
}

export function DocumentChecklist({ category, policyType, uploadedDocs, onDocChange, quoteFile, onQuoteFileChange }: Props) {
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
  const docs = DOCUMENT_CHECKLISTS[category] || [];

  const toggleDoc = (docName: string) => {
    const updated = new Set(checkedDocs);
    if (updated.has(docName)) {
      updated.delete(docName);
    } else {
      updated.add(docName);
    }
    setCheckedDocs(updated);
  };

  const handleFileUpload = (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const updated = uploadedDocs.filter((d) => d.docType !== docType);
    updated.push({ docType, fileName: file.name });
    onDocChange(updated);
    // Mark as checked
    setCheckedDocs((prev) => new Set([...prev, docType]));
  };

  const isUploaded = (docType: string) =>
    uploadedDocs.some((d) => d.docType === docType);

  // SAOD-specific extra note
  const isSAOD = policyType === 'SAOD';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-black text-sm text-foreground">Document Checklist</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Verify and upload required documents for this vehicle category
        </p>
      </div>

      {isSAOD && (
        <div className="p-3 rounded-xl border border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10 flex gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            SAOD: Vehicle inspection report / photographs are mandatory for break-in cases. Ensure active TP policy copy is included.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {docs.map((doc, idx) => {
          const isChecked = checkedDocs.has(doc);
          const uploaded = isUploaded(doc);
          return (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                uploaded
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : isChecked
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleDoc(doc)}
                  className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isChecked || uploaded
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {(isChecked || uploaded) && (
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${isChecked || uploaded ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {doc}
                  </p>
                  {uploaded && (
                    <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {uploadedDocs.find((d) => d.docType === doc)?.fileName}
                    </p>
                  )}
                </div>
              </div>
              <label className="flex-shrink-0 ml-3">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(doc, e)}
                />
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  uploaded
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}>
                  <Upload className="h-3 w-3" />
                  {uploaded ? 'Re-upload' : 'Upload'}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {/* Progress Summary */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-bold text-foreground">
            {checkedDocs.size} / {docs.length} documents confirmed
          </span>
        </div>
        <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${docs.length ? (checkedDocs.size / docs.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Quote Upload Section */}
      <div className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <span className="text-xs font-black text-primary">Upload Insurer Quote (PDF)</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Attach the insurer-generated quotation PDF to this record
        </p>
        <label className="block">
          <input
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={(e) => onQuoteFileChange(e.target.files?.[0] || null)}
          />
          <div className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-background ${
            quoteFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-background'
          }`}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${quoteFile ? 'bg-emerald-500/20' : 'bg-primary/10'}`}>
              <FileText className={`h-4 w-4 ${quoteFile ? 'text-emerald-600' : 'text-primary'}`} />
            </div>
            <div>
              <p className={`text-[11px] font-bold ${quoteFile ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                {quoteFile ? quoteFile.name : 'Click to attach quote PDF'}
              </p>
              <p className="text-[9px] text-muted-foreground">PDF format, max 10MB</p>
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

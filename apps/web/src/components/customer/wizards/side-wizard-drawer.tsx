'use client';

import React from 'react';
import { X, UserPlus, FileSpreadsheet, ShieldCheck, FileText, UploadCloud } from 'lucide-react';
import { ChunkedFileUploader } from '../../upload/chunked-file-uploader';

interface SideWizardDrawerProps {
  type: string | null;
  customerId: string;
  onClose: () => void;
}

export function SideWizardDrawer({ type, customerId, onClose }: SideWizardDrawerProps) {
  if (!type) return null;

  const titles: Record<string, { title: string; icon: React.ReactNode }> = {
    LEAD: { title: 'Create New Lead Wizard', icon: <UserPlus className="h-5 w-5 text-primary" /> },
    QUOTE: { title: 'Generate Insurance Quotation', icon: <FileSpreadsheet className="h-5 w-5 text-primary" /> },
    POLICY: { title: 'Issue Policy Wizard', icon: <ShieldCheck className="h-5 w-5 text-primary" /> },
    CLAIM: { title: 'Lodge Insurance Claim', icon: <FileText className="h-5 w-5 text-primary" /> },
    DOCUMENT: { title: 'Upload Customer Document', icon: <UploadCloud className="h-5 w-5 text-primary" /> },
  };

  const config = titles[type] || { title: 'Action Wizard', icon: null };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {config.icon}
            <h2 className="font-bold text-base">{config.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Form Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {type === 'DOCUMENT' ? (
            <ChunkedFileUploader entityType="CUSTOMER" entityId={customerId} onSuccess={onClose} />
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/20 border">
                <span className="font-semibold text-foreground">Customer Workspace Context</span>
                <p className="text-muted-foreground mt-0.5">Target Customer ID: {customerId}</p>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-muted-foreground uppercase">Product Line</label>
                <select className="w-full p-2.5 rounded-lg border bg-background text-xs">
                  <option value="MOTOR">Motor Comprehensive</option>
                  <option value="HEALTH">Health Family Optima</option>
                  <option value="LIFE">Term Life Plan</option>
                  <option value="COMMERCIAL">Commercial / Fire</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-muted-foreground uppercase">Notes / Instructions</label>
                <textarea
                  rows={4}
                  placeholder="Enter details for this action item..."
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                />
              </div>

              <button
                onClick={() => {
                  alert(`${config.title} submitted successfully!`);
                  onClose();
                }}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-colors"
              >
                Submit Action
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

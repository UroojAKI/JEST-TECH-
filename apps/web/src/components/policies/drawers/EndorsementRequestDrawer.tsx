'use client';

import React, { useState } from 'react';
import { X, FileText, ArrowRight } from 'lucide-react';
import { useEndorsements } from '../../../hooks/useEndorsements';

interface EndorsementRequestDrawerProps {
  isOpen: boolean;
  policyId: string;
  onClose: () => void;
}

export function EndorsementRequestDrawer({ isOpen, policyId, onClose }: EndorsementRequestDrawerProps) {
  const [category, setCategory] = useState<'FINANCIAL' | 'NON_FINANCIAL'>('NON_FINANCIAL');
  const [type, setType] = useState<string>('ADDRESS_CHANGE');
  const [reason, setReason] = useState<string>('');

  const { createEndorsement, isCreating } = useEndorsements();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEndorsement(
      { policyId, category, type, reason },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-base">Request Policy Endorsement</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-accent rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Endorsement Category</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory('NON_FINANCIAL');
                  setType('ADDRESS_CHANGE');
                }}
                className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-colors ${
                  category === 'NON_FINANCIAL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                }`}
              >
                Non-Financial (Address/Nominee)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('FINANCIAL');
                  setType('IDV_ADJUSTMENT');
                }}
                className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-colors ${
                  category === 'FINANCIAL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                }`}
              >
                Financial (IDV/Add-ons)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Endorsement Type</label>
            {category === 'NON_FINANCIAL' ? (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-background font-semibold"
              >
                <option value="ADDRESS_CHANGE">Address & Location Update</option>
                <option value="NOMINEE_CHANGE">Nominee & Beneficiary Change</option>
                <option value="NAME_CORRECTION">Spelling / Name Correction</option>
                <option value="CONTACT_UPDATE">Mobile & Email Change</option>
              </select>
            ) : (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-background font-semibold"
              >
                <option value="IDV_ADJUSTMENT">IDV Revision / Adjustment</option>
                <option value="ADDON_ADDITION">Add-on Coverage Addition</option>
                <option value="OWNERSHIP_TRANSFER">Vehicle Ownership Transfer</option>
                <option value="PREMIUM_RECOMPUTE">Premium Adjustment / Refund</option>
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Reason & Servicing Details</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the endorsement request and attached supporting proof..."
              className="w-full p-2.5 rounded-lg border bg-background text-xs"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-colors"
          >
            Submit Endorsement Request
          </button>
        </form>
      </div>
    </div>
  );
}

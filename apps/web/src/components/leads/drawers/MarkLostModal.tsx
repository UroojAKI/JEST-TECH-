'use client';

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { LostReason } from '../../../types/leads';

interface MarkLostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: LostReason, competitor?: string, priceDiff?: number, remarks?: string) => void;
}

export function MarkLostModal({ isOpen, onClose, onSubmit }: MarkLostModalProps) {
  const [reason, setReason] = useState<LostReason>('PREMIUM_HIGH');
  const [competitor, setCompetitor] = useState('');
  const [priceDiff, setPriceDiff] = useState<number>(0);
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason, competitor, priceDiff, remarks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-bold text-base">Mark Lead as Lost</h3>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-accent rounded-md">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Lost Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as LostReason)}
              className="w-full p-2.5 rounded-lg border bg-background text-xs font-semibold"
            >
              <option value="PREMIUM_HIGH">Premium Too High</option>
              <option value="COMPETITOR_WON">Competitor Won Deal</option>
              <option value="NOT_INTERESTED">Customer Not Interested</option>
              <option value="NO_RESPONSE">No Response / Unreachable</option>
              <option value="DUPLICATE">Duplicate Lead</option>
              <option value="INVALID_LEAD">Invalid / Junk Lead</option>
            </select>
          </div>

          {reason === 'COMPETITOR_WON' && (
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground uppercase">Competitor Name</label>
              <input
                type="text"
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
                placeholder="e.g. PolicyBazaar, HDFC Ergo Direct"
                className="w-full p-2.5 rounded-lg border bg-background text-xs"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Premium Difference (₹)</label>
            <input
              type="number"
              value={priceDiff || ''}
              onChange={(e) => setPriceDiff(parseInt(e.target.value, 10) || 0)}
              placeholder="e.g. 2500"
              className="w-full p-2.5 rounded-lg border bg-background text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Remarks / Customer Feedback</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Detailed reasons for deal loss..."
              className="w-full p-2.5 rounded-lg border bg-background text-xs"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border bg-background font-semibold hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 shadow-sm"
            >
              Confirm Mark Lost
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

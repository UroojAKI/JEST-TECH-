'use client';

import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  onSaved: () => void;
}

export function UpdatePolicyDetailsDialog({ isOpen, onClose, quotationId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [actualPolicyNumber, setActualPolicyNumber] = useState('');
  const [actualPremium, setActualPremium] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // API call to update policy details
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-lg shadow-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold">Update Issued Policy Details</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Actual Policy Number</label>
            <input 
              required
              type="text" 
              value={actualPolicyNumber}
              onChange={e => setActualPolicyNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm" 
              placeholder="e.g. POL-123456789"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Actual Premium (₹)</label>
            <input 
              required
              type="number" 
              value={actualPremium}
              onChange={e => setActualPremium(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Policy Start Date</label>
              <input 
                required
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Policy End Date</label>
              <input 
                required
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm" 
              />
            </div>
          </div>
          
          <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/10 cursor-pointer hover:bg-muted/30 transition-colors">
            <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-primary">Upload Policy PDF</span>
            <span className="text-xs text-muted-foreground mt-1">Maximum file size 5MB</span>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
            >
              {loading ? 'Saving...' : <><CheckCircle className="h-4 w-4" /> Save Policy Details</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

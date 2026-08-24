'use client';

import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';

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
  const [odStartDate, setOdStartDate] = useState('');
  const [odExpiryDate, setOdExpiryDate] = useState('');
  const [tpStartDate, setTpStartDate] = useState('');
  const [tpExpiryDate, setTpExpiryDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post(`/motor/quotes/${quotationId}/issue`, {
        actualPolicyNumber,
        actualPremium: parseFloat(actualPremium),
        startDate,
        endDate,
        odStartDate: odStartDate || undefined,
        odExpiryDate: odExpiryDate || undefined,
        tpStartDate: tpStartDate || undefined,
        tpExpiryDate: tpExpiryDate || undefined,
      });
      onSaved();
    } catch (error: any) {
      console.error(error);
      const blockers = error?.response?.data?.blockers;
      alert(blockers?.length ? `Policy issuance blocked: ${blockers.join(', ')}` : 'Unable to issue policy. Please verify the quotation and payment state.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-lg rounded-lg shadow-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div>
            <h3 className="font-semibold">Update Issued Policy Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Back Office only · server-side issuance gate enforced</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium mb-1">Actual Policy Number *</label>
            <input required type="text" value={actualPolicyNumber} onChange={e => setActualPolicyNumber(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g. POL-123456789" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Actual Premium (₹) *</label>
            <input required min="0" step="0.01" type="number" value={actualPremium} onChange={e => setActualPremium(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Policy Start Date *</label>
              <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Policy End Date *</label>
              <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <div className="text-xs font-semibold">Motor OD dates</div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={odStartDate} onChange={e => setOdStartDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" aria-label="OD start date" />
              <input type="date" value={odExpiryDate} onChange={e => setOdExpiryDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" aria-label="OD expiry date" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <div className="text-xs font-semibold">Motor TP dates</div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={tpStartDate} onChange={e => setTpStartDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" aria-label="TP start date" />
              <input type="date" value={tpExpiryDate} onChange={e => setTpExpiryDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" aria-label="TP expiry date" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 p-3">
            Policy issuance is not completed by this form alone. The backend re-checks payment, calculation snapshot, rule evaluation and inspection requirements before creating the Policy.
          </p>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50">
              {loading ? 'Issuing...' : <><CheckCircle className="h-4 w-4" /> Issue Policy</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { ShieldAlert, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentClaimsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    policyNumber: 'POL-001049',
    customerName: '',
    claimAmount: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.claimAmount) {
      toast.error('Customer Name and Estimated Amount are required');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsModalOpen(false);
      toast.success(`Claim CLM-2026-00${Math.floor(Math.random() * 90 + 10)} intimated successfully for ${form.customerName}!`);
      setForm({ policyNumber: 'POL-001049', customerName: '', claimAmount: '', description: '' });
    }, 400);
  };

  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" /> Customer Claims Follow-up Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Register customer claims, upload surveyor damage photos, and track settlement status</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>+ Intimate New Claim</span>
        </button>
      </div>

      <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4 text-xs">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-mono font-bold text-primary">CLM-2026-0042</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">Surveyor Assigned</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>Customer: <strong>Acme Logistics Pvt Ltd</strong></div>
          <div>Policy No: <strong>POL-001049</strong></div>
          <div>Claim Reserve: <strong className="text-emerald-600">₹3,84,500</strong></div>
          <div>Surveyor: <strong>R. K. Gupta</strong></div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <h4 className="font-bold text-[10px] uppercase text-muted-foreground">Real-Time Claim Settlement Status Progress</h4>
          <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
            {['1. Intimated', '2. Surveyor Assigned', '3. Inspection Done', '4. Approved', '5. Settled'].map((st, idx) => (
              <div key={idx} className={`p-2 rounded border font-bold ${idx <= 1 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted/10 text-muted-foreground'}`}>
                {st}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intimate Claim Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" /> Register Customer Claim Intimation
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Policy Number *</label>
                <input
                  type="text"
                  required
                  value={form.policyNumber}
                  onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Customer / Claimant Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Estimated Claim Loss Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 75000"
                  value={form.claimAmount}
                  onChange={(e) => setForm({ ...form, claimAmount: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Incident Details & Loss Reason</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe accident or damage incident..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>
              <div className="pt-3 flex justify-end space-x-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border bg-background font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow flex items-center space-x-1"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <span>{isSubmitting ? 'Registering...' : 'Register Claim'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}


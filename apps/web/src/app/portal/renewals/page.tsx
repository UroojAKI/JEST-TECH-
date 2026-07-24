'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Clock, RefreshCw, Send, Phone, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAgentRenewals } from '../../../hooks/usePortal';
import { toast } from 'sonner';

export default function AgentRenewalsPage() {
  const [selectedBucket, setSelectedBucket] = useState('ALL');
  const { data: renewals = [], isLoading, isError } = useAgentRenewals(selectedBucket === 'ALL' ? undefined : selectedBucket);

  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Renewal Expiry Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">Monitor policies expiring within 45, 30, 15, and 7 days with 1-click renewal dispatch</p>
        </div>
      </div>

      {/* Urgency Buckets Strip */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1 my-4">
        {[
          { id: 'ALL', label: 'All Renewals' },
          { id: '45_DAYS', label: '45 Days' },
          { id: '30_DAYS', label: '30 Days' },
          { id: '15_DAYS', label: '15 Days' },
          { id: '7_DAYS', label: '7 Days' },
          { id: 'GRACE', label: 'Grace Period' },
        ].map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBucket(b.id)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              selectedBucket === b.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading renewals...</div>
      ) : isError ? (
        <div className="p-8 text-center text-destructive">Error loading renewals. Please try again.</div>
      ) : (
        <div className="space-y-3 text-xs">
          {renewals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-card border rounded-xl">No renewals found.</div>
          ) : (
            renewals.map((ren: any) => (
              <div key={ren.id} className="p-4 rounded-xl border bg-card shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-primary">{ren.policyNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      {ren.daysRemaining} Days Left
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-foreground">{ren.customerName} ({ren.mobile})</h4>
                  <p className="text-muted-foreground text-xs">{ren.productLine}</p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="font-mono font-black text-emerald-600 text-sm">Prev. ₹{ren.previousPremium?.toLocaleString('en-IN') || 0}</div>
                    <span className="text-[10px] text-muted-foreground">Expires {ren.expiryDate}</span>
                  </div>

                  <button
                    onClick={() => toast.info('Renewal quote for ' + ren.policyNumber + ' dispatched!')}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1 shadow hover:bg-emerald-700"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Renewal Quote</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}

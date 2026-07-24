'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Clock, RefreshCw, Send, Phone, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAgentRenewals } from '../../../hooks/usePortal';

const MOCK_RENEWALS = [
  { id: 'REN-01', policyNumber: 'POL-001048', customerName: 'Rahul Patil', mobile: '+91 98201 12345', productLine: 'Motor Comprehensive (Private Car)', expiryDate: '2026-08-15', daysRemaining: 22, bucket: '30_DAYS', previousPremium: 16545, renewalQuoteReady: true },
  { id: 'REN-02', policyNumber: 'POL-001049', customerName: 'Acme Logistics Pvt Ltd', mobile: '+91 98920 88123', productLine: 'Group Health Optima', expiryDate: '2026-08-01', daysRemaining: 8, bucket: '15_DAYS', previousPremium: 384000, renewalQuoteReady: true },
  { id: 'REN-03', policyNumber: 'POL-001050', customerName: 'Sunita Kulkarni', mobile: '+91 98920 54321', productLine: 'Motor Two Wheeler', expiryDate: '2026-07-28', daysRemaining: 4, bucket: '7_DAYS', previousPremium: 2850, renewalQuoteReady: true },
];

export default function AgentRenewalsPage() {
  const [selectedBucket, setSelectedBucket] = useState('ALL');

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
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
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

      <div className="space-y-3 text-xs">
        {MOCK_RENEWALS.map((ren) => (
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
                <div className="font-mono font-black text-emerald-600 text-sm">Prev. ₹{ren.previousPremium.toLocaleString('en-IN')}</div>
                <span className="text-[10px] text-muted-foreground">Expires {ren.expiryDate}</span>
              </div>

              <button
                onClick={() => alert(`Generated & Dispatched Renewal Quote for ${ren.policyNumber}!`)}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1 shadow hover:bg-emerald-700"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Renewal Quote</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

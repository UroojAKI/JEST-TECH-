'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { ShieldCheck, Download, RefreshCw, FileText, Search } from 'lucide-react';
import { useAgentPolicies } from '../../../hooks/usePortal';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_POLICIES = [
  { id: 'POL-001048', policyNumber: 'POL-001048', customerName: 'Rahul Patil', productLine: 'Motor Comprehensive (Private Car)', insurerName: 'ICICI Lombard', totalPremium: 16545, startDate: '2025-08-16', expiryDate: '2026-08-15', status: 'ACTIVE' },
  { id: 'POL-001049', policyNumber: 'POL-001049', customerName: 'Acme Logistics Pvt Ltd', productLine: 'Group Health Optima', insurerName: 'HDFC ERGO', totalPremium: 384000, startDate: '2025-08-16', expiryDate: '2026-08-15', status: 'RENEWAL_DUE' },
];

export default function AgentPoliciesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> My Policy Register
          </h1>
          <p className="text-xs text-muted-foreground">View and download issued policies, customer schedules, and premium receipts</p>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Policy Number</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3">Product Plan</th>
              <th className="p-3">Partner Insurer</th>
              <th className="p-3">Total Premium</th>
              <th className="p-3">Expiry Date</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Downloads</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_POLICIES.map((pol) => (
              <tr key={pol.id} className="hover:bg-accent/40">
                <td className="p-3 font-mono font-bold text-primary">{pol.policyNumber}</td>
                <td className="p-3 font-bold">{pol.customerName}</td>
                <td className="p-3">{pol.productLine}</td>
                <td className="p-3 font-semibold">{pol.insurerName}</td>
                <td className="p-3 font-mono font-bold text-emerald-600">₹{pol.totalPremium.toLocaleString('en-IN')}</td>
                <td className="p-3 font-mono text-muted-foreground">{pol.expiryDate}</td>
                <td className="p-3"><StatusBadge status={pol.status} /></td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => alert(`Downloading PDF Schedule for ${pol.policyNumber}`)}
                    className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px] flex items-center justify-end space-x-1 ml-auto"
                  >
                    <Download className="h-3 w-3 text-primary" />
                    <span>Download Schedule</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

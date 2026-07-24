'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { CheckSquare, CheckCircle2, XCircle, ArrowUpRight, Clock, AlertTriangle, Eye, X, UserCheck } from 'lucide-react';
import { useApprovals } from '../../../hooks/useWorkflows';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_APPROVALS = [
  {
    id: 'APP-101',
    instanceId: 'WFI-99101',
    module: 'PROPOSALS',
    entityNumber: 'PRP-2026-0091',
    title: 'High IDV Commercial Motor Proposal Approval',
    requestorName: 'Rajesh Sharma',
    customerName: 'Rahul Patil',
    amount: 16545,
    currentState: 'Underwriting Review',
    slaDueDate: '2026-07-24 16:00 IST',
    isOverdue: false,
    priority: 'HIGH',
    createdAt: '2026-07-24 09:00 IST',
  },
  {
    id: 'APP-102',
    instanceId: 'WFI-99102',
    module: 'CLAIMS',
    entityNumber: 'CLM-2026-0042',
    title: 'High Value Motor Claim Settlement Approval (> ₹1L)',
    requestorName: 'Priya Nair',
    customerName: 'Acme Logistics Pvt Ltd',
    amount: 384500,
    currentState: 'Manager Approval',
    slaDueDate: '2026-07-24 12:00 IST',
    isOverdue: true,
    priority: 'CRITICAL',
    createdAt: '2026-07-23 14:00 IST',
  },
  {
    id: 'APP-103',
    instanceId: 'WFI-99103',
    module: 'FINANCE',
    entityNumber: 'PAY-2026-103',
    title: 'Customer Premium Refund Payout Approval',
    requestorName: 'Sunil Verma',
    customerName: 'Vikram Mehta',
    amount: 4200,
    currentState: 'Finance Manager Approval',
    slaDueDate: '2026-07-25 18:00 IST',
    isOverdue: false,
    priority: 'MEDIUM',
    createdAt: '2026-07-24 10:30 IST',
  },
];

export default function ApprovalsPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);

  const { executeAction, executeBulkAction } = useApprovals();

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(MOCK_APPROVALS.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" /> Enterprise Approval & Authorization Center
          </h1>
          <p className="text-xs text-muted-foreground">
            Review, authorize, reject, or escalate pending underwriting, claim settlement, and finance approval requests
          </p>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center space-x-2 bg-muted/30 p-1.5 rounded-lg border">
            <span className="text-[11px] font-bold text-primary px-2">{selectedIds.length} Selected</span>
            <button
              onClick={() => executeBulkAction({ ids: selectedIds, action: 'APPROVE' })}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold text-xs shadow hover:bg-emerald-700"
            >
              ✓ Approve Selected
            </button>
            <button
              onClick={() => executeBulkAction({ ids: selectedIds, action: 'REJECT' })}
              className="px-3 py-1.5 rounded bg-red-600 text-white font-bold text-xs shadow hover:bg-red-700"
            >
              ✕ Reject Selected
            </button>
            <button
              onClick={() => executeBulkAction({ ids: selectedIds, action: 'ESCALATE' })}
              className="px-3 py-1.5 rounded bg-amber-600 text-white font-bold text-xs shadow hover:bg-amber-700"
            >
              ⚡ Escalate Selected
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {[
          { id: 'MY_APPROVALS', label: 'My Approvals' },
          { id: 'PENDING', label: 'Pending Queue' },
          { id: 'ESCALATED', label: 'Escalated' },
          { id: 'OVERDUE', label: 'SLA Overdue' },
          { id: 'COMPLETED', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              statusFilter === tab.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Approvals Table */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">
                <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === MOCK_APPROVALS.length} />
              </th>
              <th className="p-3">Entity No.</th>
              <th className="p-3">Approval Title & Purpose</th>
              <th className="p-3">Module</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Amount</th>
              <th className="p-3">SLA Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_APPROVALS.map((app) => (
              <tr key={app.id} className="hover:bg-accent/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(app.id)}
                    onChange={() => handleToggleSelect(app.id)}
                  />
                </td>
                <td className="p-3 font-mono font-bold text-primary">{app.entityNumber}</td>
                <td className="p-3">
                  <div className="font-bold text-foreground">{app.title}</div>
                  <span className="text-[10px] text-muted-foreground">Requested by {app.requestorName}</span>
                </td>
                <td className="p-3 font-bold text-[10px] uppercase text-muted-foreground">{app.module}</td>
                <td className="p-3 font-semibold">{app.customerName}</td>
                <td className="p-3 font-mono font-bold text-emerald-600">
                  {app.amount ? `₹${app.amount.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className="p-3">
                  {app.isOverdue ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20 font-bold text-[10px]">
                      ⚠️ Overdue ({app.slaDueDate})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-[10px]">
                      ✓ Due: {app.slaDueDate}
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={() => executeAction({ id: app.id, action: 'APPROVE' })}
                      className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => executeAction({ id: app.id, action: 'REJECT' })}
                      className="px-2.5 py-1 rounded border border-red-500/30 text-red-600 hover:bg-red-500/10 font-bold text-[10px]"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setSelectedApproval(app)}
                      className="p-1 rounded border bg-background hover:bg-accent"
                      title="Inspect Approval Timeline"
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approval Detail & Audit Timeline Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">Approval Timeline Audit: {selectedApproval.entityNumber}</h3>
              <button onClick={() => setSelectedApproval(null)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
              <div className="font-bold text-foreground text-sm">{selectedApproval.title}</div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Customer: <strong>{selectedApproval.customerName}</strong></span>
                <span>Amount: <strong className="text-emerald-600">₹{selectedApproval.amount?.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase text-muted-foreground">Approval Lifecycle Stages</h4>
              <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                {['Created', 'Assigned', 'Opened', 'Reviewed', 'Approved'].map((stage, idx) => (
                  <div key={idx} className="p-2 rounded border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                    ✓ {stage}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

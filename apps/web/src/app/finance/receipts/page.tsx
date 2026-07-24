'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Receipt, Download, Filter } from 'lucide-react';
import { useReceipts } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { VoucherPreviewModal, VoucherData } from '../../../components/finance/vouchers/VoucherPreviewModal';

export default function ReceiptsRegisterPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherData | null>(null);

  const { data: receipts = [] } = useReceipts(statusFilter);

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Premium Receipts Register
          </h1>
          <p className="text-xs text-muted-foreground">Manage policy premium collections, tax receipts, and payment verification</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Exporting Receipts Register CSV...')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
        </div>
      </div>

      {/* Filter Views */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Receipts' },
          { id: 'VERIFIED', label: 'Verified' },
          { id: 'RECONCILED', label: 'Reconciled' },
          { id: 'PENDING', label: 'Pending Verification' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setStatusFilter(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              statusFilter === view.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Receipt No.</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3">Policy Number</th>
              <th className="p-3">Premium Amount</th>
              <th className="p-3">Payment Mode</th>
              <th className="p-3">Status</th>
              <th className="p-3">Collection Date</th>
              <th className="p-3 text-right">Voucher</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {receipts.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="p-3 font-bold text-primary font-mono">{r.receiptNumber}</td>
                <td className="p-3 font-semibold">{r.customerName}</td>
                <td className="p-3 font-mono">{r.policyNumber}</td>
                <td className="p-3 font-extrabold text-emerald-600 font-mono">₹{r.amount.toLocaleString('en-IN')}</td>
                <td className="p-3 text-muted-foreground">{r.paymentMode}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-muted-foreground">{r.date}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() =>
                      setSelectedVoucher({
                        title: 'Premium Payment Receipt',
                        voucherNumber: r.receiptNumber,
                        date: r.date,
                        type: 'RECEIPT',
                        partyName: r.customerName,
                        amount: r.amount,
                        paymentMode: r.paymentMode,
                        txnRef: r.txnRef,
                        details: [
                          { label: `Policy Premium (${r.policyNumber})`, value: r.amount },
                          { label: 'GST Tax Receipt (18%)', value: 'Included' },
                          { label: 'Received By', value: r.receivedBy },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                  >
                    View Receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <VoucherPreviewModal
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        voucher={selectedVoucher}
      />
    </AppShell>
  );
}

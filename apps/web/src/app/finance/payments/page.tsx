'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { CreditCard, Download } from 'lucide-react';
import { usePayments } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { VoucherPreviewModal, VoucherData } from '../../../components/finance/vouchers/VoucherPreviewModal';

export default function PaymentsRegisterPage() {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherData | null>(null);

  const { data: payments = [] } = usePayments(typeFilter);

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Payment & Disbursal Register
          </h1>
          <p className="text-xs text-muted-foreground">Track vendor payments, insurer settlements, customer refunds, and commission payouts</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Exporting Payment Register CSV...')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
        </div>
      </div>

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Payments' },
          { id: 'INSURER_SETTLEMENT', label: 'Insurer Settlements' },
          { id: 'COMMISSION_DISBURSAL', label: 'Commission Payouts' },
          { id: 'CUSTOMER_REFUND', label: 'Customer Refunds' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setTypeFilter(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              typeFilter === view.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="border rounded-xl overflow-hidden bg-card text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Payment No.</th>
              <th className="p-3">Payee / Beneficiary</th>
              <th className="p-3">Type</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Disbursal Mode</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Voucher</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-accent/40">
                <td className="p-3 font-bold text-primary font-mono">{p.paymentNumber}</td>
                <td className="p-3 font-semibold">{p.payee}</td>
                <td className="p-3 font-semibold text-muted-foreground">{p.type}</td>
                <td className="p-3 font-extrabold text-foreground font-mono">₹{p.amount.toLocaleString('en-IN')}</td>
                <td className="p-3 text-muted-foreground">{p.mode}</td>
                <td className="p-3"><StatusBadge status={p.status} /></td>
                <td className="p-3 text-muted-foreground">{p.date}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() =>
                      setSelectedVoucher({
                        title: 'Disbursal Payment Voucher',
                        voucherNumber: p.paymentNumber,
                        date: p.date,
                        type: 'INVOICE',
                        partyName: p.payee,
                        amount: p.amount,
                        paymentMode: p.mode,
                        details: [
                          { label: `Payment Purpose (${p.type})`, value: p.amount },
                          { label: 'Bank Disbursal Mode', value: p.mode },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                  >
                    View Voucher
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

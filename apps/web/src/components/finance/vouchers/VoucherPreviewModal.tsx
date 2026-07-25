'use client';

import React from 'react';
import { X, FileText, Download, Printer, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export interface VoucherData {
  title: string;
  voucherNumber: string;
  date: string;
  type: 'RECEIPT' | 'INVOICE' | 'JOURNAL' | 'SETTLEMENT';
  partyName: string;
  amount: number;
  paymentMode?: string;
  txnRef?: string;
  details: { label: string; value: string | number }[];
}

interface VoucherPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherData | null;
}

export function VoucherPreviewModal({ isOpen, onClose, voucher }: VoucherPreviewModalProps) {
  if (!isOpen || !voucher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm">{voucher.title} Preview</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => toast.success(`Downloading voucher ${voucher.voucherNumber} PDF...`)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border bg-background hover:bg-accent text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border bg-background hover:bg-accent text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Voucher PDF Document Content */}
        <div className="p-8 flex-1 overflow-y-auto space-y-6 text-xs bg-background">
          {/* Header Branding */}
          <div className="flex justify-between items-start border-b pb-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-black text-base tracking-tight">JEST POLICY CRM</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Licensed Insurance Brokering Platform</p>
              <p className="text-[10px] text-muted-foreground">BKC Financial Centre, Bandra East, Mumbai 400051</p>
            </div>
            <div className="text-right space-y-1">
              <div className="px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-extrabold uppercase text-[11px] inline-block">
                {voucher.type} VOUCHER
              </div>
              <div className="font-mono font-bold text-sm">{voucher.voucherNumber}</div>
              <div className="text-[10px] text-muted-foreground">Date: {voucher.date}</div>
            </div>
          </div>

          {/* Key Summary Box */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/10">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Issued To / Party</span>
              <div className="font-bold text-foreground text-sm">{voucher.partyName}</div>
              {voucher.paymentMode && (
                <div className="text-muted-foreground text-[11px] mt-0.5">Mode: {voucher.paymentMode}</div>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Amount</span>
              <div className="font-black text-emerald-600 text-lg">₹{voucher.amount.toLocaleString('en-IN')}</div>
              {voucher.txnRef && (
                <div className="text-muted-foreground font-mono text-[10px]">Ref: {voucher.txnRef}</div>
              )}
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase text-[11px] text-muted-foreground">Voucher Particulars</h4>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                    <th className="p-3">Description / Line Item</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {voucher.details.map((d, i) => (
                    <tr key={i}>
                      <td className="p-3 font-semibold">{d.label}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {typeof d.value === 'number' ? `₹${d.value.toLocaleString('en-IN')}` : d.value}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/20 font-bold border-t">
                    <td className="p-3">TOTAL AMOUNT PAID / POSTED</td>
                    <td className="p-3 text-right text-emerald-600 font-extrabold font-mono">
                      ₹{voucher.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Seals & Verification */}
          <div className="border-t pt-4 flex justify-between items-end text-[10px] text-muted-foreground">
            <div className="space-y-1">
              <div className="flex items-center space-x-1 text-emerald-600 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Digitally Verified & Ledger Posted</span>
              </div>
              <p>System Generated Voucher • No Physical Signature Required</p>
            </div>
            <div className="text-center space-y-4">
              <div className="font-mono text-[9px] text-muted-foreground">AUTH-SIGN-889102-JEST</div>
              <div className="border-t pt-1 font-bold text-foreground">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

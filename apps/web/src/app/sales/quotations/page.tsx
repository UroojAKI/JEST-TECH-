'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { FileSpreadsheet, Plus, X, Calculator, ShieldCheck, Download, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuotationItem {
  id: string;
  quotationNumber: string;
  version: number;
  contactName: string;
  productLine: string;
  insurerName: string;
  idvValue: number;
  totalPremium: number;
  status: string;
  expiryDate: string;
  createdAt: string;
}

const STORAGE_KEY = 'jest_global_quotations_v3';

export default function QuotationsRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setQuotations(JSON.parse(saved));
      } else {
        setQuotations([]);
      }
    } catch (e) {
      setQuotations([]);
    }
  }, []);

  const saveQuotationsToStorage = (updated: QuotationItem[]) => {
    setQuotations(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const [form, setForm] = useState({
    contactName: '',
    productLine: 'Motor Comprehensive',
    insurerName: 'ICICI Lombard',
    totalPremium: 18500,
  });

  const handleCreateQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactName) {
      toast.error('Customer name is required');
      return;
    }

    setIsSubmitting(true);
    const qtNum = `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newQt: QuotationItem = {
      id: qtNum,
      quotationNumber: qtNum,
      version: 1,
      contactName: form.contactName,
      productLine: form.productLine,
      insurerName: form.insurerName,
      idvValue: 850000,
      totalPremium: Number(form.totalPremium),
      status: 'SHARED',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
    };

    saveQuotationsToStorage([newQt, ...quotations]);
    toast.success(`Quotation ${qtNum} created for ${form.contactName}!`);
    setIsModalOpen(false);
    setForm({ contactName: '', productLine: 'Motor Comprehensive', insurerName: 'ICICI Lombard', totalPremium: 18500 });
    setIsSubmitting(false);
  };

  const filteredData = quotations.filter((q) => {
    if (savedView === 'ACCEPTED') return q.status === 'ACCEPTED';
    if (savedView === 'SHARED') return q.status === 'SHARED';
    return true;
  });

  const columns = [
    {
      accessorKey: 'quotationNumber',
      header: 'Quote Ref',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/sales/quotations/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold text-primary font-mono"
        >
          {row.original.quotationNumber}
        </span>
      ),
    },
    { accessorKey: 'contactName', header: 'Prospect / Client' },
    { accessorKey: 'productLine', header: 'Product Line' },
    { accessorKey: 'insurerName', header: 'Insurer' },
    {
      accessorKey: 'totalPremium',
      header: 'Total Premium',
      cell: ({ row }: any) => (
        <span className="font-extrabold text-emerald-600 font-mono">
          ₹{Number(row.original.totalPremium || 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
    { accessorKey: 'createdAt', header: 'Created Date' },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Quotation Register
          </h1>
          <p className="text-xs text-muted-foreground">Multi-insurer quote calculation & comparison register</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <Plus className="h-4 w-4" />
          <span>+ Generate New Quotation</span>
        </button>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="p-5 rounded-2xl border bg-card shadow-lg space-y-4 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Generate Quotation
            </h3>
            <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleCreateQuotation} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Prospect Name *</label>
                <input
                  type="text"
                  required
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Product Line</label>
                <select
                  value={form.productLine}
                  onChange={(e) => setForm({ ...form, productLine: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                >
                  <option value="Motor Comprehensive">Motor Comprehensive</option>
                  <option value="Health Family Optima">Health Family Optima</option>
                  <option value="Group Health Insurance">Group Health Insurance</option>
                  <option value="Commercial Property">Commercial Property</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Insurer Partner</label>
                <select
                  value={form.insurerName}
                  onChange={(e) => setForm({ ...form, insurerName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                >
                  <option value="ICICI Lombard">ICICI Lombard</option>
                  <option value="HDFC ERGO">HDFC ERGO</option>
                  <option value="Bajaj Allianz">Bajaj Allianz</option>
                  <option value="Tata AIG">Tata AIG</option>
                  <option value="Star Health">Star Health</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Quoted Premium (₹)</label>
                <input
                  type="number"
                  required
                  value={form.totalPremium}
                  onChange={(e) => setForm({ ...form, totalPremium: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border bg-background">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold shadow">
                {isSubmitting ? 'Generating...' : 'Generate Quote'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Quotations' },
          { id: 'SHARED', label: 'Shared with Client' },
          { id: 'ACCEPTED', label: 'Accepted Quotes' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSavedView(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              savedView === view.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <EnterpriseTable data={filteredData} columns={columns} />
    </AppShell>
  );
}

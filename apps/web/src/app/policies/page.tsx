'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ShieldCheck, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../../hooks/usePolicies';
import { policiesRepository } from '../../repositories/policies.repository';
import { formatCurrency } from '../../lib/formatters';

export default function PolicyRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { policies, isLoading, isError, refetch } = usePolicies({
    status: savedView !== 'ALL' ? savedView : undefined,
  });

  const [formData, setFormData] = useState({
    contactName: '',
    productLine: 'Motor Comprehensive',
    insurerName: 'ICICI Lombard',
    totalPremium: 25000,
    idvValue: 850000,
  });

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName) {
      toast.error('Policy holder name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await policiesRepository.createPolicy({
        contactName: formData.contactName,
        productLine: formData.productLine,
        insurerName: formData.insurerName,
        totalPremium: Number(formData.totalPremium),
        idvValue: Number(formData.idvValue),
      });

      toast.success(`Policy ${created.policyNumber || created.id || 'record'} issued successfully!`);
      setShowAddModal(false);
      setFormData({ contactName: '', productLine: 'Motor Comprehensive', insurerName: 'ICICI Lombard', totalPremium: 25000, idvValue: 850000 });
      refetch();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to issue policy via API';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      accessorKey: 'policyNumber',
      header: 'Policy No',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/policies/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold text-primary font-mono"
        >
          {row.original.policyNumber}
        </span>
      ),
    },
    { accessorKey: 'contactName', header: 'Policy Holder' },
    { accessorKey: 'productLine', header: 'Product' },
    { accessorKey: 'insurerName', header: 'Insurer' },
    {
      accessorKey: 'totalPremium',
      header: 'Total Premium',
      cell: ({ row }: any) => (
        <span className="font-extrabold text-emerald-600 font-mono" suppressHydrationWarning>
          {formatCurrency(row.original.totalPremium)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
    { accessorKey: 'expiryDate', header: 'Expiry Date' },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Active Policy Register
          </h1>
          <p className="text-xs text-muted-foreground">Book of business, active policies, and renewal pipeline</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <Plus className="h-4 w-4" />
          <span>+ Issue Policy</span>
        </button>
      </div>

      {/* Add Policy Modal */}
      {showAddModal && (
        <div className="p-5 rounded-2xl border bg-card shadow-lg space-y-4 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Issue Direct Policy
            </h3>
            <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleCreatePolicy} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Policy Holder Name *</label>
                <input
                  type="text"
                  required
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="e.g. Sunita Kulkarni"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Product</label>
                <select
                  value={formData.productLine}
                  onChange={(e) => setFormData({ ...formData, productLine: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                >
                  <option value="Motor Comprehensive">Motor Comprehensive</option>
                  <option value="Health Optima Family">Health Optima Family</option>
                  <option value="Group Health Insurance">Group Health Insurance</option>
                  <option value="Life Term Plan">Life Term Plan</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Insurer Partner</label>
                <select
                  value={formData.insurerName}
                  onChange={(e) => setFormData({ ...formData, insurerName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                >
                  <option value="ICICI Lombard">ICICI Lombard</option>
                  <option value="HDFC ERGO">HDFC ERGO</option>
                  <option value="Star Health">Star Health</option>
                  <option value="Bajaj Allianz">Bajaj Allianz</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Insured Value IDV (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.idvValue}
                  onChange={(e) => setFormData({ ...formData, idvValue: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Total Annual Premium (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.totalPremium}
                  onChange={(e) => setFormData({ ...formData, totalPremium: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg border bg-background">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold shadow flex items-center space-x-1">
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                <span>{isSubmitting ? 'Issuing...' : 'Issue Policy'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Active Policies' },
          { id: 'ACTIVE', label: 'In-Force Policies' },
          { id: 'RENEWAL_DUE', label: 'Renewal Due' },
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

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading policies from API...</div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-red-500">Failed to load policy register from API.</div>
      ) : (
        <EnterpriseTable data={policies || []} columns={columns} />
      )}
    </AppShell>
  );
}

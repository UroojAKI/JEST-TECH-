'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { EnterpriseTable } from '../../components/table/enterprise-table';
import { StatusBadge } from '../../components/ui/status-badge';
import { ShieldCheck, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../../hooks/usePolicies';

const STORAGE_KEY = 'jest_crm_policies_v3';

export default function PolicyRegisterPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storedPolicies, setStoredPolicies] = useState<any[]>([]);

  const { policies: apiPolicies } = usePolicies();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setStoredPolicies(JSON.parse(saved));
      } else {
        setStoredPolicies([]);
      }
    } catch (e) {
      setStoredPolicies([]);
    }
  }, []);

  const savePoliciesToStorage = (updated: any[]) => {
    setStoredPolicies(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const policiesMap = new Map<string, any>();
  storedPolicies.forEach((p) => policiesMap.set(p.id, p));
  (apiPolicies || []).forEach((p: any) => {
    if (!policiesMap.has(p.id)) {
      policiesMap.set(p.id, {
        id: p.id,
        policyNumber: p.policyNumber || p.id,
        contactName: p.contactName || p.customerName || 'Policy Holder',
        productLine: p.productLine || p.product || 'Insurance Policy',
        insurerName: p.insurerName || 'Partner Insurer',
        idvValue: p.idvValue || 500000,
        totalPremium: p.totalPremium || p.premium || 20000,
        status: p.status || 'ACTIVE',
        startDate: p.startDate || new Date().toISOString().split('T')[0],
        expiryDate: p.expiryDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        renewalExecutive: p.renewalExecutive || 'Rajesh Sharma',
        healthScore: 90,
        claimsCount: 0,
        createdAt: p.createdAt || new Date().toISOString().split('T')[0],
      });
    }
  });
  const combinedPolicies = Array.from(policiesMap.values());

  const [formData, setFormData] = useState({
    contactName: '',
    productLine: 'Motor Comprehensive',
    insurerName: 'ICICI Lombard',
    totalPremium: 25000,
  });

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName) {
      toast.error('Customer name is required');
      return;
    }

    setIsSubmitting(true);
    const polNum = `POL-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const newPol = {
      id: polNum,
      policyNumber: polNum,
      contactName: formData.contactName,
      productLine: formData.productLine,
      insurerName: formData.insurerName,
      idvValue: 850000,
      totalPremium: Number(formData.totalPremium),
      status: 'ACTIVE',
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      renewalExecutive: 'Rajesh Sharma',
      healthScore: 95,
      claimsCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };

    savePoliciesToStorage([newPol, ...storedPolicies]);
    toast.success(`Policy ${polNum} issued for ${formData.contactName}!`);
    setShowAddModal(false);
    setFormData({ contactName: '', productLine: 'Motor Comprehensive', insurerName: 'ICICI Lombard', totalPremium: 25000 });
    setIsSubmitting(false);
  };

  const filteredData = combinedPolicies.filter((p) => {
    if (savedView === 'ACTIVE') return p.status === 'ACTIVE';
    if (savedView === 'RENEWAL') return p.status === 'RENEWAL_DUE';
    return true;
  });

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
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold shadow">
                {isSubmitting ? 'Issuing...' : 'Issue Policy'}
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
          { id: 'RENEWAL', label: 'Renewal Due' },
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

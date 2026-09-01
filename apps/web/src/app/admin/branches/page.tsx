'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Plus, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminRepository, BranchItem } from '../../../repositories/admin.repository';

export default function BranchManagementPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', city: '', state: '', address: '' });

  const { data: branches = [], isLoading, isError, refetch } = useQuery<BranchItem[]>({
    queryKey: ['admin-branches'],
    queryFn: adminRepository.getBranches,
  });

  const createMutation = useMutation({
    mutationFn: adminRepository.createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] });
      toast.success('Branch created successfully');
      setForm({ name: '', code: '', city: '', state: '', address: '' });
      setIsModalOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create branch'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.city) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      name: form.name,
      code: form.code.toUpperCase(),
      city: form.city,
      state: form.state || undefined,
      address: form.address || undefined,
    });
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Branch & Organizational Hierarchy Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Manage branches, departments, sales teams, and manager scoping.</p>
        </div>
        <button onClick={() => setIsModalOpen(!isModalOpen)} className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          <span>{isModalOpen ? 'Cancel' : '+ Create New Branch'}</span>
        </button>
      </div>

      {isModalOpen && (
        <div className="p-5 border rounded-xl bg-card shadow-sm text-xs mb-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Create Regional Branch</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="font-bold text-muted-foreground block mb-1">Branch Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="font-bold text-muted-foreground block mb-1">Branch Code *</label><input type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs font-mono uppercase" /></div>
              <div><label className="font-bold text-muted-foreground block mb-1">City *</label><input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="font-bold text-muted-foreground block mb-1">State</label><input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div>
              <div><label className="font-bold text-muted-foreground block mb-1">Address / Street</label><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div>
            </div>
            <div className="pt-3 flex justify-end"><button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center">{createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}{createMutation.isPending ? 'Creating...' : 'Create Branch'}</button></div>
          </form>
        </div>
      )}

      {isLoading && <div className="flex items-center justify-center p-12 text-muted-foreground gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />Loading authoritative branch registry...</div>}
      {isError && <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-xl bg-destructive/10 text-destructive text-xs mb-4"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />Failed to load branch records from database.</div><button onClick={() => refetch()} className="underline font-bold">Retry</button></div>}

      {!isLoading && !isError && branches.length === 0 && (
        <div className="p-12 text-center border rounded-2xl bg-card text-muted-foreground text-xs"><Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" /><p className="font-bold">No branches found in database.</p><p className="mt-1">Click "+ Create New Branch" to provision your first regional branch.</p></div>
      )}

      {!isLoading && !isError && branches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {branches.map((b) => (
            <div key={b.id} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
              <div className="flex justify-between items-start border-b pb-3">
                <div><span className="font-mono font-bold text-[10px] text-primary">{b.code}</span><h3 className="font-extrabold text-sm">{b.name}</h3><span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{b.city}{b.state ? `, ${b.state}` : ''}</span></div>
                <StatusBadge status={b.status || (b.isActive ? 'ACTIVE' : 'INACTIVE')} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg border bg-muted/10"><span className="text-[10px] font-bold text-muted-foreground uppercase">Manager</span><div className="font-bold truncate">{b.managerName || '—'}</div></div>
                <div className="p-2.5 rounded-lg border bg-muted/10"><span className="text-[10px] font-bold text-muted-foreground uppercase">Staff Count</span><div className="font-bold text-primary">{typeof b.staffCount === 'number' ? b.staffCount : '—'}</div></div>
                <div className="p-2.5 rounded-lg border bg-muted/10"><span className="text-[10px] font-bold text-muted-foreground uppercase">Active Policies</span><div className="font-bold text-emerald-600">{typeof b.activePolicies === 'number' ? b.activePolicies.toLocaleString('en-IN') : '—'}</div></div>
              </div>
              <div className="p-3 rounded-xl border bg-muted/10 flex justify-between items-center font-bold"><span>Monthly GWP:</span><span className="text-sm font-mono">{typeof b.monthlyGwp === 'number' ? `₹${b.monthlyGwp.toLocaleString('en-IN')}` : '—'}</span></div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

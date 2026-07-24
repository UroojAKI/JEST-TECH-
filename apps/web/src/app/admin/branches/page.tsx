'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Plus, MapPin, X, Loader2 } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';

interface BranchItem {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  managerName: string;
  staffCount: number;
  activePolicies: number;
  monthlyGwp: number;
  status: string;
}

const INITIAL_BRANCHES: BranchItem[] = [
  {
    id: 'BR-01',
    code: 'BOM-BKC',
    name: 'Mumbai BKC Flagship Branch',
    city: 'Mumbai',
    state: 'Maharashtra',
    managerName: 'Sunil Verma',
    staffCount: 42,
    activePolicies: 4850,
    monthlyGwp: 18400000,
    status: 'ACTIVE',
  },
  {
    id: 'BR-02',
    code: 'PUN-SHV',
    name: 'Pune Shivajinagar Branch',
    city: 'Pune',
    state: 'Maharashtra',
    managerName: 'Rajesh Sharma',
    staffCount: 28,
    activePolicies: 3200,
    monthlyGwp: 14200000,
    status: 'ACTIVE',
  },
  {
    id: 'BR-03',
    code: 'BLR-IND',
    name: 'Bengaluru Indiranagar Tech Branch',
    city: 'Bengaluru',
    state: 'Karnataka',
    managerName: 'Priya Nair',
    staffCount: 24,
    activePolicies: 2800,
    monthlyGwp: 10500000,
    status: 'ACTIVE',
  },
  {
    id: 'BR-04',
    code: 'DEL-CP',
    name: 'Delhi Connaught Place Branch',
    city: 'New Delhi',
    state: 'Delhi',
    managerName: 'Vikram Mehta',
    staffCount: 16,
    activePolicies: 1630,
    monthlyGwp: 5400000,
    status: 'ACTIVE',
  },
];

export default function BranchManagementPage() {
  const [branches, setBranches] = useState<BranchItem[]>(INITIAL_BRANCHES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    managerName: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.city) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newBranch: BranchItem = {
        id: `BR-0${branches.length + 1}`,
        code: form.code.toUpperCase(),
        name: form.name,
        city: form.city,
        state: form.state || 'Maharashtra',
        managerName: form.managerName || 'Unassigned',
        staffCount: 1,
        activePolicies: 0,
        monthlyGwp: 0,
        status: 'ACTIVE',
      };
      setBranches([newBranch, ...branches]);
      toast.info('Branch created! (Syncing with API...)');
      setForm({ name: '', code: '', city: '', state: '', managerName: '' });
      setIsSubmitting(false);
      setIsModalOpen(false);
    }, 400);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Branch & Organizational Hierarchy Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Manage regional brokerage branches, department mappings, sales teams, and manager scoping</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsModalOpen(!isModalOpen)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{isModalOpen ? 'Cancel' : '+ Create New Branch'}</span>
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="p-5 border rounded-xl bg-card shadow-sm text-xs mb-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Create Regional Branch</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="font-bold text-muted-foreground block mb-1">Branch Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Hyderabad Hitec City Branch"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Branch Code *</label>
                <input
                  type="text"
                  required
                  placeholder="HYD-HTC"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs font-mono uppercase focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">City *</label>
                <input
                  type="text"
                  required
                  placeholder="Hyderabad"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">State</label>
                <input
                  type="text"
                  placeholder="Telangana"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Manager Name</label>
                <input
                  type="text"
                  placeholder="Anil Reddy"
                  value={form.managerName}
                  onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                <span>{isSubmitting ? 'Creating...' : 'Create Branch'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {branches.map((b) => (
          <div key={b.id} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="font-mono font-bold text-[10px] text-primary">{b.code}</span>
                <h3 className="font-extrabold text-sm text-foreground">{b.name}</h3>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {b.city}, {b.state}
                </span>
              </div>
              <StatusBadge status={b.status} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg border bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch Head</span>
                <div className="font-bold text-foreground truncate">{b.managerName}</div>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Staff Count</span>
                <div className="font-bold text-primary">{b.staffCount} Execs</div>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Active Policies</span>
                <div className="font-bold text-emerald-600">{b.activePolicies.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex justify-between items-center font-bold">
              <span>Monthly GWP Contribution:</span>
              <span className="text-sm font-mono font-black">₹{b.monthlyGwp.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ))}
      </div>


    </AppShell>
  );
}


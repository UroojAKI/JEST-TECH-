'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  BarChart2, Plus, Edit2, Trash2, Check, X,
  TrendingUp, Percent, Hash, DivideCircle, Loader2,
} from 'lucide-react';

interface KpiDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  formula: string;
  category: string;
  unit: 'PERCENTAGE' | 'CURRENCY' | 'COUNT' | 'RATIO' | 'DAYS';
  displayOrder: number;
  isActive: boolean;
}

interface KpiValue {
  key: string;
  name: string;
  value: number;
  unit: string;
  description: string;
  category: string;
}

const unitIcons: Record<string, React.ElementType> = {
  PERCENTAGE: Percent, CURRENCY: TrendingUp, COUNT: Hash, RATIO: DivideCircle, DAYS: BarChart2,
};

const categoryColors: Record<string, string> = {
  revenue: 'text-emerald-400', sales: 'text-indigo-400',
  claims: 'text-rose-400', renewals: 'text-amber-400', operations: 'text-purple-400',
};

const UNITS = ['PERCENTAGE', 'CURRENCY', 'COUNT', 'RATIO', 'DAYS'];
const CATEGORIES = ['revenue', 'sales', 'claims', 'renewals', 'operations'];

const METRIC_REGISTRY = [
  'leads_total', 'leads_converted', 'conversion_rate', 'revenue_this_month',
  'revenue_last_month', 'revenue_mom_growth', 'loss_ratio', 'renewals_expiring_45',
  'renewals_missed', 'renewal_conversion_rate', 'policies_issued_this_month', 'policies_mom_growth',
];

export default function KpiManagerPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', key: '', description: '', formula: '', category: 'sales', unit: 'COUNT' });

  const { data: definitions = [], isLoading: loadingDefs } = useQuery<KpiDefinition[]>({
    queryKey: ['kpi-definitions'],
    queryFn: () => api.get('/bi/kpi/definitions').then((r) => r.data),
  });

  const { data: kpiValues = [], isLoading: loadingValues } = useQuery<KpiValue[]>({
    queryKey: ['kpi-values'],
    queryFn: () => api.get('/bi/kpi').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/bi/kpi/definitions', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-values'] });
      setShowCreate(false);
      setForm({ name: '', key: '', description: '', formula: '', category: 'sales', unit: 'COUNT' });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post('/bi/kpi/seed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-values'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bi/kpi/definitions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kpi-definitions'] }),
  });

  const formatValue = (val: number, unit: string) => {
    if (unit === 'CURRENCY') return `₹${val.toLocaleString('en-IN')}`;
    if (unit === 'PERCENTAGE') return `${val}%`;
    if (unit === 'RATIO') return `${val}x`;
    return val.toLocaleString('en-IN');
  };

  const getKpiValue = (key: string) => kpiValues.find((v) => v.key === key);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-indigo-400" /> KPI Definition Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Centralized metric registry — every KPI defined once, evaluated consistently across all reports and dashboards.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {definitions.length === 0 && (
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer flex items-center gap-2"
              >
                {seedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Seed Defaults
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer flex items-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" /> New KPI
            </button>
          </div>
        )}
      </div>

      {/* Live KPI Values Panel */}
      {kpiValues.length > 0 && (
        <div className="glass rounded-xl border border-slate-900 p-5 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live KPI Values</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpiValues.map((kpi) => {
              const Icon = unitIcons[kpi.unit] ?? BarChart2;
              return (
                <div key={kpi.key} className="bg-slate-950/40 rounded-xl border border-slate-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-3.5 w-3.5 ${categoryColors[kpi.category] ?? 'text-slate-400'}`} />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">{kpi.category}</span>
                  </div>
                  <p className="text-xl font-bold text-white">{formatValue(kpi.value, kpi.unit)}</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">{kpi.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && isAdmin && (
        <div className="glass rounded-xl border border-indigo-500/30 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Define New KPI</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Name *</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Conversion Rate"
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Unique Key *</label>
              <input value={form.key} onChange={(e) => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))} placeholder="e.g. conversion_rate"
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white font-mono border border-slate-800 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Formula *</label>
              <input value={form.formula} onChange={(e) => setForm(f => ({ ...f, formula: e.target.value }))} placeholder="e.g. leads_converted / leads_total * 100"
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white font-mono border border-slate-800 focus:border-indigo-500 focus:outline-none" />
              <p className="text-[9px] text-slate-600 mt-1">Available metrics: {METRIC_REGISTRY.slice(0, 6).join(', ')}...</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Category</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Unit</label>
              <select value={form.unit} onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:outline-none">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Description</label>
              <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of what this metric measures"
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => createMutation.mutate()} disabled={!form.name || !form.key || !form.formula}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Save KPI
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* KPI Definitions Table */}
      <div className="glass rounded-xl border border-slate-900 overflow-hidden">
        <div className="p-5 border-b border-slate-900">
          <h2 className="text-sm font-bold text-white">KPI Registry ({definitions.length} definitions)</h2>
        </div>
        {loadingDefs ? (
          <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin text-indigo-500 mx-auto" /></div>
        ) : definitions.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart2 className="h-7 w-7 text-slate-700 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400">No KPIs defined yet.</p>
            <p className="text-[10px] text-slate-500 mt-1">Seed defaults or create a custom KPI above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Name</th>
                  <th className="py-3 px-5">Formula</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Unit</th>
                  <th className="py-3 px-5">Live Value</th>
                  {isAdmin && <th className="py-3 px-5">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {definitions.map((kpi) => {
                  const liveVal = getKpiValue(kpi.key);
                  return (
                    <tr key={kpi.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-5">
                        <p className="font-bold text-white">{kpi.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{kpi.key}</p>
                      </td>
                      <td className="py-3 px-5 font-mono text-indigo-300 text-[10px]">{kpi.formula}</td>
                      <td className="py-3 px-5">
                        <span className={`font-bold text-[10px] ${categoryColors[kpi.category] ?? 'text-slate-400'}`}>{kpi.category}</span>
                      </td>
                      <td className="py-3 px-5 text-slate-400 text-[10px]">{kpi.unit}</td>
                      <td className="py-3 px-5">
                        {liveVal ? (
                          <span className="font-bold text-white">{formatValue(liveVal.value, kpi.unit)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-5">
                          <button onClick={() => deleteMutation.mutate(kpi.id)}
                            className="text-slate-600 hover:text-rose-400 transition-colors cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Database, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminLookups } from '../../../hooks/useAdmin';

const LOOKUP_CATEGORIES = [
  { id: 'POLICY_TYPES', name: 'Policy Product Lines' },
  { id: 'INSURERS', name: 'Partner Insurance Companies' },
  { id: 'VEHICLES', name: 'Vehicle Master & IDV Matrix' },
  { id: 'CLAIM_REASONS', name: 'Claim Loss Reasons' },
  { id: 'CANCELLATION_REASONS', name: 'Cancellation Codes' },
  { id: 'GEOGRAPHIC_CITIES', name: 'Cities & RTO Zone Matrix' },
];

export default function LookupMastersPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('POLICY_TYPES');
  const { data: lookups = [], isLoading } = useAdminLookups(selectedCategory);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [form, setForm] = useState({ code: '', name: '', category: 'General' });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({ code: '', name: '', category: 'General' });
    setShowForm(!showForm);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setForm({ code: item.code, name: item.name, category: item.category || 'General' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error('Code and Name are required');
      return;
    }

    try {
      if (editingItem) {
        toast.info('Lookup updated!');
      } else {
        toast.info('Lookup entry created!');
      }
      setShowForm(false);
    } catch (e) {
      toast.error('Failed to save lookup');
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Self-Service Dynamic Lookup Masters Engine
          </h1>
          <p className="text-xs text-muted-foreground">Manage insurance master lists, vehicle IDV matrices, claim loss codes, and partner insurer configurations</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showForm && !editingItem ? 'Cancel' : '+ Add Master Item'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-5 border rounded-xl bg-card shadow-sm text-xs mb-4 mt-4">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" /> {editingItem ? 'Edit Master Item' : 'Add Master Entry'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Master Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HEALTH_IND"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs font-mono uppercase focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Master Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Individual Health Comprehensive"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-muted-foreground block mb-1">Sub-Category</label>
              <input
                type="text"
                placeholder="e.g. Health"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                <span>{isSaving ? 'Saving...' : 'Save Master Item'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1 mt-4 mb-4">
        {LOOKUP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setShowForm(false);
            }}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading lookups...</div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3.5">Master Code</th>
                <th className="p-3.5">Master Name / Description</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lookups?.map((item: any) => (
                <tr key={item.id} className="hover:bg-accent/40">
                  <td className="p-3.5 font-mono font-bold text-primary">{item.code}</td>
                  <td className="p-3.5 font-semibold text-foreground">{item.name}</td>
                  <td className="p-3.5 text-muted-foreground font-bold text-[10px]">{item.category}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Active
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                    >
                      Edit Master
                    </button>
                  </td>
                </tr>
              ))}
              {(!lookups || lookups.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

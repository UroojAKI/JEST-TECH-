'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Database, Plus, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useAdminLookups } from '../../../hooks/useAdmin';

const LOOKUP_CATEGORIES = [
  { id: 'POLICY_TYPES', name: 'Policy Product Lines' },
  { id: 'INSURERS', name: 'Partner Insurance Companies' },
  { id: 'VEHICLES', name: 'Vehicle Master & IDV Matrix' },
  { id: 'CLAIM_REASONS', name: 'Claim Loss Reasons' },
  { id: 'CANCELLATION_REASONS', name: 'Cancellation Codes' },
  { id: 'GEOGRAPHIC_CITIES', name: 'Cities & RTO Zone Matrix' },
];

const MOCK_LOOKUPS = [
  { id: 'L-101', type: 'POLICY_TYPES', code: 'MOTOR_COMP', name: 'Motor Comprehensive (Private Car)', category: 'Motor', isActive: true },
  { id: 'L-102', type: 'POLICY_TYPES', code: 'HEALTH_OPT', name: 'Group Health Optima (Corporate)', category: 'Health', isActive: true },
  { id: 'L-103', type: 'INSURERS', code: 'ICICI_LOM', name: 'ICICI Lombard General Insurance Co', category: 'General', isActive: true },
  { id: 'L-104', type: 'INSURERS', code: 'HDFC_ERG', name: 'HDFC ERGO General Insurance Co', category: 'General', isActive: true },
  { id: 'L-105', type: 'VEHICLES', code: 'MAH_THAR', name: 'Mahindra Thar LX Hardtop (Ex-Showroom ₹16.85L)', category: 'Motor SUV', isActive: true },
];

export default function LookupMastersPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('POLICY_TYPES');

  const filteredLookups = MOCK_LOOKUPS.filter((l) => l.type === selectedCategory);

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
            onClick={() => alert(`Adding new master entry for ${selectedCategory}...`)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Master Item</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {LOOKUP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
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

      {/* Lookup Items Grid Table */}
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
            {filteredLookups.map((item) => (
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
                    onClick={() => alert(`Editing lookup ${item.code}`)}
                    className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                  >
                    Edit Master
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

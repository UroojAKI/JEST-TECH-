'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Plus, Filter, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAgentLeads } from '../../../hooks/usePortal';

export default function AgentLeadsPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [productInterest, setProductInterest] = useState('MOTOR');
  const [notes, setNotes] = useState('');

  const { leads, isLoading, createLead, isCreating } = useAgentLeads(statusFilter === 'ALL' ? undefined : statusFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLead({ customerName, phone, email, productInterest, notes }, {
      onSuccess: () => {
        setShowForm(false);
        setCustomerName('');
        setPhone('');
        setEmail('');
        setProductInterest('MOTOR');
        setNotes('');
      }
    });
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agent Lead Pipeline</h1>
          <p className="text-xs text-muted-foreground">Track and nurture your prospective policy sales leads</p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>+ Create New Lead</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border rounded-xl bg-card space-y-4 my-4">
          <h3 className="font-bold text-sm">New Lead</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Customer Name</label>
              <input
                required
                className="w-full p-2 border rounded-md bg-background"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Phone</label>
              <input
                required
                className="w-full p-2 border rounded-md bg-background"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Email</label>
              <input
                type="email"
                className="w-full p-2 border rounded-md bg-background"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Product Interest</label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={productInterest}
                onChange={(e) => setProductInterest(e.target.value)}
              >
                <option value="MOTOR">MOTOR</option>
                <option value="HEALTH">HEALTH</option>
                <option value="LIFE">LIFE</option>
                <option value="PROPERTY">PROPERTY</option>
                <option value="TRAVEL">TRAVEL</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold">Notes</label>
              <textarea
                className="w-full p-2 border rounded-md bg-background"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-bold rounded-lg border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      )}

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1 my-4">
        {['ALL', 'NEW', 'QUOTE_SENT', 'NEGOTIATION', 'ISSUED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
              statusFilter === st ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading leads...</div>
      ) : (
        <div className="space-y-3 text-xs">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-card border rounded-xl">No leads found.</div>
          ) : (
            leads.map((lead: any) => (
              <div key={lead.id} className="p-4 rounded-xl border bg-card shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-primary">{lead.id || lead.leadNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border">{lead.status}</span>
                  </div>
                  <h4 className="font-extrabold text-sm text-foreground">{lead.customerName} ({lead.mobile || lead.phone})</h4>
                  <p className="text-muted-foreground text-xs">{lead.productLine || lead.productInterest}</p>
                </div>

                <div className="text-right">
                  <div className="font-mono font-black text-emerald-600 text-sm">Est. ₹{(lead.estimatedGwp || 0).toLocaleString('en-IN')}</div>
                  <span className="text-[10px] text-muted-foreground">Created {lead.createdAt?.split('T')[0] || 'Recently'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}

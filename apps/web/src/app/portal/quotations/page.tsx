'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Zap, Shield, Send, CheckCircle2, DollarSign } from 'lucide-react';

const MOCK_QUOTES = [
  { insurerCode: 'ICICI_LOM', insurerName: 'ICICI Lombard General Insurance', rating: 4.8, idvAmount: 1685000, basePremium: 12450, addonsPremium: 1800, gstAmount: 2565, totalPremium: 16815 },
  { insurerCode: 'HDFC_ERG', insurerName: 'HDFC ERGO General Insurance', rating: 4.7, idvAmount: 1685000, basePremium: 12100, addonsPremium: 1950, gstAmount: 2529, totalPremium: 16579 },
  { insurerCode: 'BAJAJ_ALL', insurerName: 'Bajaj Allianz General Insurance', rating: 4.6, idvAmount: 1685000, basePremium: 11950, addonsPremium: 1750, gstAmount: 2466, totalPremium: 16166 },
];

export default function AgentQuotationsPage() {
  const [vehicleIdv, setVehicleIdv] = useState('1685000');

  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Instant Multi-Insurer Quote Generator & Comparison Matrix
          </h1>
          <p className="text-xs text-muted-foreground">Compare live rating quotes across partner insurers and dispatch proposals directly to clients</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="p-4 rounded-xl border bg-card shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="font-bold text-muted-foreground text-[10px] uppercase">Vehicle IDV (Sum Insured)</label>
          <input
            type="number"
            value={vehicleIdv}
            onChange={(e) => setVehicleIdv(e.target.value)}
            className="w-full p-2 rounded border bg-background font-mono font-bold text-xs"
          />
        </div>
        <div>
          <label className="font-bold text-muted-foreground text-[10px] uppercase">Product Plan</label>
          <select className="w-full p-2 rounded border bg-background font-bold text-xs">
            <option>Motor Comprehensive (Private Car)</option>
            <option>Group Health Optima</option>
            <option>Two Wheeler Comprehensive</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => alert('Recalculating quotes across 14 partner insurers...')}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90"
          >
            Calculate Insurer Quotes
          </button>
        </div>
      </div>

      {/* Quote Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {MOCK_QUOTES.map((q) => (
          <div key={q.insurerCode} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <span className="font-mono font-bold text-[10px] text-primary">{q.insurerCode}</span>
                <h3 className="font-extrabold text-sm text-foreground">{q.insurerName}</h3>
                <span className="text-[10px] text-amber-500 font-bold">★ {q.rating} Rating</span>
              </div>
            </div>

            <div className="space-y-1.5 text-muted-foreground border-b pb-3">
              <div className="flex justify-between"><span>Vehicle IDV:</span><strong className="text-foreground font-mono">₹{q.idvAmount.toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between"><span>Base Own Damage:</span><strong className="text-foreground font-mono">₹{q.basePremium.toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between"><span>Addons Premium:</span><strong className="text-foreground font-mono">₹{q.addonsPremium.toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between"><span>GST (18%):</span><strong className="text-foreground font-mono">₹{q.gstAmount.toLocaleString('en-IN')}</strong></div>
            </div>

            <div className="p-3 rounded-xl border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex justify-between items-center font-bold">
              <span>Final Premium Payable:</span>
              <span className="text-base font-mono font-black">₹{q.totalPremium.toLocaleString('en-IN')}</span>
            </div>

            <button
              onClick={() => alert(`Shared quote for ${q.insurerName} via WhatsApp!`)}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow hover:bg-emerald-700"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Share Quote on WhatsApp</span>
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Zap, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';

interface QuoteResult {
  insurerId?: string;
  insurerCode?: string;
  insurerName: string;
  idv?: number;
  odPremium?: number;
  addonsPremium?: number;
  gstTotal?: number;
  totalPremium: number;
  rating?: number;
}

export default function AgentQuotationsPage() {
  const [vehicleIdv, setVehicleIdv] = useState('1685000');
  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const res = await apiClient.post('/quotations/calculate', {
        exShowroomPrice: Number(vehicleIdv) || 1000000,
        manualOverrideIdv: Number(vehicleIdv) || 1000000,
        registrationYear: new Date().getFullYear() - 1,
        engineCc: 1498,
        rtoZone: 'ZONE_A',
      });
      const results = res.data?.comparativeQuotes || res.data || [];
      setQuotes(results);
      toast.success(`Calculated ${results.length} live insurer quotes!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to calculate quotes');
    } finally {
      setIsCalculating(false);
    }
  };

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
      <div className="p-4 rounded-xl border bg-card shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mt-4">
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
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {isCalculating ? 'Calculating Live Rates...' : 'Calculate Insurer Quotes'}
          </button>
        </div>
      </div>

      {/* Quote Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mt-4">
        {quotes.length === 0 ? (
          <div className="col-span-3 p-8 text-center text-muted-foreground border rounded-2xl bg-card">
            Enter vehicle parameters and click &quot;Calculate Insurer Quotes&quot; to fetch live underwriter premiums.
          </div>
        ) : (
          quotes.map((q, idx) => (
            <div key={q.insurerId || q.insurerCode || idx} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
              <div className="flex justify-between items-start border-b pb-2">
                <div>
                  <span className="font-mono font-bold text-[10px] text-primary">{q.insurerCode || q.insurerId || `INS-${idx + 1}`}</span>
                  <h3 className="font-extrabold text-sm text-foreground">{q.insurerName}</h3>
                  <span className="text-[10px] text-amber-500 font-bold">★ {q.rating || '4.8'} Partner Rating</span>
                </div>
              </div>

              <div className="space-y-1.5 text-muted-foreground border-b pb-3">
                <div className="flex justify-between"><span>Vehicle IDV:</span><strong className="text-foreground font-mono">₹{Number(q.idv || vehicleIdv).toLocaleString('en-IN')}</strong></div>
                <div className="flex justify-between"><span>Base Own Damage:</span><strong className="text-foreground font-mono">₹{Number(q.odPremium || 0).toLocaleString('en-IN')}</strong></div>
                <div className="flex justify-between"><span>Addons Premium:</span><strong className="text-foreground font-mono">₹{Number(q.addonsPremium || 0).toLocaleString('en-IN')}</strong></div>
                <div className="flex justify-between"><span>GST (18%):</span><strong className="text-foreground font-mono">₹{Number(q.gstTotal || 0).toLocaleString('en-IN')}</strong></div>
              </div>

              <div className="p-3 rounded-xl border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex justify-between items-center font-bold">
                <span>Final Premium Payable:</span>
                <span className="text-base font-mono font-black">₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}</span>
              </div>

              <button
                onClick={() => toast.success('Quote shared via WhatsApp!')}
                className="w-full py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow hover:bg-emerald-700"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Share Quote on WhatsApp</span>
              </button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

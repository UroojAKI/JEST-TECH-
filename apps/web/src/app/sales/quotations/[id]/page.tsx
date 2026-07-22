'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { StatusBadge } from '../../../../components/ui/status-badge';
import {
  FileSpreadsheet,
  CheckCircle2,
  Share2,
  ArrowRight,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  Building2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useQuotations, useQuotationWorkspace } from '../../../../hooks/useQuotations';

export default function QuotationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = (params?.id as string) || 'QT-2026-0084';

  const [version, setVersion] = useState<number>(3);
  const [idv, setIdv] = useState<number>(850000);
  const [ncb, setNcb] = useState<number>(25);
  const [addons, setAddons] = useState<{ zeroDep: boolean; engineProtect: boolean; rsa: boolean }>({
    zeroDep: true,
    engineProtect: true,
    rsa: true,
  });

  const { convertQuotation, isConverting } = useQuotationWorkspace(quoteId);

  // Dynamic live rating calculation simulation
  const calcOd = (baseIdv: number) => Math.round(baseIdv * 0.015);
  const calcTp = 3221;
  const calcAddons = (opts: typeof addons) =>
    (opts.zeroDep ? 1800 : 0) + (opts.engineProtect ? 1200 : 0) + (opts.rsa ? 600 : 0);
  const calcNcbDisc = (od: number, ncbPct: number) => Math.round((od * ncbPct) / 100);

  const curOd = calcOd(idv);
  const curAddons = calcAddons(addons);
  const curNcbDisc = calcNcbDisc(curOd, ncb);

  const insurers = [
    {
      name: 'ICICI Lombard',
      recommended: true,
      reason: '🏆 Recommended • Highest Settlement (98.4%)',
      od: curOd,
      tp: calcTp,
      addons: curAddons,
      ncbDisc: curNcbDisc,
      garages: '5,600 Cashless',
      claimRatio: '98.4%',
    },
    {
      name: 'HDFC ERGO',
      recommended: false,
      reason: 'Lowest Out-of-Pocket Rate',
      od: Math.round(curOd * 1.04),
      tp: calcTp,
      addons: Math.round(curAddons * 0.95),
      ncbDisc: Math.round(curNcbDisc * 1.04),
      garages: '6,100 Cashless',
      claimRatio: '97.8%',
    },
    {
      name: 'Bajaj Allianz',
      recommended: false,
      reason: 'Best Engine Protect Terms',
      od: Math.round(curOd * 1.08),
      tp: calcTp,
      addons: Math.round(curAddons * 1.05),
      ncbDisc: Math.round(curNcbDisc * 1.08),
      garages: '5,850 Cashless',
      claimRatio: '98.1%',
    },
  ];

  return (
    <AppShell>
      {/* 1. Header & Versioning Selector */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-extrabold tracking-tight">Quotation #{quoteId}</h1>
              <div className="flex items-center space-x-1">
                <span className="text-xs font-bold text-muted-foreground">Revision:</span>
                <select
                  value={version}
                  onChange={(e) => setVersion(parseInt(e.target.value, 10))}
                  className="p-1 rounded border bg-background text-xs font-bold text-primary"
                >
                  <option value={3}>v3 (Current - ₹16,545)</option>
                  <option value={2}>v2 (Revised - ₹17,880)</option>
                  <option value={1}>v1 (Initial - ₹18,420)</option>
                </select>
              </div>
              <StatusBadge status="ACCEPTED" />
            </div>

            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Customer: <strong className="text-foreground">Rahul Patil</strong></span>
              <span>Vehicle: <strong className="text-foreground">MH-12-AB-1234 (Honda City)</strong></span>
              <span>Agent: <strong className="text-foreground">Rajesh Sharma</strong></span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center space-x-2">
            <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors">
              <Share2 className="h-4 w-4" />
              <span>Share Quote</span>
            </button>
            <button
              onClick={() => {
                convertQuotation(quoteId);
                router.push('/sales/proposals/PROP-2026-0091');
              }}
              disabled={isConverting}
              className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <span>Convert to Proposal</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Premium Evolution Timeline */}
        <div className="flex items-center space-x-3 text-xs bg-muted/20 p-2.5 rounded-xl border">
          <span className="font-bold text-muted-foreground uppercase text-[10px]">Premium Evolution:</span>
          <div className="flex items-center space-x-2 font-mono text-xs">
            <span className="line-through text-muted-foreground">V1: ₹18,420</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="line-through text-muted-foreground">V2: ₹17,880</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              V3: ₹16,545 (Accepted by Client)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Live Rating Recalculation Bar */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2">Live Rating Engine Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* IDV Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-bold">
              <span>Vehicle Insured Declared Value (IDV)</span>
              <span className="text-primary font-mono font-bold">₹{idv.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={700000}
              max={1000000}
              step={10000}
              value={idv}
              onChange={(e) => setIdv(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* NCB Selector */}
          <div className="space-y-2">
            <label className="font-bold">No Claim Bonus (NCB)</label>
            <div className="flex gap-1">
              {[0, 20, 25, 35, 45, 50].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setNcb(pct)}
                  className={`flex-1 py-1.5 rounded-md font-bold text-xs border transition-colors ${
                    ncb === pct ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Add-on Checkboxes */}
          <div className="space-y-2">
            <label className="font-bold">Coverage Add-ons</label>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center space-x-1 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={addons.zeroDep}
                  onChange={(e) => setAddons({ ...addons, zeroDep: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Zero Dep</span>
              </label>
              <label className="flex items-center space-x-1 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={addons.engineProtect}
                  onChange={(e) => setAddons({ ...addons, engineProtect: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Engine Protect</span>
              </label>
              <label className="flex items-center space-x-1 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={addons.rsa}
                  onChange={(e) => setAddons({ ...addons, rsa: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>RSA</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Hero Feature: Premium & Feature Comparison Matrix */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" /> Multi-Insurer Premium & Feature Comparison Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/30 border-b text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 font-bold">Insurer Name</th>
                <th className="p-3 font-bold">OD Premium</th>
                <th className="p-3 font-bold">TP Premium</th>
                <th className="p-3 font-bold">Add-ons</th>
                <th className="p-3 font-bold">NCB Disc ({ncb}%)</th>
                <th className="p-3 font-bold">Net Premium</th>
                <th className="p-3 font-bold">GST (18%)</th>
                <th className="p-3 font-bold">Total Premium</th>
                <th className="p-3 font-bold text-center">Cashless Garages</th>
                <th className="p-3 font-bold text-center">Settlement Ratio</th>
                <th className="p-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {insurers.map((ins) => {
                const net = ins.od + ins.tp + ins.addons - ins.ncbDisc;
                const gst = Math.round(net * 0.18);
                const total = net + gst;

                return (
                  <tr key={ins.name} className={`hover:bg-accent/30 ${ins.recommended ? 'bg-emerald-500/5 font-semibold' : ''}`}>
                    <td className="p-3">
                      <div className="font-bold text-foreground">{ins.name}</div>
                      {ins.recommended && (
                        <span className="text-[10px] text-emerald-600 font-extrabold">{ins.reason}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono">₹{ins.od.toLocaleString()}</td>
                    <td className="p-3 font-mono">₹{ins.tp.toLocaleString()}</td>
                    <td className="p-3 font-mono">₹{ins.addons.toLocaleString()}</td>
                    <td className="p-3 font-mono text-emerald-600">-₹{ins.ncbDisc.toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold">₹{net.toLocaleString()}</td>
                    <td className="p-3 font-mono text-muted-foreground">₹{gst.toLocaleString()}</td>
                    <td className="p-3 font-mono font-extrabold text-sm text-emerald-600">
                      ₹{total.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-semibold">{ins.garages}</td>
                    <td className="p-3 text-center font-bold text-primary">{ins.claimRatio}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          alert(`Selected ${ins.name} quote (₹${total.toLocaleString()})`);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                          ins.recommended
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                            : 'border bg-background hover:bg-accent text-foreground'
                        }`}
                      >
                        Select Quote
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

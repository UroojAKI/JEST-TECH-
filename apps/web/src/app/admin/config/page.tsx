'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Sliders, Save, ToggleLeft, ToggleRight, Building, ShieldCheck } from 'lucide-react';
import { useSystemConfig, useFeatureFlags } from '../../../hooks/useAdmin';

const MOCK_FLAGS = [
  { id: 'FF-01', key: 'ENABLE_WHATSAPP_DISPATCH', name: 'Automated WhatsApp Policy Dispatch', description: 'Trigger PDF policy schedules via WhatsApp Business API', isEnabled: true, environment: 'PRODUCTION', rolloutPercentage: 100 },
  { id: 'FF-02', key: 'ENABLE_RAZORPAY_AUTOPAY', name: 'Razorpay Recurring Auto-Debit', description: 'Support automated monthly premium collection via mandate', isEnabled: true, environment: 'PRODUCTION', rolloutPercentage: 100 },
  { id: 'FF-03', key: 'ENABLE_AI_SURVEYOR_OCR', name: 'AI Motor Claim Damage Detection', description: 'Enable computer vision for instant vehicle damage estimation', isEnabled: false, environment: 'STAGING', rolloutPercentage: 25 },
];

export default function SystemConfigPage() {
  const [flags, setFlags] = useState(MOCK_FLAGS);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'FLAGS'>('PROFILE');

  const handleToggleFlag = (id: string) => {
    setFlags(flags.map((f) => (f.id === id ? { ...f, isEnabled: !f.isEnabled } : f)));
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" /> System Parameters & Feature Flags Matrix
          </h1>
          <p className="text-xs text-muted-foreground">Configure organization profile, session limits, and toggle experimental feature rollouts in real time</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Saved system parameters!')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'PROFILE'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Company Profile & Parameters
        </button>
        <button
          onClick={() => setActiveTab('FLAGS')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'FLAGS'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Real-Time Feature Flags Matrix ({flags.length})
        </button>
      </div>

      {activeTab === 'PROFILE' && (
        <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Registered Company Name</label>
              <input type="text" defaultValue="JEST Insurance Brokering Pvt Ltd" className="w-full p-2.5 rounded-lg border bg-background font-bold text-xs" />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Corporate GSTIN Number</label>
              <input type="text" defaultValue="27AAAAA0000A1Z5" className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs" />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Financial Year Cycle</label>
              <input type="text" defaultValue="2026-2027 (Apr 1 - Mar 31)" className="w-full p-2.5 rounded-lg border bg-background font-semibold text-xs" />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Session Timeout (Minutes)</label>
              <input type="number" defaultValue={60} className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'FLAGS' && (
        <div className="space-y-3 text-xs">
          {flags.map((flag) => (
            <div key={flag.id} className="p-4 rounded-xl border bg-card flex justify-between items-center shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-primary text-xs">{flag.key}</span>
                  <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold border uppercase">{flag.environment}</span>
                </div>
                <h4 className="font-bold text-foreground text-sm">{flag.name}</h4>
                <p className="text-muted-foreground text-xs">{flag.description}</p>
              </div>

              <button onClick={() => handleToggleFlag(flag.id)} className="p-2">
                {flag.isEnabled ? (
                  <ToggleRight className="h-8 w-8 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

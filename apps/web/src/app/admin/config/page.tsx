'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Sliders, Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { useSystemConfig, useFeatureFlags } from '../../../hooks/useAdmin';
import { toast } from 'sonner';

export default function SystemConfigPage() {
  const { config, isLoading, updateConfig, isUpdating } = useSystemConfig();
  const { flags = [], toggleFlag } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'FLAGS'>('PROFILE');
  const [formData, setFormData] = useState<any>({
    companyName: '',
    gstin: '',
    financialYear: '',
    sessionTimeoutMinutes: 60
  });

  useEffect(() => {
    if (config) {
      setFormData({
        companyName: config.companyName || '',
        gstin: config.gstin || '',
        financialYear: config.financialYear || '',
        sessionTimeoutMinutes: config.sessionTimeoutMinutes || 60
      });
    }
  }, [config]);

  const handleToggleFlag = (id: string, isEnabled: boolean) => {
    toggleFlag({ id, isEnabled: !isEnabled });
  };

  const handleSave = async () => {
    try {
      await updateConfig(formData);
    } catch (e) {
      toast.error('Failed to save configuration');
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading configuration...</div>
      </AppShell>
    );
  }



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
            onClick={handleSave}
            disabled={isUpdating}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{isUpdating ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1 mb-4 mt-4">
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
              <input 
                type="text" 
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                className="w-full p-2.5 rounded-lg border bg-background font-bold text-xs" 
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Corporate GSTIN Number</label>
              <input 
                type="text" 
                value={formData.gstin}
                onChange={(e) => setFormData({...formData, gstin: e.target.value})}
                className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs" 
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Financial Year Cycle</label>
              <input 
                type="text" 
                value={formData.financialYear}
                onChange={(e) => setFormData({...formData, financialYear: e.target.value})}
                className="w-full p-2.5 rounded-lg border bg-background font-semibold text-xs" 
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Session Timeout (Minutes)</label>
              <input 
                type="number" 
                value={formData.sessionTimeoutMinutes}
                onChange={(e) => setFormData({...formData, sessionTimeoutMinutes: Number(e.target.value)})}
                className="w-full p-2.5 rounded-lg border bg-background font-mono font-bold text-xs" 
              />
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

              <button onClick={() => handleToggleFlag(flag.id, flag.isEnabled)} className="p-2">
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

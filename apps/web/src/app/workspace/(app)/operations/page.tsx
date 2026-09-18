'use client';

import React, { useState } from 'react';
import { DynamicWorkspace } from '../../../../components/workspaces/DynamicWorkspace';
import { MotorIssuanceQueue } from '../../../../components/operations/MotorIssuanceQueue';
import { BackOfficeTaskQueue } from '../../../../components/operations/BackOfficeTaskQueue';
import { Briefcase, CheckSquare, ShieldCheck, Activity } from 'lucide-react';

export default function OperationsWorkspacePage() {
  const [activeSection, setActiveSection] = useState<'ISSUANCE' | 'VERIFICATION' | 'METRICS'>('ISSUANCE');

  return (
    <div className="space-y-6">
      {/* Top Operations Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black">Back Office Operations Hub</h1>
            <p className="text-xs text-muted-foreground">Manage multi-gate issuance, task verification, and underwriting workflows.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
          <button
            onClick={() => setActiveSection('ISSUANCE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'ISSUANCE'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Issuance Workbench</span>
          </button>
          <button
            onClick={() => setActiveSection('VERIFICATION')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'VERIFICATION'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Operational Tasks</span>
          </button>
          <button
            onClick={() => setActiveSection('METRICS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'METRICS'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Metrics & Registry</span>
          </button>
        </div>
      </div>

      {/* Render selected view */}
      {activeSection === 'ISSUANCE' && <MotorIssuanceQueue />}
      {activeSection === 'VERIFICATION' && <BackOfficeTaskQueue />}
      {activeSection === 'METRICS' && (
        <DynamicWorkspace
          roleLabel="Back Office Operations"
          roleIcon={<Briefcase className="h-6 w-6" />}
        />
      )}
    </div>
  );
}

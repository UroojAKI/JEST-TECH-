'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DynamicWorkspace } from '../../../../components/workspaces/DynamicWorkspace';
import { MotorIssuanceQueue } from '../../../../components/operations/MotorIssuanceQueue';
import { BackOfficeTaskQueue } from '../../../../components/operations/BackOfficeTaskQueue';
import { Briefcase, CheckSquare, ShieldCheck, Activity } from 'lucide-react';

function OperationsWorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab')?.toLowerCase();

  const getInitialSection = (): 'ISSUANCE' | 'VERIFICATION' | 'METRICS' => {
    if (tabParam === 'inspections' || tabParam === 'verification') return 'VERIFICATION';
    if (tabParam === 'metrics') return 'METRICS';
    return 'ISSUANCE';
  };

  const [activeSection, setActiveSection] = useState<'ISSUANCE' | 'VERIFICATION' | 'METRICS'>(getInitialSection);

  useEffect(() => {
    if (tabParam === 'inspections' || tabParam === 'verification') {
      setActiveSection('VERIFICATION');
    } else if (tabParam === 'metrics') {
      setActiveSection('METRICS');
    } else if (tabParam === 'issuance') {
      setActiveSection('ISSUANCE');
    }
  }, [tabParam]);

  const handleSwitch = (section: 'ISSUANCE' | 'VERIFICATION' | 'METRICS') => {
    setActiveSection(section);
    const tabName = section === 'ISSUANCE' ? 'issuance' : section === 'VERIFICATION' ? 'inspections' : 'metrics';
    router.replace(`/workspace/operations?tab=${tabName}`);
  };

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
            onClick={() => handleSwitch('ISSUANCE')}
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
            onClick={() => handleSwitch('VERIFICATION')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'VERIFICATION'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Operational Tasks & Inspections</span>
          </button>
          <button
            onClick={() => handleSwitch('METRICS')}
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

export default function OperationsWorkspacePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading workspace...</div>}>
      <OperationsWorkspaceContent />
    </Suspense>
  );
}

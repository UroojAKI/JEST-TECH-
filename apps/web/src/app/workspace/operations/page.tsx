'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { MotorIssuanceQueue } from '../../../components/operations/MotorIssuanceQueue';
import { Briefcase } from 'lucide-react';

export default function OperationsWorkspacePage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <MotorIssuanceQueue />
        <DynamicWorkspace
          roleLabel="Back Office Operations"
          roleIcon={<Briefcase className="h-6 w-6" />}
        />
      </div>
    </AppShell>
  );
}

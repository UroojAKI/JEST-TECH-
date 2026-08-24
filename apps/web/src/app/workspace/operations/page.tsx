'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Briefcase } from 'lucide-react';

export default function OperationsWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Back Office Operations"
        roleIcon={<Briefcase className="h-6 w-6" />}
      />
    </AppShell>
  );
}

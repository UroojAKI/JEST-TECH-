'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Target } from 'lucide-react';

export default function SalesManagerWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Sales Manager Dashboard"
        roleIcon={<Target className="h-6 w-6" />}
      />
    </AppShell>
  );
}

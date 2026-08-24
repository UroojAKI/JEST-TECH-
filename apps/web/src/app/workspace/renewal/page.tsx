'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { RefreshCw } from 'lucide-react';

export default function RenewalWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Renewals & Retention Hub"
        roleIcon={<RefreshCw className="h-6 w-6" />}
      />
    </AppShell>
  );
}

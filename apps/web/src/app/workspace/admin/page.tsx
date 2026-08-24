'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Settings } from 'lucide-react';

export default function AdminWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="System Administration"
        roleIcon={<Settings className="h-6 w-6" />}
      />
    </AppShell>
  );
}

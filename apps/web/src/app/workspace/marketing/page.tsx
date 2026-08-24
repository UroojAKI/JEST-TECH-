'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Megaphone } from 'lucide-react';

export default function MarketingWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Marketing & Campaigns"
        roleIcon={<Megaphone className="h-6 w-6" />}
      />
    </AppShell>
  );
}

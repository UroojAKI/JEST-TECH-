'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { TrendingUp } from 'lucide-react';

export default function ExecutiveWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Managing Director Overview"
        roleIcon={<TrendingUp className="h-6 w-6" />}
      />
    </AppShell>
  );
}

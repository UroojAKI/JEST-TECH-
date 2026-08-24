'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Headphones } from 'lucide-react';

export default function CustomerWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Customer Service & Support"
        roleIcon={<Headphones className="h-6 w-6" />}
      />
    </AppShell>
  );
}

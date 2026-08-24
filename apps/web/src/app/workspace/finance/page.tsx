'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { DollarSign } from 'lucide-react';

export default function FinanceWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Finance & Accounts"
        roleIcon={<DollarSign className="h-6 w-6" />}
      />
    </AppShell>
  );
}

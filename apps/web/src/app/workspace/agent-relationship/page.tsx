'use client';
import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Users } from 'lucide-react';

export default function AgentRelationshipWorkspacePage() {
  return (
    <AppShell>
      <DynamicWorkspace
        roleLabel="Agent Relationship Manager"
        roleIcon={<Users className="h-6 w-6" />}
      />
    </AppShell>
  );
}

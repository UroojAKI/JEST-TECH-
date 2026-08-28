'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Users } from 'lucide-react';

export default function AgentRelationshipWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Agent Relationship Manager"
        roleIcon={<Users className="h-6 w-6" />}
      />
    </div>
  );
}

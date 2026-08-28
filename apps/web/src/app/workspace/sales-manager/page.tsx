'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Target } from 'lucide-react';

export default function SalesManagerWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Sales Manager Dashboard"
        roleIcon={<Target className="h-6 w-6" />}
      />
    </div>
  );
}

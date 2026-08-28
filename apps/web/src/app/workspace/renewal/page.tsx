'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { RefreshCw } from 'lucide-react';

export default function RenewalWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Renewals & Retention Hub"
        roleIcon={<RefreshCw className="h-6 w-6" />}
      />
    </div>
  );
}

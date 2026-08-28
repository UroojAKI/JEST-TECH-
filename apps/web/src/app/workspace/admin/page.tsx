'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Settings } from 'lucide-react';

export default function AdminWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="System Administration"
        roleIcon={<Settings className="h-6 w-6" />}
      />
    </div>
  );
}

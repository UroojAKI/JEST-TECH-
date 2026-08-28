'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Headphones } from 'lucide-react';

export default function CustomerWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Customer Service & Support"
        roleIcon={<Headphones className="h-6 w-6" />}
      />
    </div>
  );
}

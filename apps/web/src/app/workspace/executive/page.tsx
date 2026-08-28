'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { TrendingUp } from 'lucide-react';

export default function ExecutiveWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Managing Director Overview"
        roleIcon={<TrendingUp className="h-6 w-6" />}
      />
    </div>
  );
}

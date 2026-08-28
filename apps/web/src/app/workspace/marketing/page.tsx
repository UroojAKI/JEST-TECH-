'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { Megaphone } from 'lucide-react';

export default function MarketingWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Marketing & Campaigns"
        roleIcon={<Megaphone className="h-6 w-6" />}
      />
    </div>
  );
}

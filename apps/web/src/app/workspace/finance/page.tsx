'use client';
import React from 'react';
import { DynamicWorkspace } from '../../../components/workspaces/DynamicWorkspace';
import { DollarSign } from 'lucide-react';

export default function FinanceWorkspacePage() {
  return (
    <div className="space-y-6">
      <DynamicWorkspace
        roleLabel="Finance & Accounts"
        roleIcon={<DollarSign className="h-6 w-6" />}
      />
    </div>
  );
}

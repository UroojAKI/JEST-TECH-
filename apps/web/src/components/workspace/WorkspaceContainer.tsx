'use client';

import React from 'react';
import { AppShell } from '../layout/app-shell';
import { WorkspaceBreadcrumb } from './WorkspaceBreadcrumb';

interface WorkspaceContainerProps {
  children: React.ReactNode;
}

export function WorkspaceContainer({ children }: WorkspaceContainerProps) {
  return (
    <AppShell>
      <div className="space-y-6">
        <WorkspaceBreadcrumb />
        {children}
      </div>
    </AppShell>
  );
}

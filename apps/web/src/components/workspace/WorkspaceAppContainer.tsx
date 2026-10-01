'use client';

import React from 'react';
import { AppShell } from '../layout/app-shell';
import { WorkspaceBreadcrumb } from './WorkspaceBreadcrumb';

interface WorkspaceAppContainerProps {
  children: React.ReactNode;
}

export function WorkspaceAppContainer({ children }: WorkspaceAppContainerProps) {
  return (
    <AppShell>
      <div className="space-y-6">
        <WorkspaceBreadcrumb />
        {children}
      </div>
    </AppShell>
  );
}

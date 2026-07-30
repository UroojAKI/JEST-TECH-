'use client';

import React from 'react';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { WorkspaceBreadcrumb } from './WorkspaceBreadcrumb';

interface WorkspaceContainerProps {
  children: React.ReactNode;
}

export function WorkspaceContainer({ children }: WorkspaceContainerProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
      <WorkspaceHeader />
      <div className="flex-1 flex overflow-hidden">
        <WorkspaceSidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
          <WorkspaceBreadcrumb />
          {children}
        </main>
      </div>
    </div>
  );
}

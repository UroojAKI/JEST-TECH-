'use client';

import React from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { WorkspaceLoader } from './WorkspaceLoader';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, isError } = useWorkspace();

  if (isLoading) {
    return <WorkspaceLoader label="Loading Department Workspace & Dashboard Registry..." />;
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-rose-500 text-xs font-semibold">
        Failed to resolve workspace configuration. Retrying connection...
      </div>
    );
  }

  return <>{children}</>;
}

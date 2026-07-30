import React from 'react';
import { WorkspaceContainer } from '../../components/workspace/WorkspaceContainer';
import { WorkspaceProvider } from '../../components/workspace/WorkspaceProvider';

export default function WorkspaceRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceContainer>{children}</WorkspaceContainer>
    </WorkspaceProvider>
  );
}

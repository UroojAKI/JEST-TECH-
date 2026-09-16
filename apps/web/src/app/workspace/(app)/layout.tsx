import React from 'react';
import { WorkspaceAppContainer } from '../../../components/workspace/WorkspaceAppContainer';
import { WorkspaceProvider } from '../../../components/workspace/WorkspaceProvider';

export default function WorkspaceAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkspaceAppContainer>{children}</WorkspaceAppContainer>
    </WorkspaceProvider>
  );
}

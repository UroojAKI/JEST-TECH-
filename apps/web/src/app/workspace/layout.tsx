import React from 'react';

// Root workspace layout - sub-workspaces apply their own container
export default function WorkspaceRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

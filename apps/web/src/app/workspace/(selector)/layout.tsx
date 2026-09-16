import React from 'react';

// Workspace selector is standalone - no application sidebar, no nested navigation
export default function WorkspaceSelectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
      {children}
    </div>
  );
}

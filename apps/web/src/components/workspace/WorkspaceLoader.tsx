'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export function WorkspaceLoader({ label = 'Resolving Enterprise Workspace...' }: { label?: string }) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3 p-8">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <div className="text-xs font-semibold text-muted-foreground animate-pulse">{label}</div>
    </div>
  );
}

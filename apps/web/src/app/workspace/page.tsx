'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Loader2 } from 'lucide-react';

export default function RootWorkspacePage() {
  const router = useRouter();
  const { navigation } = useWorkspace();

  useEffect(() => {
    if (navigation && navigation.length > 0) {
      const primaryHref = navigation[0].href;
      if (primaryHref && primaryHref !== '/workspace') {
        router.replace(primaryHref);
      }
    }
  }, [navigation, router]);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-muted-foreground animate-pulse font-medium">Loading your role workspace...</div>
    </div>
  );
}

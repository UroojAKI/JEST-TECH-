'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Backward compatibility redirect: Executive / CEO overview is consolidated
 * under the Admin Workspace (/workspace/admin) under the Admin authorization model.
 */
export default function ExecutiveWorkspacePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workspace/admin');
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
      Redirecting to Admin Executive Dashboard...
    </div>
  );
}

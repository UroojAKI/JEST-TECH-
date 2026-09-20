'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardReportsBuilderRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/reports/builder');
  }, [router]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardReportsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/reports');
  }, [router]);

  return null;
}

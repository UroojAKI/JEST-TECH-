'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth-store';

export default function RootPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const roles = (user?.roles?.length ? user.roles : (user?.role ? [user.role] : []))
      .map((r: string) => String(r).toUpperCase());

    if (roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR'].includes(r))) {
      router.push('/workspace/admin');
    } else if (roles.some((r) => ['BACK_OFFICE', 'OPERATIONS', 'UNDERWRITER', 'FINANCE', 'FINANCE_OFFICER', 'CLAIMS_HANDLER'].includes(r))) {
      router.push('/workspace/operations');
    } else if (roles.some((r) => ['AGENT', 'SALES_AGENT'].includes(r))) {
      router.push('/workspace/sales');
    } else {
      router.push('/workspace');
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
